/**
 * Reverse Geocode Locations Script
 *
 * Enhances movie locations with full addresses from Nominatim API
 * - Fetches display_name for coordinates
 * - Removes redundant fields (city, country, description)
 * - Keeps only: lat, lng, display_name, scene_description
 * - Caches all API results
 * - Rate limited to 1.1s per request
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse'
const RATE_LIMIT_MS = 1100 // 1.1 seconds between requests
const CACHE_DIR = path.join(__dirname, '../data/cache/reverse_geocode')
const MOVIES_ENRICHED_PATH = path.join(__dirname, '../data/movies_enriched.json')
const DATA_DIR = path.join(__dirname, '../data')

// Statistics
let stats = {
  total: 0,
  processed: 0,
  cached: 0,
  apiCalls: 0,
  errors: 0,
  cleaned: 0
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create cache directory if it doesn't exist
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (error) {
    // Directory already exists
  }
}

/**
 * Get cache file path for coordinates
 */
function getCachePath(lat: number, lng: number): string {
  const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`
  return path.join(CACHE_DIR, `${key}.json`)
}

/**
 * Check if location is already cached
 */
async function getCached(lat: number, lng: number): Promise<string | null> {
  try {
    const cachePath = getCachePath(lat, lng)
    const data = await fs.readFile(cachePath, 'utf-8')
    const cached = JSON.parse(data)
    stats.cached++
    return cached.display_name
  } catch (error) {
    return null
  }
}

/**
 * Save to cache
 */
async function saveToCache(lat: number, lng: number, displayName: string): Promise<void> {
  const cachePath = getCachePath(lat, lng)
  await fs.writeFile(cachePath, JSON.stringify({
    lat,
    lng,
    display_name: displayName,
    cached_at: new Date().toISOString()
  }, null, 2))
}

/**
 * Fetch display name from Nominatim API
 */
async function fetchDisplayName(lat: number, lng: number): Promise<string | null> {
  try {
    // Check cache first
    const cached = await getCached(lat, lng)
    if (cached) {
      return cached
    }

    // Make API call
    const url = `${NOMINATIM_API}?format=json&lat=${lat}&lon=${lng}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FilmingMap.com (contact@filmingmap.com)'
      }
    })

    if (!response.ok) {
      console.error(`❌ API error for ${lat}, ${lng}: ${response.status}`)
      stats.errors++
      return null
    }

    const data = await response.json()
    const displayName = data.display_name

    if (displayName) {
      // Save to cache
      await saveToCache(lat, lng, displayName)
      stats.apiCalls++
      return displayName
    }

    stats.errors++
    return null
  } catch (error) {
    console.error(`❌ Error fetching ${lat}, ${lng}:`, error)
    stats.errors++
    return null
  }
}

/**
 * Clean location object - keep only essential fields
 */
function cleanLocation(location: any, displayName: string | null): any {
  const cleaned: any = {
    lat: location.lat,
    lng: location.lng
  }

  // Add display_name if we have it
  if (displayName) {
    cleaned.display_name = displayName
  }

  // Keep scene_description if it exists
  if (location.scene_description) {
    cleaned.scene_description = location.scene_description
  }

  // Mark that we cleaned this location
  if (location.city || location.country || location.description) {
    stats.cleaned++
  }

  return cleaned
}

/**
 * Process a single movie's locations
 */
async function processMovie(movie: any, limit?: number): Promise<any> {
  if (!movie.locations || movie.locations.length === 0) {
    return movie
  }

  const locationsToProcess = limit ? movie.locations.slice(0, limit) : movie.locations
  const processedLocations = []

  for (const location of locationsToProcess) {
    stats.total++

    // Skip if already has display_name
    if (location.display_name) {
      processedLocations.push(cleanLocation(location, location.display_name))
      stats.processed++
      continue
    }

    // Fetch display_name
    console.log(`  📍 Processing: ${location.lat}, ${location.lng}`)
    const displayName = await fetchDisplayName(location.lat, location.lng)

    // Clean and add location
    processedLocations.push(cleanLocation(location, displayName))
    stats.processed++

    // Rate limiting - only if we made an API call
    if (displayName && !await getCached(location.lat, location.lng)) {
      await sleep(RATE_LIMIT_MS)
    }
  }

  // If we limited, keep the rest of locations unchanged
  if (limit && movie.locations.length > limit) {
    processedLocations.push(...movie.locations.slice(limit))
  }

  return {
    ...movie,
    locations: processedLocations
  }
}

/**
 * Process movies_enriched.json file
 */
async function processMoviesEnriched(testMode: boolean = false, testLimit: number = 20): Promise<void> {
  console.log('📖 Reading movies_enriched.json file...')
  const moviesData = await fs.readFile(MOVIES_ENRICHED_PATH, 'utf-8')
  const movies = JSON.parse(moviesData)

  console.log(`📊 Total movies: ${movies.length}`)

  // In test mode, only process specified number of movies
  const moviesToProcess = testMode ? movies.slice(0, testLimit) : movies

  console.log(testMode
    ? `🧪 TEST MODE: Processing first ${testLimit} movies...`
    : '🚀 Processing all movies...'
  )

  for (let i = 0; i < moviesToProcess.length; i++) {
    const movie = moviesToProcess[i]

    console.log(`\n[${i + 1}/${moviesToProcess.length}] 🎬 ${movie.title} (${movie.year})`)

    if (!movie.locations || movie.locations.length === 0) {
      console.log('  ⏭️  No locations, skipping...')
      continue
    }

    // Process movie locations (process all locations even in test mode)
    const processedMovie = await processMovie(movie)
    movies[moviesToProcess.indexOf(movie)] = processedMovie
  }

  // Save updated movies_enriched.json
  console.log('\n💾 Saving updated movies_enriched.json...')
  await fs.writeFile(MOVIES_ENRICHED_PATH, JSON.stringify(movies, null, 2))

  console.log('✅ movies_enriched.json updated successfully!')
}

/**
 * Update location-specific JSON files
 */
async function updateLocationFiles(): Promise<void> {
  console.log('\n📂 Updating location JSON files...')

  const files = await fs.readdir(DATA_DIR)
  const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))

  console.log(`📊 Found ${locationFiles.length} location files`)

  for (const file of locationFiles) {
    const filePath = path.join(DATA_DIR, file)
    const data = await fs.readFile(filePath, 'utf-8')
    const locationData = JSON.parse(data)

    if (!locationData.movies || locationData.movies.length === 0) {
      continue
    }

    let updated = false

    for (const movie of locationData.movies) {
      if (!movie.locations || movie.locations.length === 0) {
        continue
      }

      for (let i = 0; i < movie.locations.length; i++) {
        const location = movie.locations[i]

        // Skip if already has display_name
        if (location.display_name) {
          movie.locations[i] = cleanLocation(location, location.display_name)
          continue
        }

        // Fetch display_name
        const displayName = await fetchDisplayName(location.lat, location.lng)
        movie.locations[i] = cleanLocation(location, displayName)
        updated = true

        // Rate limiting
        if (displayName && !await getCached(location.lat, location.lng)) {
          await sleep(RATE_LIMIT_MS)
        }
      }
    }

    // Save if updated
    if (updated) {
      await fs.writeFile(filePath, JSON.stringify(locationData, null, 2))
      console.log(`  ✅ Updated: ${file}`)
    }
  }

  console.log('✅ Location files updated!')
}

/**
 * Print statistics
 */
function printStats(): void {
  console.log('\n' + '='.repeat(60))
  console.log('📊 REVERSE GEOCODING STATISTICS')
  console.log('='.repeat(60))
  console.log(`Total locations:      ${stats.total}`)
  console.log(`Processed:            ${stats.processed}`)
  console.log(`From cache:           ${stats.cached}`)
  console.log(`API calls made:       ${stats.apiCalls}`)
  console.log(`Fields cleaned:       ${stats.cleaned}`)
  console.log(`Errors:               ${stats.errors}`)
  console.log('='.repeat(60))
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const testMode = args.includes('--test')
  const testLimit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '20')

  console.log('🚀 Starting Reverse Geocoding Script')
  console.log('=' .repeat(60))

  if (testMode) {
    console.log(`🧪 TEST MODE: Processing first ${testLimit} movies`)
  }

  console.log('')

  // Ensure cache directory exists
  await ensureCacheDir()

  // Process movies_enriched.json
  await processMoviesEnriched(testMode, testLimit)

  // Update location files (skip in test mode)
  if (!testMode) {
    await updateLocationFiles()
  }

  // Print statistics
  printStats()

  console.log('\n✅ All done!')
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
