/**
 * Add Test Harry Potter Data to Database
 * Merges the test output into movies_enriched.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function mergeTestData() {
  console.log('\n🔄 Merging Harry Potter test data into database...\n')

  try {
    // Read test data
    const testPath = path.join(__dirname, '../data/test_harry_potter_locations.json')
    const testData = JSON.parse(await fs.readFile(testPath, 'utf-8'))

    // Read existing movies
    const moviesPath = path.join(__dirname, '../data/movies_enriched.json')
    const movies = JSON.parse(await fs.readFile(moviesPath, 'utf-8'))

    // Enhance test data with missing fields
    const harryPotter = {
      ...testData,
      original_title: "Harry Potter and the Sorcerer's Stone",
      tmdb_id: 671,
      type: 'movie',
      genres: ['Adventure', 'Fantasy'],
      poster: '/images/posters/tt0241527.webp',
      trailer: 'VyHV0BRtdxo',
      imdb_rating: 7.6,
      thumbnail_52: '/images/thumbnails/tt0241527.webp'
    }

    // Remove any existing Harry Potter entry
    const filteredMovies = movies.filter((m: any) => m.imdb_id !== 'tt0241527')

    // Add Harry Potter at the beginning
    const updatedMovies = [harryPotter, ...filteredMovies]

    // Save updated movies
    await fs.writeFile(moviesPath, JSON.stringify(updatedMovies, null, 2))

    console.log('✅ Successfully merged Harry Potter into database')
    console.log(`📊 Total movies: ${updatedMovies.length}`)
    console.log(`📍 Harry Potter locations: ${harryPotter.locations.length}`)
    console.log(`🎬 Locations with scenes: ${harryPotter.locations.filter((l: any) => l.scene_description).length}\n`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

mergeTestData()
