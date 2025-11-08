/**
 * Generate site statistics for Partnership modal and other components
 */

import * as fs from 'fs'
import * as path from 'path'

interface Movie {
  movie_id: string
  locations: Array<{
    description: string
    lat: number
    lng: number
  }>
}

async function generateStats() {
  console.log('📊 Generating site statistics...\n')

  // Load movies data
  const moviesPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
  const moviesData: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

  // Calculate statistics
  const totalMovies = moviesData.length
  const moviesWithLocations = moviesData.filter(m => m.locations && m.locations.length > 0).length
  const totalLocations = moviesData.reduce((sum, m) => sum + (m.locations?.length || 0), 0)

  // Count unique countries
  const countries = new Set<string>()
  moviesData.forEach(movie => {
    movie.locations?.forEach(location => {
      // Extract country from description (last part after comma)
      const parts = location.description.split(',')
      if (parts.length > 0) {
        const country = parts[parts.length - 1].trim()
        countries.add(country)
      }
    })
  })

  const stats = {
    totalMovies,
    moviesWithLocations,
    totalLocations,
    uniqueCountries: countries.size,
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  console.log('📈 Statistics:')
  console.log(`   Total Movies: ${stats.totalMovies}`)
  console.log(`   Movies with Locations: ${stats.moviesWithLocations}`)
  console.log(`   Total Filming Locations: ${stats.totalLocations}`)
  console.log(`   Unique Countries: ${stats.uniqueCountries}`)
  console.log(`   Generated: ${stats.lastUpdated}\n`)

  // Save to public directory for client-side access
  const outputPath = path.join(process.cwd(), 'public', 'data', 'site-stats.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2))

  console.log(`✅ Stats saved to: ${outputPath}`)
}

generateStats().catch(console.error)
