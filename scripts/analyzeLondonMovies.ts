/**
 * Analyze movies filmed in London
 */

import * as fs from 'fs'
import * as path from 'path'

interface Movie {
  movie_id: string
  title: string
  year: number
  genres: string[]
  poster?: string
  banner_1280?: string
  thumbnail_52?: string
  imdb_rating?: number
  locations: Array<{
    description: string
    lat: number
    lng: number
  }>
}

async function analyzeLondonMovies() {
  console.log('🔍 Analyzing movies filmed in London...\n')

  // Load movies data
  const moviesPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
  const moviesData: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

  // Find movies with London locations
  const londonMovies = moviesData.filter(movie => {
    return movie.locations.some(location => {
      const desc = location.description.toLowerCase()
      return (
        desc.includes('london') &&
        (desc.includes('england') || desc.includes('uk') || desc.includes('united kingdom'))
      )
    })
  })

  console.log(`📊 Found ${londonMovies.length} movies filmed in London\n`)

  // Sort by IMDb rating
  londonMovies.sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))

  // Show top 20
  console.log('🎬 Top 20 London Movies by Rating:\n')
  londonMovies.slice(0, 20).forEach((movie, index) => {
    console.log(`${index + 1}. ${movie.title} (${movie.year}) - ⭐ ${movie.imdb_rating || 'N/A'}`)
    console.log(`   Genres: ${movie.genres.join(', ')}`)
    console.log(`   London locations: ${movie.locations.filter(l => l.description.toLowerCase().includes('london')).length}`)
    console.log('')
  })

  // Genre breakdown
  const genreCounts: Record<string, number> = {}
  londonMovies.forEach(movie => {
    movie.genres.forEach(genre => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1
    })
  })

  console.log('📊 Genre Breakdown:\n')
  Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([genre, count]) => {
      console.log(`   ${genre}: ${count} movies`)
    })

  console.log('\n')

  // Decade breakdown
  const decadeCounts: Record<string, number> = {}
  londonMovies.forEach(movie => {
    const decade = Math.floor(movie.year / 10) * 10
    decadeCounts[decade] = (decadeCounts[decade] || 0) + 1
  })

  console.log('📅 Decade Breakdown:\n')
  Object.entries(decadeCounts)
    .sort(([a], [b]) => Number(b) - Number(a))
    .forEach(([decade, count]) => {
      console.log(`   ${decade}s: ${count} movies`)
    })

  // Save London movies to a separate file for the location page
  const londonPageData = {
    location: {
      city: 'London',
      country: 'United Kingdom',
      slug: 'london-uk',
      coordinates: { lat: 51.5074, lng: -0.1278 }
    },
    movies: londonMovies.map(m => ({
      movie_id: m.movie_id,
      title: m.title,
      year: m.year,
      genres: m.genres,
      poster: m.poster,
      banner_1280: m.banner_1280,
      thumbnail_52: m.thumbnail_52,
      imdb_rating: m.imdb_rating,
      londonLocationCount: m.locations.filter(l => l.description.toLowerCase().includes('london')).length
    })),
    stats: {
      totalMovies: londonMovies.length,
      totalLocations: londonMovies.reduce((sum, m) =>
        sum + m.locations.filter(l => l.description.toLowerCase().includes('london')).length, 0
      ),
      genres: genreCounts,
      decades: decadeCounts,
      topRated: londonMovies.slice(0, 10).map(m => ({
        title: m.title,
        year: m.year,
        rating: m.imdb_rating
      }))
    }
  }

  const outputPath = path.join(process.cwd(), 'data', 'location_london-uk.json')
  fs.writeFileSync(outputPath, JSON.stringify(londonPageData, null, 2))
  console.log(`\n✅ London data saved to: ${outputPath}`)
}

analyzeLondonMovies().catch(console.error)
