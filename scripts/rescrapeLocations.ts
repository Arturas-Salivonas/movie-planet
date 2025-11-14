/**
 * Re-scrape Locations Only (Fast Mode)
 *
 * This script:
 * 1. Loads existing movies from movies_enriched.json (keeps TMDb data)
 * 2. Re-scrapes ONLY IMDb locations + scenes
 * 3. Re-geocodes with smart 6-strategy fallback
 * 4. Updates movies_enriched.json in place
 * 5. Runs post-processing (GeoJSON, copy to public)
 *
 * Usage: npm run rescrape
 *
 * MUCH FASTER than full re-scrape because:
 * - Skips TMDb API calls (already have metadata)
 * - Only hits IMDb + Nominatim
 * - Parallel processing where possible
 */

import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import puppeteer from 'puppeteer'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface Location {
  lat: number
  lng: number
  city: string
  country: string
  description: string
  scene_description?: string
}

interface Movie {
  movie_id: string
  title: string
  original_title: string
  year: number
  imdb_id: string
  tmdb_id: number
  type: 'movie' | 'tv'
  genres: string[]
  poster: string
  trailer: string
  imdb_rating: number
  locations: Location[]
}

interface ScrapedLocation {
  place: string
  details?: string
  scene?: string
}

interface RescrapeState {
  processedIds: string[] // IMDb IDs that have been successfully processed
  lastRunDate: string
}

// ============================================================================
// Configuration
// ============================================================================

const NOMINATIM_DELAY = 1200 // 1.2 seconds (must be >1000ms for Nominatim rate limit)
const BATCH_SIZE = 5 // Process 5 movies in parallel (scraping only)
const STATE_FILE = path.join(__dirname, '../data/rescrape_state.json')
// NO parallel geocoding - must serialize ALL requests globally

// ============================================================================
// Global Geocoding Queue (prevents rate limit violations)
// ============================================================================

class GeocodingQueue {
  private queue: Array<() => Promise<void>> = []
  private processing = false
  private lastRequestTime = 0

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Ensure minimum delay between requests
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequestTime
          if (timeSinceLastRequest < NOMINATIM_DELAY) {
            await sleep(NOMINATIM_DELAY - timeSinceLastRequest)
          }

          const result = await fn()
          this.lastRequestTime = Date.now()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.process()
    })
  }

  private async process() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const fn = this.queue.shift()
      if (fn) await fn()
    }

    this.processing = false
  }
}

const geocodingQueue = new GeocodingQueue()

// ============================================================================
// State Management
// ============================================================================

async function loadState(): Promise<RescrapeState> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { processedIds: [], lastRunDate: '' }
  }
}

async function saveState(state: RescrapeState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2))
}

// ============================================================================
// Scraping Functions (from fetchMoviesAuto.ts)
// ============================================================================

// Helper function for delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function scrapeIMDbLocations(imdbId: string): Promise<ScrapedLocation[]> {
  const url = `https://www.imdb.com/title/${imdbId}/locations/`
  let browser

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    await sleep(2000)

    // Click "Show More" buttons
    let clickCount = 0
    let foundButton = true
    const MAX_CLICK_ATTEMPTS = 5

    while (foundButton && clickCount < MAX_CLICK_ATTEMPTS) {
      try {
        const buttonSelectors = [
          'button.ipc-see-more__button',
          'button[class*="see-more"]',
          '.single-page-see-more-button-flmg_locations button',
          '.chained-see-more-button-flmg_locations button'
        ]

        let clicked = false

        for (const selector of buttonSelectors) {
          const buttons = await page.$$(selector)

          for (const button of buttons) {
            const buttonText = await page.evaluate(el => el.textContent, button)

            if (buttonText && (
              buttonText.includes('more') ||
              buttonText.includes('See all') ||
              buttonText.includes('Show')
            )) {
              console.log(`     ✓ Clicking: "${buttonText.trim()}"`)

              await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), button)
              await sleep(500)

              await button.click()
              await sleep(2000)

              clicked = true
              clickCount++
              break
            }
          }

          if (clicked) break
        }

        if (!clicked) {
          foundButton = false
        }

      } catch (e) {
        foundButton = false
      }
    }

    console.log(`     📊 Clicked ${clickCount} expansion button(s)`)

    // Extract locations with scene descriptions
    const locations = await page.evaluate(() => {
      const results: { place: string; scene?: string }[] = []

      const locationCards = document.querySelectorAll('[data-testid="item-id"]')

      for (const card of Array.from(locationCards)) {
        const locationLink = card.querySelector('a[data-testid="item-text-with-link"]')
        const locationText = locationLink?.textContent?.trim() || ''

        const sceneElement = card.querySelector('[data-testid="item-attributes"]')
        const sceneText = sceneElement?.textContent?.trim() || ''

        if (locationText) {
          results.push({
            place: locationText,
            scene: sceneText || undefined
          })
        }
      }

      return results
    })

    console.log(`     ✅ Extracted ${locations.length} locations`)

    if (locations.length > 0) {
      const withScenes = locations.filter(l => l.scene).length
      if (withScenes > 0) {
        console.log(`     🎬 ${withScenes} have scene descriptions`)
      }
    }

    return locations

  } catch (error) {
    console.error(`     ❌ Scraping error:`, error instanceof Error ? error.message : 'Unknown error')
    return []
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

function generateGeocodingQueries(locationString: string): string[] {
  const queries: string[] = []

  // Strategy 1: Full address
  queries.push(locationString)

  // Strategy 2: Remove building/specific location name (before first comma)
  const parts = locationString.split(',').map(s => s.trim())
  if (parts.length > 1) {
    queries.push(parts.slice(1).join(', '))
  }

  // Strategy 3: City + Country (last part is usually country)
  if (parts.length >= 2) {
    const country = parts[parts.length - 1]
    const city = parts[0]
    queries.push(`${city}, ${country}`)
  }

  // Strategy 4: City + Region/State (if exists)
  if (parts.length >= 3) {
    const region = parts[parts.length - 2]
    const city = parts[0]
    queries.push(`${city}, ${region}`)
  }

  // Strategy 5: Just city name
  if (parts.length >= 1) {
    queries.push(parts[0])
  }

  // Strategy 6: Just country
  if (parts.length >= 2) {
    queries.push(parts[parts.length - 1])
  }

  return queries
}

async function geocodeLocation(locationString: string): Promise<{ lat: number; lng: number; city: string; country: string } | null> {
  const queries = generateGeocodingQueries(locationString)

  for (const query of queries) {
    try {
      // Use global queue to serialize ALL geocoding requests
      const result = await geocodingQueue.add(async () => {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: query,
            format: 'json',
            limit: 1,
            addressdetails: 1,
          },
          headers: {
            'User-Agent': 'filmingmap.com'
          },
          timeout: 10000
        })

        if (response.data && response.data.length > 0) {
          const result = response.data[0]
          const address = result.address || {}

          return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            city: address.city || address.town || address.village || address.county || 'Unknown',
            country: address.country || 'Unknown'
          }
        }
        return null
      })

      if (result) {
        return result
      }
    } catch (error) {
      console.error(`  ❌ Geocoding failed for query "${query}":`, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return null
}

// ============================================================================
// Main Processing
// ============================================================================

async function processMovie(movie: Movie, index: number, total: number): Promise<Movie> {
  console.log(`\n[${index + 1}/${total}] Processing: ${movie.title} (${movie.year})`)
  console.log(`   IMDb: ${movie.imdb_id}`)

  try {
    // Scrape locations from IMDb
    console.log('   📍 Scraping locations...')
    const scrapedLocations = await scrapeIMDbLocations(movie.imdb_id)

    if (scrapedLocations.length === 0) {
      console.log('   ⚠️  No locations found on IMDb')
      return { ...movie, locations: [] }
    }

    console.log(`   ✅ Found ${scrapedLocations.length} locations`)
    const withScenes = scrapedLocations.filter(l => l.scene).length
    if (withScenes > 0) {
      console.log(`   🎬 ${withScenes} locations have scene descriptions`)
    }

    // Geocode locations (all requests go through global queue)
    console.log('   🌍 Geocoding...')
    const locations: Location[] = []
    let geocoded = 0

    // Process all locations - the queue will serialize requests automatically
    const results = await Promise.all(
      scrapedLocations.map(async (loc) => {
        const coords = await geocodeLocation(loc.place)
        return coords ? {
          ...coords,
          description: loc.place,
          scene_description: loc.scene
        } : null
      })
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result) {
        locations.push(result)
        geocoded++
      } else {
        console.log(`   ❌ Failed to geocode: ${scrapedLocations[j].place}`)
      }
    }

    console.log(`   ✅ Successfully geocoded: ${geocoded}/${scrapedLocations.length}`)

    return {
      ...movie,
      locations
    }

  } catch (error) {
    console.error(`   ❌ Error processing movie:`, error instanceof Error ? error.message : 'Unknown error')
    return movie // Return original if processing fails
  }
}

async function main() {
  console.log('\n🎬 Re-scrape Locations Only (Fast Mode)')
  console.log('========================================\n')

  const enrichedPath = path.join(__dirname, '../data/movies_enriched.json')

  // Load rescrape state
  const state = await loadState()

  // Load existing movies
  console.log('📂 Loading existing movies database...\n')
  let existingMovies: Movie[]

  try {
    const data = await fs.readFile(enrichedPath, 'utf-8')
    existingMovies = JSON.parse(data)
    console.log(`✅ Loaded ${existingMovies.length} movies\n`)

    // Create backup before processing
    const backupPath = path.join(__dirname, '../data/movies_enriched.backup.json')
    await fs.writeFile(backupPath, data)
    console.log(`💾 Backup created: movies_enriched.backup.json\n`)

    // Filter out movies that already have locations with scene descriptions
    // OR have been successfully processed before
    const moviesToProcess = existingMovies.filter(movie => {
      // Skip if already processed successfully
      if (state.processedIds.includes(movie.imdb_id)) {
        return false
      }

      // Skip if movie has locations AND at least one has a scene description
      const hasScenes = movie.locations && movie.locations.length > 0 &&
                       movie.locations.some(loc => loc.scene_description && loc.scene_description.trim() !== '')
      return !hasScenes
    })

    const skippedCount = existingMovies.length - moviesToProcess.length

    if (skippedCount > 0) {
      console.log(`⏭️  Skipping ${skippedCount} movies (${state.processedIds.length} already processed, ${skippedCount - state.processedIds.length} have scenes)`)
      console.log(`📊 Need to process: ${moviesToProcess.length} movies\n`)
    }

    existingMovies = moviesToProcess
  } catch (error) {
    console.error('❌ Failed to load movies_enriched.json')
    console.error('💡 Run "npm run fetch" first to create the database\n')
    process.exit(1)
  }

  // Process movies in batches
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🚀 Starting location re-scraping...\n')
  console.log(`📊 Processing ${existingMovies.length} movies`)
  console.log(`⚡ Parallel processing: ${BATCH_SIZE} movies at a time (scraping only)`)
  console.log(`⏱️  Geocoding: SERIALIZED (1 request every ${NOMINATIM_DELAY}ms to respect rate limit)`)
  console.log(`⏱️  Estimated time: ${Math.ceil(existingMovies.length * 0.3)} minutes\n`)

  const updatedMovies: Movie[] = []
  const totalBatches = Math.ceil(existingMovies.length / BATCH_SIZE)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, existingMovies.length)
    const batch = existingMovies.slice(start, end)

    console.log(`\n━━━ Batch ${batchIndex + 1}/${totalBatches} (movies ${start + 1}-${end}) ━━━`)

    // Process movies in parallel within batch
    const processedBatch = await Promise.all(
      batch.map((movie, i) => processMovie(movie, start + i, existingMovies.length))
    )

    updatedMovies.push(...processedBatch)

    // Update state with successfully processed movies
    for (const movie of processedBatch) {
      if (movie.locations && movie.locations.length > 0) {
        state.processedIds.push(movie.imdb_id)
      }
    }
    state.lastRunDate = new Date().toISOString()
    await saveState(state)

    // Save progress after each batch - MERGE with existing data to prevent data loss
    try {
      // Read current file state (might have been updated externally or have all movies)
      const currentData = await fs.readFile(enrichedPath, 'utf-8')
      const currentMovies: Movie[] = JSON.parse(currentData)

      // Create a map of updated movies by imdb_id
      const updatedMap = new Map(updatedMovies.map(m => [m.imdb_id, m]))

      // Merge: keep all movies, but replace ones we've processed
      const mergedMovies = currentMovies.map(movie =>
        updatedMap.has(movie.imdb_id) ? updatedMap.get(movie.imdb_id)! : movie
      )

      await fs.writeFile(enrichedPath, JSON.stringify(mergedMovies, null, 2))
      console.log(`\n💾 Progress saved (${updatedMovies.length}/${existingMovies.length} processed, ${mergedMovies.length} total in DB)`)
    } catch (error) {
      console.error('⚠️  Warning: Could not save progress:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  // Statistics
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Final Statistics:\n')

  const moviesWithLocations = updatedMovies.filter(m => m.locations.length > 0).length
  const totalLocations = updatedMovies.reduce((sum, m) => sum + m.locations.length, 0)
  const locationsWithScenes = updatedMovies.reduce((sum, m) =>
    sum + m.locations.filter(l => l.scene_description).length, 0)

  console.log(`   Movies processed: ${updatedMovies.length}`)
  console.log(`   Movies with locations: ${moviesWithLocations}`)
  console.log(`   Total locations: ${totalLocations}`)
  console.log(`   Locations with scenes: ${locationsWithScenes}`)
  console.log()

  // Post-processing
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔧 Running post-processing...\n')

  // 1. Transform to GeoJSON
  console.log('1️⃣  Transforming to GeoJSON...')
  execSync('npm run transform:geojson', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  })

  // 2. Copy to public folder
  console.log('\n2️⃣  Copying to public folder...')
  execSync('npm run copy:public', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  })

  // Success!
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n🎉 SUCCESS! Location re-scraping complete!\n')
  console.log('📊 What was done:')
  console.log('   ✅ Re-scraped all locations from IMDb')
  console.log('   ✅ Extracted scene descriptions')
  console.log('   ✅ Geocoded with smart fallback')
  console.log('   ✅ Transformed to GeoJSON')
  console.log('   ✅ Copied to public folder')
  console.log('\n📊 Next steps:')
  console.log('   1. Run: npm run build')
  console.log('   2. Run: npm run dev')
  console.log('   3. Check your site!\n')
  console.log('💡 Tip: To reset progress tracking, run: npm run rescrape:reset\n')
}

// Handle command line arguments and run
(async () => {
  try {
    const args = process.argv.slice(2)
    if (args.includes('--reset') || args.includes('reset')) {
      console.log('\n🔄 Resetting rescrape state...\n')
      await saveState({ processedIds: [], lastRunDate: '' })
      console.log('✅ State reset! Next run will process all movies without scenes.\n')
    } else {
      await main()
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  }
})()
