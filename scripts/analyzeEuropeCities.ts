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

// European countries
const europeanCountries = [
  'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland',
  'France', 'Italy', 'Spain', 'Germany', 'Netherlands', 'Belgium', 'Switzerland',
  'Austria', 'Czech Republic', 'Poland', 'Russia', 'Turkey', 'Greece', 'Sweden',
  'Norway', 'Denmark', 'Finland', 'Portugal', 'Ireland', 'Iceland'
]

const australianCountries = ['Australia']

// Count MOVIES by European cities
const europeCities = new Map<string, { movies: Set<string>, country: string }>()

movies.forEach(movie => {
  movie.locations
    .filter(loc => europeanCountries.some(c => loc.country.includes(c)))
    .forEach(loc => {
      const key = `${loc.city}, ${loc.country}`
      if (!europeCities.has(key)) {
        europeCities.set(key, { movies: new Set(), country: loc.country })
      }
      europeCities.get(key)!.movies.add(movie.movie_id)
    })
})

// Count MOVIES by Australian cities
const australiaCities = new Map<string, { movies: Set<string>, country: string }>()

movies.forEach(movie => {
  movie.locations
    .filter(loc => australianCountries.some(c => loc.country.includes(c)))
    .forEach(loc => {
      const key = `${loc.city}, ${loc.country}`
      if (!australiaCities.has(key)) {
        australiaCities.set(key, { movies: new Set(), country: loc.country })
      }
      australiaCities.get(key)!.movies.add(movie.movie_id)
    })
})

// Convert to counts and sort
const europeSorted = [...europeCities.entries()]
  .map(([key, data]) => ({ city: key, count: data.movies.size, country: data.country }))
  .sort((a, b) => b.count - a.count)
  .filter(x => x.count >= 5)

const australiaSorted = [...australiaCities.entries()]
  .map(([key, data]) => ({ city: key, count: data.movies.size, country: data.country }))
  .sort((a, b) => b.count - a.count)
  .filter(x => x.count >= 5)

console.log('\n🇪🇺 European cities with 5+ movies:\n')
europeSorted.forEach(({ city, count }) => {
  console.log(`  ${city}: ${count} movies`)
})
console.log(`\nTotal: ${europeSorted.length} European cities`)

console.log('\n🇦🇺 Australian cities with 5+ movies:\n')
australiaSorted.forEach(({ city, count }) => {
  console.log(`  ${city}: ${count} movies`)
})
console.log(`\nTotal: ${australiaSorted.length} Australian cities`)
