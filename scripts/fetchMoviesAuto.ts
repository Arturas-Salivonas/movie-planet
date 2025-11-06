/**
 * Automated Movie Location Fetcher
 *
 * This script:
 * 1. Fetches movie metadata from TMDb
 * 2. Scrapes filming locations from IMDb using Puppeteer
 * 3. Falls back to Wikipedia if IMDb fails
 * 4. Geocodes all locations using Nominatim
 * 5. Caches everything to avoid re-fetching
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

interface Location {
  lat: number
  lng: number
  city: string
  country: string
  description: string
}

interface Movie {
  movie_id: string
  title: string
  original_title: string
  year: number
  imdb_id: string
  tmdb_id: number
  genres: string[]
  poster: string
  trailer: string
  imdb_rating: number
  locations: Location[]
}

interface InputMovie {
  imdb_id?: string
  tmdb_id?: number
}

interface ScrapedLocation {
  place: string
  details?: string
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  TMDB_API_KEY: process.env.TMDB_API_KEY || '',
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
  CACHE_DIR: 'data/cache',
  INPUT_FILE: process.env.INPUT_FILE || 'data/movies_input.json',
  OUTPUT_FILE: 'data/movies_enriched_auto.json',
  PROGRESS_FILE: 'data/movies_enriched_progress.json',
  RATE_LIMIT_DELAY: 1100, // 1.1 seconds for Nominatim
  PUPPETEER_TIMEOUT: 15000,
  MAX_RETRIES: 3,
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

/**
 * Deduplicate locations by coordinates
 * Some movies list the same location multiple times (e.g., different scenes in same city)
 * We only keep one location per unique coordinate pair (rounded to 4 decimal places)
 */
function deduplicateLocationsByCoordinates(locations: Location[]): Location[] {
  const seen = new Set<string>()
  const deduplicated: Location[] = []

  for (const location of locations) {
    // Round to 4 decimal places (~11 meters precision)
    const lat = Math.round(location.lat * 10000) / 10000
    const lng = Math.round(location.lng * 10000) / 10000
    const key = `${lat},${lng}`

    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(location)
    }
  }

  return deduplicated
}

// ============================================================================
// TMDb Functions
// ============================================================================

async function findTmdbId(imdbId: string): Promise<number | null> {
  const cacheKey = `tmdb_find_${imdbId}`
  const cached = await getCached<{ tmdb_id: number }>(cacheKey)
  if (cached) return cached.tmdb_id

  try {
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/find/${imdbId}`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        external_source: 'imdb_id',
      },
    })

    const tmdbId = response.data.movie_results?.[0]?.id
    if (tmdbId) {
      await setCache(cacheKey, { tmdb_id: tmdbId })
      return tmdbId
    }
  } catch (error: any) {
    console.error(`  ❌ TMDb find failed: ${error.message}`)
  }

  return null
}

async function fetchTmdbMovie(tmdbId: number): Promise<any> {
  const cacheKey = `tmdb_movie_${tmdbId}`
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  try {
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/movie/${tmdbId}`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        append_to_response: 'videos,external_ids',
      },
    })

    await setCache(cacheKey, response.data)
    await sleep(250) // Rate limiting for TMDb
    return response.data
  } catch (error: any) {
    console.error(`  ❌ TMDb fetch failed: ${error.message}`)
    throw error
  }
}

function extractTrailerId(videos: any): string | undefined {
  const trailer = videos?.results?.find(
    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
  )
  return trailer?.key
}

// ============================================================================
// IMDb Scraping with Puppeteer
// ============================================================================

async function scrapeIMDbLocations(imdbId: string): Promise<ScrapedLocation[]> {
  const cacheKey = `imdb_locations_${imdbId}`
  const cached = await getCached<ScrapedLocation[]>(cacheKey)
  if (cached) {
    console.log(`  💾 Using cached IMDb data (${cached.length} locations)`)
    return cached
  }

  const url = `https://www.imdb.com/title/${imdbId}/locations/`
  let browser

  try {
    console.log(`  🌐 Launching browser for: ${url}`)

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    })

    const page = await browser.newPage()

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.PUPPETEER_TIMEOUT
    })

    // Wait a bit for JavaScript to render
    await sleep(2000)

    // Save HTML for debugging (optional)
    if (process.env.DEBUG_HTML) {
      const html = await page.content()
      const debugPath = path.join(__dirname, `../data/debug_${imdbId}.html`)
      await fs.writeFile(debugPath, html)
      console.log(`  💾 Saved HTML for debugging: debug_${imdbId}.html`)
    }

    // Extract locations - look for embedded JSON data
    const locations = await page.evaluate(() => {
      const results: { place: string; details: string }[] = []

      // IMDb embeds the data in a JSON object within a script tag
      // Look for the filmingLocations JSON data
      const scriptTags = document.querySelectorAll('script[type="application/json"]')

      for (const script of Array.from(scriptTags)) {
        try {
          const jsonData = JSON.parse(script.textContent || '')

          // Navigate the JSON structure to find filming locations
          if (jsonData?.props?.pageProps?.contentData?.categories) {
            const categories = jsonData.props.pageProps.contentData.categories

            for (const category of categories) {
              if (category.id === 'flmg_locations' && category.section?.items) {
                // Found the filming locations!
                for (const item of category.section.items) {
                  if (item.cardText) {
                    results.push({
                      place: item.cardText,
                      details: item.attributes || ''
                    })
                  }
                }
              }
            }
          }

          // Also try alternative JSON structure
          if (jsonData?.filmingLocations?.edges) {
            for (const edge of jsonData.filmingLocations.edges) {
              if (edge.node?.location) {
                results.push({
                  place: edge.node.location,
                  details: edge.node.displayableProperty?.qualifiersInMarkdownList
                    ?.map((q: any) => q.markdown)
                    .join(', ') || ''
                })
              }
            }
          }

        } catch (e) {
          // Not valid JSON or wrong structure, continue
        }
      }

      // If we found locations via JSON, return them
      if (results.length > 0) {
        return results
      }

      // Fallback: Try scraping HTML structure (old method)
      const mainContent = document.querySelector('main') || document.body
      const locationSections = mainContent.querySelectorAll('section')

      for (const section of Array.from(locationSections)) {
        const sectionText = section.textContent || ''

        if (sectionText.includes('Filming') || sectionText.includes('Location')) {
          const listItems = section.querySelectorAll('li')

          for (const li of Array.from(listItems)) {
            const text = li.textContent?.trim() || ''
            if (text.length > 10 &&
                !text.includes('Cast & crew') &&
                !text.includes('User reviews') &&
                !text.includes('Trivia') &&
                !text.includes('Learn more') &&
                !text.includes('IMDbPro') &&
                !text.includes('See full') &&
                !text.includes('All topics')) {
              results.push({ place: text, details: '' })
            }
          }
        }
      }

      return results
    })

    await browser.close()

    if (locations.length > 0) {
      console.log(`  ✅ Scraped ${locations.length} locations from IMDb`)
      await setCache(cacheKey, locations)
      return locations
    } else {
      console.log(`  ⚠️  No locations found on IMDb`)
      return []
    }

  } catch (error: any) {
    if (browser) await browser.close()
    console.error(`  ❌ IMDb scraping failed: ${error.message}`)
    return []
  }
}

// ============================================================================
// Wikipedia Fallback
// ============================================================================

async function scrapeWikipediaLocations(title: string, year: number): Promise<ScrapedLocation[]> {
  const cacheKey = `wikipedia_${title.replace(/\s+/g, '_')}_${year}`
  const cached = await getCached<ScrapedLocation[]>(cacheKey)
  if (cached) {
    console.log(`  💾 Using cached Wikipedia data`)
    return cached
  }

  try {
    console.log(`  📚 Trying Wikipedia fallback...`)

    // Search for the Wikipedia page
    const searchUrl = 'https://en.wikipedia.org/w/api.php'
    const searchResponse = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${title} ${year} film`,
        format: 'json',
        srlimit: 1
      }
    })

    if (searchResponse.data.query.search.length === 0) {
      console.log(`  ℹ️  No Wikipedia page found`)
      return []
    }

    const pageTitle = searchResponse.data.query.search[0].title

    // Get page content
    const contentResponse = await axios.get(searchUrl, {
      params: {
        action: 'query',
        prop: 'extracts',
        titles: pageTitle,
        format: 'json',
        explaintext: true
      }
    })

    const pages = contentResponse.data.query.pages
    const pageId = Object.keys(pages)[0]
    const content = pages[pageId]?.extract || ''

    // Look for filming section
    const productionMatch = content.match(/(?:Production|Filming|Principal photography)[\s\S]{0,2000}/i)

    if (!productionMatch) {
      console.log(`  ℹ️  No filming section found in Wikipedia`)
      return []
    }

    const productionText = productionMatch[0]

    // Extract location mentions (simple regex - finds city, state/country patterns)
    const locationRegex = /(?:filmed|shot|took place|location[s]?|set)\s+(?:in|at|on)\s+([A-Z][a-zA-Z\s,]+(?:,\s*[A-Z][a-zA-Z\s]+)?)/gi
    const matches = [...productionText.matchAll(locationRegex)]

    const locations: ScrapedLocation[] = []
    const seen = new Set<string>()

    matches.forEach(match => {
      const place = match[1].trim().replace(/\.$/, '')
      if (place.length > 3 && !seen.has(place)) {
        seen.add(place)
        locations.push({ place, details: '' })
      }
    })

    if (locations.length > 0) {
      console.log(`  ✅ Found ${locations.length} locations from Wikipedia`)
      await setCache(cacheKey, locations)
    }

    await sleep(500) // Be nice to Wikipedia
    return locations

  } catch (error: any) {
    console.error(`  ❌ Wikipedia scraping failed: ${error.message}`)
    return []
  }
}

// ============================================================================
// Geocoding
// ============================================================================

async function geocodeLocation(locationName: string): Promise<{ lat: number; lng: number; city: string; country: string } | null> {
  const cacheKey = `geocode_${locationName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  try {
    const response = await axios.get(`${CONFIG.NOMINATIM_BASE_URL}/search`, {
      params: {
        q: locationName,
        format: 'json',
        limit: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'CineMap/1.0 (Movie Filming Location Mapper)'
      }
    })

    if (response.data.length === 0) {
      return null
    }

    const result = response.data[0]
    const address = result.address || {}

    const geocoded = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      city: address.city || address.town || address.village || address.county || locationName,
      country: address.country || ''
    }

    await setCache(cacheKey, geocoded)
    await sleep(CONFIG.RATE_LIMIT_DELAY) // Nominatim requires 1 req/sec
    return geocoded

  } catch (error: any) {
    console.error(`  ❌ Geocoding failed for "${locationName}": ${error.message}`)
    return null
  }
}

// ============================================================================
// Main Processing
// ============================================================================

async function processMovie(input: InputMovie, index: number, total: number): Promise<Movie | null> {
  try {
    console.log(`\n[${index + 1}/${total}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // Get TMDb ID
    let tmdbId = input.tmdb_id
    const imdbId = input.imdb_id || ''

    if (!tmdbId && imdbId) {
      console.log(`  🔍 Finding TMDb ID for ${imdbId}...`)
      tmdbId = await findTmdbId(imdbId)
      if (!tmdbId) {
        console.error(`  ❌ Could not find TMDb ID`)
        return null
      }
    }

    if (!tmdbId) {
      console.error(`  ❌ No TMDb ID available`)
      return null
    }

    // Fetch TMDb data
    console.log(`  📊 Fetching TMDb data...`)
    const tmdbData = await fetchTmdbMovie(tmdbId)

    const movieId = imdbId || tmdbData.external_ids?.imdb_id || `tmdb_${tmdbId}`
    const title = tmdbData.title
    const year = parseInt(tmdbData.release_date?.split('-')[0] || '0')

    console.log(`\n  🎬 ${title} (${year})`)
    console.log(`  📍 IMDb: ${movieId}`)

    // Scrape IMDb locations
    let scrapedLocations = await scrapeIMDbLocations(movieId)

    // Fallback to Wikipedia if IMDb has no data
    if (scrapedLocations.length === 0) {
      console.log(`  🔄 IMDb empty, trying Wikipedia...`)
      scrapedLocations = await scrapeWikipediaLocations(title, year)
    }

    if (scrapedLocations.length === 0) {
      console.log(`  ⚠️  No locations found anywhere, skipping`)
      // Still save the movie with empty locations
      return {
        movie_id: movieId,
        title,
        original_title: tmdbData.original_title,
        year,
        imdb_id: movieId,
        tmdb_id: tmdbId,
        genres: tmdbData.genres?.map((g: any) => g.name) || [],
        poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : '',
        trailer: extractTrailerId(tmdbData.videos) || '',
        imdb_rating: tmdbData.vote_average || 0,
        locations: []
      }
    }

    // Display scraped locations
    console.log(`\n  📍 Found ${scrapedLocations.length} locations:`)
    scrapedLocations.slice(0, 5).forEach(loc => {
      console.log(`     - ${loc.place}`)
    })
    if (scrapedLocations.length > 5) {
      console.log(`     ... and ${scrapedLocations.length - 5} more`)
    }

    // Geocode each location
    console.log(`\n  🌍 Geocoding locations...`)
    const locations: Location[] = []

    for (const scraped of scrapedLocations) {
      const geocoded = await geocodeLocation(scraped.place)

      if (geocoded) {
        locations.push({
          lat: geocoded.lat,
          lng: geocoded.lng,
          city: geocoded.city,
          country: geocoded.country,
          description: scraped.place
        })
        console.log(`     ✅ ${geocoded.city}, ${geocoded.country}`)
      } else {
        console.log(`     ❌ Failed: ${scraped.place}`)
      }
    }

    console.log(`\n  ✅ Successfully geocoded ${locations.length}/${scrapedLocations.length} locations`)

    // Deduplicate locations by coordinates (some movies have same location listed multiple times)
    const deduplicatedLocations = deduplicateLocationsByCoordinates(locations)
    if (deduplicatedLocations.length < locations.length) {
      console.log(`  🔧 Removed ${locations.length - deduplicatedLocations.length} duplicate location(s)`)
    }

    return {
      movie_id: movieId,
      title,
      original_title: tmdbData.original_title,
      year,
      imdb_id: movieId,
      tmdb_id: tmdbId,
      genres: tmdbData.genres?.map((g: any) => g.name) || [],
      poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : '',
      trailer: extractTrailerId(tmdbData.videos) || '',
      imdb_rating: tmdbData.vote_average || 0,
      locations: deduplicatedLocations
    }

  } catch (error: any) {
    console.error(`\n  ❌ Failed to process movie: ${error.message}`)
    return null
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('\n🎬 CineMap Automated Location Fetcher')
  console.log('=====================================\n')
  console.log('This will:')
  console.log('  1. Fetch movie data from TMDb')
  console.log('  2. Scrape locations from IMDb (with Puppeteer)')
  console.log('  3. Fall back to Wikipedia if needed')
  console.log('  4. Geocode all locations')
  console.log('  5. Save progress continuously\n')

  // Validate API key
  if (!CONFIG.TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY environment variable is required!')
    process.exit(1)
  }

  // Load input file
  const inputPath = path.join(__dirname, `../${CONFIG.INPUT_FILE}`)
  console.log(`📂 Reading: ${CONFIG.INPUT_FILE}`)
  const inputData = await fs.readFile(inputPath, 'utf-8')
  const inputMovies: InputMovie[] = JSON.parse(inputData)

  console.log(`📋 Loaded ${inputMovies.length} movies to process`)

  // Load existing enriched movies to check for duplicates
  const outputPath = path.join(__dirname, `../${CONFIG.OUTPUT_FILE}`)
  let existingMovies: Movie[] = []
  try {
    const existingData = await fs.readFile(outputPath, 'utf-8')
    existingMovies = JSON.parse(existingData)
    console.log(`🔍 Found ${existingMovies.length} existing movies in database`)
  } catch (error) {
    console.log(`📝 No existing database found - starting fresh`)
  }

  // Create Set of existing IMDb IDs for fast lookup
  const existingImdbIds = new Set(
    existingMovies.map(m => m.imdb_id).filter((id): id is string => !!id)
  )
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  const movies: Movie[] = [...existingMovies] // Start with existing movies
  let successCount = 0
  let failCount = 0
  let skippedCount = 0

  for (let i = 0; i < inputMovies.length; i++) {
    const inputMovie = inputMovies[i]
    const imdb_id = inputMovie.imdb_id

    // Check for duplicates
    if (imdb_id && existingImdbIds.has(imdb_id)) {
      console.log(`⏭️  [${i + 1}/${inputMovies.length}] Skipping ${imdb_id} - already in database`)
      skippedCount++
      continue
    }

    const movie = await processMovie(inputMovie, i, inputMovies.length)

    if (movie) {
      movies.push(movie)
      if (movie.imdb_id) {
        existingImdbIds.add(movie.imdb_id) // Add to Set to prevent duplicates within this run
      }
      successCount++
    } else {
      failCount++
    }

    // Save progress after each movie
    const progressPath = path.join(__dirname, `../${CONFIG.PROGRESS_FILE}`)
    await fs.writeFile(progressPath, JSON.stringify(movies, null, 2))
  }

  // Save final result
  await fs.writeFile(outputPath, JSON.stringify(movies, null, 2))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n✅ Processing Complete!')
  console.log(`\n📊 Statistics:`)
  console.log(`   Input movies: ${inputMovies.length}`)
  console.log(`   Skipped (already in database): ${skippedCount}`)
  console.log(`   Newly processed: ${successCount}`)
  console.log(`   Failed: ${failCount}`)
  console.log(`   Total in database: ${movies.length}`)
  console.log(`\n💾 Output saved to:`)
  console.log(`   ${outputPath}`)
  console.log(`\n📌 Next steps:`)
  console.log(`   1. Review ${CONFIG.OUTPUT_FILE}`)
  console.log(`   2. If satisfied, replace movies_enriched.json with this file`)
  console.log(`   3. Run: npm run transform:geojson`)
  console.log(`   4. Restart your dev server\n`)
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
