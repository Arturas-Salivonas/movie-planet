#!/usr/bin/env tsx

import * as fs from 'fs'
import * as path from 'path'

interface Location {
  lat: number
  lng: number
  display_name?: string
  scene_description?: string
}

interface Movie {
  movie_id: string
  title: string
  locations?: Location[]
  [key: string]: any
}

/**
 * Check if a location is valid and should be kept
 */
function isValidLocation(location: Location): boolean {
  // Must have coordinates
  if (!location.lat || !location.lng) {
    return false
  }

  // Check for invalid coordinates (0,0 or near 0,0)
  if (Math.abs(location.lat) < 0.01 && Math.abs(location.lng) < 0.01) {
    return false
  }

  // Check for suspicious Antarctica coordinates (often used as placeholder)
  // Latitude around -72.84 with longitude 0 is a common placeholder
  if (location.lat < -72 && Math.abs(location.lng) < 1) {
    return false
  }

  // Must have a valid display_name
  if (!location.display_name || location.display_name.trim() === '') {
    return false
  }

  // Check for invalid display_name values
  const displayNameLower = location.display_name.toLowerCase()
  const invalidPatterns = [
    'undefined',
    'unknown',
    'null',
    ', undefined',
    'undefined,',
  ]

  for (const pattern of invalidPatterns) {
    if (displayNameLower.includes(pattern)) {
      return false
    }
  }

  // Check for display_name that's just punctuation or whitespace
  if (location.display_name.replace(/[,\s-]/g, '').length === 0) {
    return false
  }

  return true
}

/**
 * Clean invalid locations from movie data
 */
async function cleanInvalidLocations() {
  console.log('🧹 Cleaning invalid locations from movie data...\n')

  // Clean the SOURCE file in data/ (not public/data/)
  // The build process copies from data/ to public/data/
  const inputPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
  const outputPath = inputPath // Overwrite the original file
  const backupPath = path.join(process.cwd(), 'data', 'movies_enriched.backup.json')

  // Read the movie data
  console.log('📖 Reading movie data...')
  const moviesData: Movie[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  console.log(`   Found ${moviesData.length} movies\n`)

  // Create backup
  console.log('💾 Creating backup...')
  fs.copyFileSync(inputPath, backupPath)
  console.log(`   Backup saved to: ${backupPath}\n`)

  // Statistics
  let moviesWithInvalidLocations = 0
  let totalInvalidLocations = 0
  let totalValidLocations = 0
  const affectedMovies: { title: string; removed: number; remaining: number }[] = []

  // Clean each movie
  console.log('🔍 Analyzing locations...\n')

  for (const movie of moviesData) {
    if (!movie.locations || movie.locations.length === 0) {
      continue
    }

    const originalCount = movie.locations.length
    const validLocations = movie.locations.filter(isValidLocation)
    const invalidCount = originalCount - validLocations.length

    if (invalidCount > 0) {
      moviesWithInvalidLocations++
      totalInvalidLocations += invalidCount
      affectedMovies.push({
        title: movie.title,
        removed: invalidCount,
        remaining: validLocations.length,
      })

      // Show examples of what's being removed
      if (affectedMovies.length <= 5) {
        console.log(`❌ ${movie.title}:`)
        console.log(`   Removing ${invalidCount} invalid location(s):`)
        movie.locations
          .filter(l => !isValidLocation(l))
          .slice(0, 3)
          .forEach(l => {
            console.log(`   - ${l.display_name || 'NO DISPLAY NAME'} (${l.lat}, ${l.lng})`)
          })
        console.log(`   Keeping ${validLocations.length} valid location(s)\n`)
      }
    }

    totalValidLocations += validLocations.length
    movie.locations = validLocations
  }

  // Show summary
  console.log('\n📊 Summary:')
  console.log(`   Total movies: ${moviesData.length}`)
  console.log(`   Movies with invalid locations: ${moviesWithInvalidLocations}`)
  console.log(`   Total invalid locations removed: ${totalInvalidLocations}`)
  console.log(`   Total valid locations kept: ${totalValidLocations}`)
  console.log()

  if (affectedMovies.length > 5) {
    console.log(`📋 Affected movies (showing first 10 of ${affectedMovies.length}):`)
    affectedMovies.slice(0, 10).forEach(m => {
      console.log(`   - ${m.title}: removed ${m.removed}, kept ${m.remaining}`)
    })
    console.log()
  }

  // Save cleaned data
  console.log('💾 Saving cleaned data...')
  fs.writeFileSync(outputPath, JSON.stringify(moviesData, null, 2), 'utf-8')
  console.log(`   Saved to: ${outputPath}`)

  const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2)
  console.log(`   File size: ${fileSizeKB} KB\n`)

  console.log('✅ Cleaning complete!')
  console.log('\n💡 Note: A backup was created at movies_enriched.backup.json')
  console.log('   If you need to restore, run: npm run restore:backup\n')
}

// Run the script
cleanInvalidLocations().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
