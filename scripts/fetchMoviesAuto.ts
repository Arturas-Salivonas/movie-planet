/**
 * Automated Movie Location Fetcher
 *
 * This script:
 * 1. Fetches movie metadata from TMDb
 * 2. Scrapes filming locations from IMDb using Puppeteer
 * 3. Geocodes all locations using Nominatim
 * 4. Caches everything to avoid re-fetching
 * 5. Only saves movies with actual IMDb filming locations
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
  type: 'movie' | 'tv'
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
  OUTPUT_FILE: 'data/movies_enriched.json',
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

async function findTmdbId(imdbId: string): Promise<{ tmdb_id: number; type: 'movie' | 'tv' } | null> {
  const cacheKey = `tmdb_find_${imdbId}`
  const cached = await getCached<{ tmdb_id: number; type: 'movie' | 'tv' }>(cacheKey)
  if (cached) return cached

  try {
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/find/${imdbId}`, {
      params: {
        api_key: CONFIG.TMDB_API_KEY,
        external_source: 'imdb_id',
      },
    })

    // Check for movies first
    const movieId = response.data.movie_results?.[0]?.id
    if (movieId) {
      const result = { tmdb_id: movieId, type: 'movie' as const }
      await setCache(cacheKey, result)
      return result
    }

    // Check for TV shows
    const tvId = response.data.tv_results?.[0]?.id
    if (tvId) {
      const result = { tmdb_id: tvId, type: 'tv' as const }
      await setCache(cacheKey, result)
      return result
    }
  } catch (error: any) {
    console.error(`  ❌ TMDb find failed: ${error.message}`)
  }

  return null
}

async function fetchTmdbMovie(tmdbId: number, type: 'movie' | 'tv' = 'movie'): Promise<any> {
  const cacheKey = `tmdb_${type}_${tmdbId}`
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  try {
    const endpoint = type === 'tv' ? 'tv' : 'movie'
    const response = await axios.get(`${CONFIG.TMDB_BASE_URL}/${endpoint}/${tmdbId}`, {
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
        'User-Agent': 'filmingmap/1.0 (Movie Filming Location Mapper)'
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
    let contentType: 'movie' | 'tv' = 'movie'
    const imdbId = input.imdb_id || ''

    if (!tmdbId && imdbId) {
      console.log(`  🔍 Finding TMDb ID for ${imdbId}...`)
      const foundResult = await findTmdbId(imdbId)
      if (!foundResult) {
        console.error(`  ❌ Could not find TMDb ID`)
        return null
      }
      tmdbId = foundResult.tmdb_id
      contentType = foundResult.type
      console.log(`  ✓ Found as ${contentType === 'tv' ? 'TV Show' : 'Movie'}: ${tmdbId}`)
    }

    if (!tmdbId) {
      console.error(`  ❌ No TMDb ID available`)
      return null
    }

    // Fetch TMDb data
    console.log(`  📊 Fetching TMDb data...`)
    const tmdbData = await fetchTmdbMovie(tmdbId, contentType)

    const movieId = imdbId || tmdbData.external_ids?.imdb_id || `tmdb_${tmdbId}`
    const title = tmdbData.title || tmdbData.name
    const year = parseInt((tmdbData.release_date || tmdbData.first_air_date)?.split('-')[0] || '0')

    console.log(`\n  🎬 ${title} (${year})`)
    console.log(`  📍 IMDb: ${movieId}`)

    // Scrape IMDb locations (ONLY - no fallbacks)
    const scrapedLocations = await scrapeIMDbLocations(movieId)

    if (scrapedLocations.length === 0) {
      console.log(`  ⚠️  No filming locations found on IMDb, skipping`)
      // Don't save movies without IMDb filming locations
      return null
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
      type: contentType,
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
  console.log('\n🎬 filmingmap Automated Location Fetcher')
  console.log('=====================================\n')
  console.log('This will:')
  console.log('  1. Fetch movie/TV data from TMDb')
  console.log('  2. Scrape filming locations from IMDb (with Puppeteer)')
  console.log('  3. Geocode all locations with Nominatim')
  console.log('  4. Save progress continuously to movies_enriched.json\n')
  console.log('⚠️  WARNING: This will modify movies_enriched.json')
  console.log('    Progress is saved after each movie to prevent data loss\n')

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

  // Create Map of existing movies for location checking
  const existingMoviesMap = new Map(
    existingMovies.map(m => [m.imdb_id, m])
  )

  // Create Set of existing IMDb IDs for fast lookup
  const existingImdbIds = new Set(
    existingMovies.map(m => m.imdb_id).filter((id): id is string => !!id)
  )
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  // ✅ FIX: Start with ALL existing movies, then add new ones (never overwrite!)
  const movies: Movie[] = [...existingMovies]
  const processedIds = new Set<string>(existingMovies.map(m => m.imdb_id).filter((id): id is string => !!id))
  let successCount = 0
  let failCount = 0
  let skippedCount = 0

  for (let i = 0; i < inputMovies.length; i++) {
    const inputMovie = inputMovies[i]
    const imdb_id = inputMovie.imdb_id

    // Check for duplicates - skip if already exists AND has locations
    if (imdb_id && existingImdbIds.has(imdb_id)) {
      const existingMovie = existingMoviesMap.get(imdb_id)
      if (existingMovie && existingMovie.locations && existingMovie.locations.length > 0) {
        console.log(`⏭️  [${i + 1}/${inputMovies.length}] Skipping ${imdb_id} - already in database with locations`)
        // Already in movies array from initialization
        skippedCount++
        continue
      }
      // If it exists but has no locations, re-process it
      console.log(`🔄 [${i + 1}/${inputMovies.length}] Re-processing ${imdb_id} - exists but no locations found`)
    }

    const movie = await processMovie(inputMovie, i, inputMovies.length)

    if (movie) {
      if (movie.imdb_id) {
        if (processedIds.has(movie.imdb_id)) {
          // Update existing movie (replace old entry that had no locations)
          const index = movies.findIndex(m => m.imdb_id === movie.imdb_id)
          if (index !== -1) {
            movies[index] = movie
            console.log(`  ✅ Updated existing movie with new data`)
          }
        } else {
          // Add new movie
          movies.push(movie)
          processedIds.add(movie.imdb_id)
        }
        successCount++
      }
    } else {
      failCount++
    }

    // Save progress after each movie (directly to main file)
    await fs.writeFile(outputPath, JSON.stringify(movies, null, 2))
  }

  // Final save (already saved in loop, but do it one more time for consistency)
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
  console.log(`   1. Run: npm run transform:geojson`)
  console.log(`   2. Run: npm run build`)
  console.log(`   3. Restart your dev server\n`)
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
