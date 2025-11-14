/**
 * Test Script: Enhanced IMDb Location Scraper
 *
 * Tests the new scraping logic for a single movie (Harry Potter)
 * - Clicks "Show More" / "See all" buttons to expand all locations
 * - Extracts location names AND scene descriptions
 * - Geocodes locations
 * - Saves to test output file
 *
 * Usage: npm run test:scrape
 */

import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import puppeteer from 'puppeteer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface ScrapedLocation {
  place: string
  scene?: string  // NEW: Scene description from attributes
}

interface Location {
  lat: number
  lng: number
  city: string
  country: string
  description: string
  scene_description?: string  // NEW: What was filmed here
}

interface Movie {
  movie_id: string
  title: string
  year: number
  imdb_id: string
  locations: Location[]
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  TEST_IMDB_ID: 'tt0241527', // Harry Potter and the Sorcerer's Stone
  NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
  CACHE_DIR: 'data/cache',
  OUTPUT_FILE: 'data/test_harry_potter_locations.json',
  RATE_LIMIT_DELAY: 1200, // 1.2 seconds for Nominatim (safer)
  PUPPETEER_TIMEOUT: 30000,
  MAX_CLICK_ATTEMPTS: 5, // Try clicking "Show More" up to 5 times
}

// ============================================================================
// Utilities
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cacheFile = path.join(__dirname, `../${CONFIG.CACHE_DIR}/${key}.json`)
    const data = await fs.readFile(cacheFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const cacheDir = path.join(__dirname, `../${CONFIG.CACHE_DIR}`)
    await fs.mkdir(cacheDir, { recursive: true })
    const cacheFile = path.join(cacheDir, `${key}.json`)
    await fs.writeFile(cacheFile, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`Failed to cache ${key}:`, error)
  }
}

// ============================================================================
// ENHANCED IMDb Scraping with Pagination and Scene Extraction
// ============================================================================

async function scrapeIMDbLocationsEnhanced(imdbId: string): Promise<ScrapedLocation[]> {
  const url = `https://www.imdb.com/title/${imdbId}/locations/`
  let browser

  try {
    console.log(`\n🌐 Launching browser for: ${url}`)
    console.log(`⏳ This may take a while as we expand all locations...\n`)

    browser = await puppeteer.launch({
      headless: true, // Run in background
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

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Navigate to the page
    console.log(`📄 Loading page...`)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.PUPPETEER_TIMEOUT
    })

    await sleep(2000)

    // ========================================================================
    // STEP 1: Click "Show More" / "See All" buttons until all locations visible
    // ========================================================================
    console.log(`\n🔄 Expanding all locations...`)

    let clickCount = 0
    let foundButton = true

    while (foundButton && clickCount < CONFIG.MAX_CLICK_ATTEMPTS) {
      try {
        // Try to find "Show More" or "See all" button
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

            // Check if it's a "Show More" or "See all" button
            if (buttonText && (
              buttonText.includes('more') ||
              buttonText.includes('See all') ||
              buttonText.includes('Show')
            )) {
              console.log(`   ✓ Clicking button: "${buttonText.trim()}"`)

              // Scroll button into view
              await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), button)
              await sleep(500)

              // Click the button
              await button.click()
              await sleep(2000) // Wait for content to load

              clicked = true
              clickCount++
              break
            }
          }

          if (clicked) break
        }

        if (!clicked) {
          foundButton = false
          console.log(`   ✓ No more buttons found - all locations expanded!`)
        }

      } catch (e) {
        foundButton = false
        console.log(`   ℹ No more expansion buttons found`)
      }
    }

    console.log(`   📊 Clicked ${clickCount} expansion button(s)\n`)

    // ========================================================================
    // STEP 2: Extract ALL locations with scene descriptions
    // ========================================================================
    console.log(`📍 Extracting location data...\n`)

    const locations = await page.evaluate(() => {
      const results: { place: string; scene: string }[] = []

      // Find all location cards
      const locationCards = document.querySelectorAll('[data-testid="item-id"]')

      console.log(`Found ${locationCards.length} location cards`)

      for (const card of Array.from(locationCards)) {
        // Extract location name from the link
        const locationLink = card.querySelector('a[data-testid="item-text-with-link"]')
        const locationText = locationLink?.textContent?.trim() || ''

        // Extract scene description from attributes
        const sceneElement = card.querySelector('[data-testid="item-attributes"]')
        const sceneText = sceneElement?.textContent?.trim() || ''

        if (locationText) {
          results.push({
            place: locationText,
            scene: sceneText
          })
        }
      }

      return results
    })

    // Save debug HTML
    const html = await page.content()
    const debugPath = path.join(__dirname, `../data/debug_${imdbId}_enhanced.html`)
    await fs.writeFile(debugPath, html)
    console.log(`💾 Saved debug HTML: debug_${imdbId}_enhanced.html\n`)

    await browser.close()

    if (locations.length > 0) {
      console.log(`✅ Successfully scraped ${locations.length} locations from IMDb\n`)

      // Display first few locations with scenes
      console.log(`📋 Sample locations:\n`)
      locations.slice(0, 5).forEach((loc, i) => {
        console.log(`${i + 1}. ${loc.place}`)
        if (loc.scene) {
          console.log(`   Scene: ${loc.scene}`)
        }
        console.log()
      })

      if (locations.length > 5) {
        console.log(`   ... and ${locations.length - 5} more locations\n`)
      }

      await setCache(`imdb_locations_enhanced_${imdbId}`, locations)
      return locations
    } else {
      console.log(`⚠️  No locations found on IMDb`)
      return []
    }

  } catch (error: any) {
    if (browser) await browser.close()
    console.error(`❌ IMDb scraping failed: ${error.message}`)
    throw error
  }
}

// ============================================================================
// Geocoding with Smart Fallback
// ============================================================================

/**
 * Enhanced geocoding with multiple fallback strategies
 * Tries progressively simpler queries until a match is found
 */
async function geocodeLocation(locationName: string): Promise<{ lat: number; lng: number; city: string; country: string } | null> {
  // Try to geocode with progressively simpler queries
  const queries = generateGeocodingQueries(locationName)

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]
    const cacheKey = `geocode_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    // Check cache first
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await axios.get(`${CONFIG.NOMINATIM_BASE_URL}/search`, {
        params: {
          q: query,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'filmingmap/2.0 (Movie Filming Location Mapper - Testing)'
        },
        timeout: 10000 // 10 second timeout
      })

      if (response.data.length > 0) {
        const result = response.data[0]
        const address = result.address || {}

        const geocoded = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          city: address.city || address.town || address.village || address.county || address.state || locationName.split(',')[0].trim(),
          country: address.country || ''
        }

        // Cache the result
        await setCache(cacheKey, geocoded)
        await sleep(CONFIG.RATE_LIMIT_DELAY)

        return geocoded
      }

      // No result, try next query
      await sleep(CONFIG.RATE_LIMIT_DELAY)

    } catch (error: any) {
      await sleep(CONFIG.RATE_LIMIT_DELAY)
    }
  }

  // All queries failed
  return null
}

/**
 * Generate progressively simpler geocoding queries
 */
function generateGeocodingQueries(location: string): string[] {
  const queries: string[] = []

  // Original query
  queries.push(location)

  // Split by comma
  const parts = location.split(',').map(p => p.trim())

  if (parts.length <= 1) {
    return queries
  }

  // Strategy 1: Remove first part (usually building/street name)
  if (parts.length >= 3) {
    queries.push(parts.slice(1).join(', '))
  }

  // Strategy 2: City + Country (last part is usually country)
  if (parts.length >= 2) {
    const country = parts[parts.length - 1]
    const city = parts[0]
    queries.push(`${city}, ${country}`)
  }

  // Strategy 3: Take last 3 parts (region, sub-region, country)
  if (parts.length >= 4) {
    queries.push(parts.slice(-3).join(', '))
  }

  // Strategy 4: Take last 2 parts (region, country)
  if (parts.length >= 3) {
    queries.push(parts.slice(-2).join(', '))
  }

  // Strategy 5: Just the city name
  if (parts.length >= 2) {
    queries.push(parts[0])
  }

  // Strategy 6: Second part (often the main city)
  if (parts.length >= 3) {
    queries.push(parts[1])
  }

  // Remove duplicates while preserving order
  return [...new Set(queries)]
}

// ============================================================================
// Main Test
// ============================================================================

async function testScrapeMovie() {
  console.log('\n🎬 Enhanced IMDb Location Scraper - TEST')
  console.log('==========================================')
  console.log(`Testing with: Harry Potter and the Sorcerer's Stone`)
  console.log(`IMDb ID: ${CONFIG.TEST_IMDB_ID}\n`)

  try {
    // Step 1: Scrape IMDb
    const scrapedLocations = await scrapeIMDbLocationsEnhanced(CONFIG.TEST_IMDB_ID)

    if (scrapedLocations.length === 0) {
      console.error('❌ No locations found. Test failed.')
      process.exit(1)
    }

    // Step 2: Geocode all locations
    console.log(`\n🌍 Geocoding ${scrapedLocations.length} locations...`)
    console.log(`⏳ This will take ~${Math.ceil(scrapedLocations.length * 1.1)} seconds due to rate limiting\n`)

    const locations: Location[] = []

    for (let i = 0; i < scrapedLocations.length; i++) {
      const scraped = scrapedLocations[i]
      process.stdout.write(`[${i + 1}/${scrapedLocations.length}] ${scraped.place}... `)

      try {
        const geocoded = await geocodeLocation(scraped.place)

        if (geocoded) {
          locations.push({
            lat: geocoded.lat,
            lng: geocoded.lng,
            city: geocoded.city,
            country: geocoded.country,
            description: scraped.place,
            scene_description: scraped.scene || undefined
          })
          console.log(`✅ ${geocoded.city}, ${geocoded.country}`)
        } else {
          console.log(`❌ Failed`)
        }
      } catch (error: any) {
        console.log(`❌ Error: ${error.message}`)
      }
    }

    // Step 3: Create movie object
    const movie: Movie = {
      movie_id: CONFIG.TEST_IMDB_ID,
      title: "Harry Potter and the Sorcerer's Stone",
      year: 2001,
      imdb_id: CONFIG.TEST_IMDB_ID,
      locations
    }

    // Step 4: Save to file
    const outputPath = path.join(__dirname, '..', CONFIG.OUTPUT_FILE)
    await fs.writeFile(outputPath, JSON.stringify(movie, null, 2))

    // Summary
    console.log(`\n\n✅ TEST COMPLETED SUCCESSFULLY!`)
    console.log(`═══════════════════════════════════════════════`)
    console.log(`📊 Statistics:`)
    console.log(`   • Total locations scraped: ${scrapedLocations.length}`)
    console.log(`   • Successfully geocoded: ${locations.length}`)
    console.log(`   • Locations with scenes: ${locations.filter(l => l.scene_description).length}`)
    console.log(`   • Failed geocoding: ${scrapedLocations.length - locations.length}`)
    console.log(`\n💾 Saved to: ${CONFIG.OUTPUT_FILE}`)
    console.log(`\n🎯 Next steps:`)
    console.log(`   1. Review the output file`)
    console.log(`   2. Check if scenes appear correctly`)
    console.log(`   3. If successful, update main scraper`)
    console.log(`\n`)

  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the test
testScrapeMovie()
