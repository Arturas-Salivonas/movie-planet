/**
 * Clean Duplicate Locations
 *
 * This script removes duplicate locations from movies_enriched.json
 * Duplicates are identified by having identical coordinates (rounded to 4 decimal places)
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Location {
  lat: number
  lng: number
  city: string
  country: string
  description?: string
}

interface Movie {
  movie_id: string
  title: string
  year: number
  locations: Location[]
  [key: string]: any
}

/**
 * Deduplicate locations by coordinates
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

async function main() {
  console.log('\n🔧 CineMap - Clean Duplicate Locations')
  console.log('=======================================\n')

  const enrichedPath = path.join(__dirname, '../data/movies_enriched.json')

  // Load data
  console.log('📂 Loading movies_enriched.json...')
  const data = await fs.readFile(enrichedPath, 'utf-8')
  const movies: Movie[] = JSON.parse(data)
  console.log(`✓ Loaded ${movies.length} movies\n`)

  // Process each movie
  let totalDuplicatesRemoved = 0
  let moviesWithDuplicates = 0

  console.log('🔍 Scanning for duplicate locations...\n')

  const cleanedMovies = movies.map(movie => {
    const originalCount = movie.locations.length
    const deduplicated = deduplicateLocationsByCoordinates(movie.locations)
    const duplicatesCount = originalCount - deduplicated.length

    if (duplicatesCount > 0) {
      moviesWithDuplicates++
      totalDuplicatesRemoved += duplicatesCount
      console.log(`  🔧 ${movie.title} (${movie.year})`)
      console.log(`     Locations: ${originalCount} → ${deduplicated.length} (removed ${duplicatesCount} duplicate${duplicatesCount > 1 ? 's' : ''})`)
    }

    return {
      ...movie,
      locations: deduplicated
    }
  })

  // Save cleaned data
  if (totalDuplicatesRemoved > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n📊 Summary:')
    console.log(`   Total movies: ${movies.length}`)
    console.log(`   Movies with duplicates: ${moviesWithDuplicates}`)
    console.log(`   Total duplicates removed: ${totalDuplicatesRemoved}`)

    // Create backup
    const backupPath = path.join(__dirname, '../data/movies_enriched_backup_before_dedup.json')
    console.log(`\n💾 Creating backup: movies_enriched_backup_before_dedup.json`)
    await fs.writeFile(backupPath, data)

    // Save cleaned data
    console.log(`💾 Saving cleaned data: movies_enriched.json`)
    await fs.writeFile(enrichedPath, JSON.stringify(cleanedMovies, null, 2))

    console.log('\n✅ Done! Duplicate locations have been removed.')
    console.log('🔄 Next step: Run `npm run transform:geojson` to regenerate the map\n')
  } else {
    console.log('\n✅ No duplicate locations found! Your data is already clean.\n')
  }
}

main().catch(error => {
  console.error('\n💥 Error:', error)
  process.exit(1)
})
