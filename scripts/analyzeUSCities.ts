import * as fs from 'fs'
import * as path from 'path'

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
  locations: Location[]
}

const moviesPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
const movies: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

// Count MOVIES (not locations) by US city
const cityMovies = new Map<string, Set<string>>()

movies.forEach(movie => {
  movie.locations
    .filter(loc =>
      loc.country.includes('United States') ||
      loc.country.includes('USA') ||
      loc.country === 'US'
    )
    .forEach(loc => {
      if (!cityMovies.has(loc.city)) {
        cityMovies.set(loc.city, new Set())
      }
      cityMovies.get(loc.city)!.add(movie.movie_id)
    })
})

// Convert to counts
const cityCounts = new Map<string, number>()
cityMovies.forEach((movieSet, city) => {
  cityCounts.set(city, movieSet.size)
})

// Sort by count
const sorted = [...cityCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .filter(([_, count]) => count >= 5) // Only cities with 5+ movies

console.log('\nUS cities with 5+ movies:\n')
sorted.forEach(([city, count]) => {
  console.log(`  ${city}: ${count} movies`)
})

console.log(`\nTotal US cities with 5+ movies: ${sorted.length}`)
