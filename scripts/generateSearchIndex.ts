/**
 * Generate search index for Fuse.js
 * Run: npm run generate:index
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
  genres: string[]
  locations: Location[]
}

interface SearchIndexEntry {
  id: string
  title: string
  year: number
  genres: string[]
  countries: string[]
  cities: string[]
}

const INPUT_FILE = join(__dirname, '../data/movies_sample_10.json')
const OUTPUT_DIR = join(__dirname, '../public/index')
const OUTPUT_FILE = join(OUTPUT_DIR, 'movies_index.json')

function createSearchIndex(movies: Movie[]): SearchIndexEntry[] {
  return movies.map((movie) => {
    // Extract unique countries and cities
    const countries = [...new Set(movie.locations.map((loc) => loc.country))]
    const cities = [...new Set(movie.locations.map((loc) => loc.city))]

    return {
      id: movie.movie_id,
      title: movie.title,
      year: movie.year,
      genres: movie.genres,
      countries,
      cities,
    }
  })
}

async function main() {
  try {
    console.log('📖 Reading movies data...')
    const moviesData = readFileSync(INPUT_FILE, 'utf-8')
    const movies: Movie[] = JSON.parse(moviesData)

    console.log(`✅ Loaded ${movies.length} movies`)

    console.log('🔍 Creating search index...')
    const searchIndex = createSearchIndex(movies)

    console.log(`✅ Created search index with ${searchIndex.length} entries`)

    // Create output directory if it doesn't exist
    mkdirSync(OUTPUT_DIR, { recursive: true })

    // Write search index file
    writeFileSync(OUTPUT_FILE, JSON.stringify(searchIndex, null, 2))

    console.log(`✅ Search index saved to: ${OUTPUT_FILE}`)
    console.log('🎉 Done!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
