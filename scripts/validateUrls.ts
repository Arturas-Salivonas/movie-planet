/**
 * Validate all location and movie URLs to check for 404 errors
 * Reports count and list of broken URLs
 */

import * as fs from 'fs'
import * as path from 'path'

interface ValidationResult {
  url: string
  type: 'location' | 'movie'
  status: 'valid' | 'broken'
  reason?: string
}

async function validateUrls() {
  console.log('🔍 Validating all URLs for 404 errors...\n')

  const dataDir = path.join(process.cwd(), 'data')
  const results: ValidationResult[] = []

  // Validate location URLs
  console.log('📍 Checking location URLs...')
  const locationFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('location_') && f.endsWith('.json'))

  for (const file of locationFiles) {
    const filePath = path.join(dataDir, file)

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const slug = content.location?.slug

      if (!slug) {
        results.push({
          url: `/location/${file.replace('location_', '').replace('.json', '')}`,
          type: 'location',
          status: 'broken',
          reason: 'Missing slug in location data'
        })
        continue
      }

      // Check if slug matches filename
      const expectedFilename = `location_${slug}.json`
      if (file !== expectedFilename) {
        results.push({
          url: `/location/${slug}`,
          type: 'location',
          status: 'broken',
          reason: `File mismatch: expected ${expectedFilename}, got ${file}`
        })
        continue
      }

      // Validate location data structure
      if (!content.location.city || !content.location.country) {
        results.push({
          url: `/location/${slug}`,
          type: 'location',
          status: 'broken',
          reason: 'Missing city or country in location data'
        })
        continue
      }

      results.push({
        url: `/location/${slug}`,
        type: 'location',
        status: 'valid'
      })
    } catch (error) {
      results.push({
        url: `/location/${file.replace('location_', '').replace('.json', '')}`,
        type: 'location',
        status: 'broken',
        reason: `Failed to parse JSON: ${error}`
      })
    }
  }

  // Validate movie URLs
  console.log('🎬 Checking movie URLs...')
  const moviesPath = path.join(dataDir, 'movies_enriched.json')
  const slugsReversePath = path.join(dataDir, 'movies_slugs_reverse.json')

  try {
    const movies = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

    // Load slugs mapping (movie_id -> slug)
    let slugsMap: Record<string, string> = {}
    if (fs.existsSync(slugsReversePath)) {
      slugsMap = JSON.parse(fs.readFileSync(slugsReversePath, 'utf-8'))
    }

    // Create a set of movie IDs that exist in movies_enriched.json
    const existingMovieIds = new Set(movies.map((m: any) => m.movie_id))

    // Check for slugs that don't have corresponding movies
    for (const [movieId, slug] of Object.entries(slugsMap)) {
      if (!existingMovieIds.has(movieId)) {
        results.push({
          url: `/movie/${slug}`,
          type: 'movie',
          status: 'broken',
          reason: `Slug exists but movie data missing: ${slug} (${movieId}) - orphaned slug`
        })
      }
    }

    for (const movie of movies) {
      const movieId = movie.movie_id

      // Check if slug exists in either the movie object or slugs file
      const slug = movie.slug || slugsMap[movieId]

      if (!slug) {
        results.push({
          url: `/movie/${movieId || 'unknown'}`,
          type: 'movie',
          status: 'broken',
          reason: `Missing slug for movie: ${movie.title || 'Unknown'} (${movieId})`
        })
        continue
      }

      // Basic validation of movie data structure
      if (!movie.title || !movie.year) {
        // Check if this is in the slugs file but not in movies data
        // This could happen with TV shows or incomplete entries
        if (slugsMap[movieId]) {
          results.push({
            url: `/movie/${slug}`,
            type: 'movie',
            status: 'broken',
            reason: `Incomplete data (missing title or year) for movie: ${slug} (${movieId}) - might be a TV show`
          })
        }
        continue
      }

      results.push({
        url: `/movie/${slug}`,
        type: 'movie',
        status: 'valid'
      })
    }
  } catch (error) {
    console.error(`❌ Failed to load movies data: ${error}`)
  }

  // Check clickable regions match location files
  console.log('🗺️  Checking clickable regions consistency...')
  const geoJSONPath = path.join(process.cwd(), 'public', 'geo', 'clickable-regions.geojson')

  if (fs.existsSync(geoJSONPath)) {
    try {
      const geoJSON = JSON.parse(fs.readFileSync(geoJSONPath, 'utf-8'))
      const locationSlugs = new Set(
        locationFiles.map(f => f.replace('location_', '').replace('.json', ''))
      )

      for (const feature of geoJSON.features || []) {
        const slug = feature.properties?.slug

        if (!slug) {
          results.push({
            url: '/location/unknown',
            type: 'location',
            status: 'broken',
            reason: 'GeoJSON feature missing slug property'
          })
          continue
        }

        if (!locationSlugs.has(slug)) {
          results.push({
            url: `/location/${slug}`,
            type: 'location',
            status: 'broken',
            reason: `GeoJSON references location file that doesn't exist: location_${slug}.json`
          })
        }
      }
    } catch (error) {
      console.error(`❌ Failed to parse clickable-regions.geojson: ${error}`)
    }
  }

  // Generate report
  console.log('\n' + '='.repeat(80))
  console.log('📊 VALIDATION REPORT')
  console.log('='.repeat(80) + '\n')

  const brokenUrls = results.filter(r => r.status === 'broken')
  const validUrls = results.filter(r => r.status === 'valid')

  const brokenLocations = brokenUrls.filter(r => r.type === 'location')
  const brokenMovies = brokenUrls.filter(r => r.type === 'movie')

  console.log(`✅ Valid URLs: ${validUrls.length}`)
  console.log(`   - Locations: ${validUrls.filter(r => r.type === 'location').length}`)
  console.log(`   - Movies: ${validUrls.filter(r => r.type === 'movie').length}`)
  console.log()
  console.log(`❌ Broken URLs: ${brokenUrls.length}`)
  console.log(`   - Locations: ${brokenLocations.length}`)
  console.log(`   - Movies: ${brokenMovies.length}`)

  if (brokenUrls.length > 0) {
    console.log('\n' + '-'.repeat(80))
    console.log('🚨 BROKEN URLS DETAILS')
    console.log('-'.repeat(80) + '\n')

    if (brokenLocations.length > 0) {
      console.log(`📍 Broken Location URLs (${brokenLocations.length}):`)
      brokenLocations.forEach(result => {
        console.log(`   ❌ ${result.url}`)
        console.log(`      → ${result.reason}`)
      })
      console.log()
    }

    if (brokenMovies.length > 0) {
      console.log(`🎬 Broken Movie URLs (${brokenMovies.length}):`)
      brokenMovies.slice(0, 20).forEach(result => {
        console.log(`   ❌ ${result.url}`)
        console.log(`      → ${result.reason}`)
      })
      if (brokenMovies.length > 20) {
        console.log(`   ... and ${brokenMovies.length - 20} more`)
      }
    }
  }

  // Save detailed report to file
  const reportPath = path.join(process.cwd(), 'url-validation-report.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      valid: validUrls.length,
      broken: brokenUrls.length,
      locations: {
        valid: validUrls.filter(r => r.type === 'location').length,
        broken: brokenLocations.length
      },
      movies: {
        valid: validUrls.filter(r => r.type === 'movie').length,
        broken: brokenMovies.length
      }
    },
    brokenUrls: brokenUrls.map(r => ({
      url: r.url,
      type: r.type,
      reason: r.reason
    }))
  }, null, 2))

  console.log('\n' + '='.repeat(80))
  console.log(`📝 Detailed report saved to: ${reportPath}`)
  console.log('='.repeat(80))

  // Exit with error code if there are broken URLs
  if (brokenUrls.length > 0) {
    process.exit(1)
  }
}

validateUrls().catch(error => {
  console.error('❌ Validation failed:', error)
  process.exit(1)
})
