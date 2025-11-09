/**
 * Optimize search data by creating indexed chunks
 * This splits the large movies.geojson into smaller searchable chunks
 */

import fs from 'fs'
import path from 'path'

interface MovieFeature {
  type: string
  properties: {
    movie_id: string
    title: string
    year: number
    genres?: string[]
    top_genre?: string
    imdb_rating?: number
    poster?: string
    thumbnail_52?: string
    locations_count: number
    location_names: string[]
  }
  geometry: any
}

interface SearchIndexEntry {
  id: string
  title: string
  year: number
  genres: string[]
  locations: string[]
  rating?: number
  poster?: string
  chunk: number // Which chunk file contains full data
}

const CONFIG = {
  inputPath: path.join(process.cwd(), 'public/geo/movies.geojson'),
  outputDir: path.join(process.cwd(), 'public/geo/search'),
  indexPath: path.join(process.cwd(), 'public/geo/search/index.json'),
  chunkSize: 200, // Movies per chunk
}

/**
 * Create search index and data chunks
 */
async function optimizeSearchData() {
  console.log('🔍 Optimizing search data...\n')

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  }

  // Load GeoJSON
  const geojsonContent = fs.readFileSync(CONFIG.inputPath, 'utf-8')
  const geojson = JSON.parse(geojsonContent)

  console.log(`📊 Loaded ${geojson.features.length} movie features`)

  // Deduplicate by movie_id and create search index
  const movieMap = new Map<string, MovieFeature>()
  const searchIndex: SearchIndexEntry[] = []

  for (const feature of geojson.features) {
    const movieId = feature.properties.movie_id

    // Keep first occurrence (or merge if needed)
    if (!movieMap.has(movieId)) {
      movieMap.set(movieId, feature)
    }
  }

  const uniqueMovies = Array.from(movieMap.values())
  console.log(`✅ Found ${uniqueMovies.length} unique movies`)

  // Sort by title for consistent ordering
  uniqueMovies.sort((a, b) => a.properties.title.localeCompare(b.properties.title))

  // Split into chunks and create search index
  const totalChunks = Math.ceil(uniqueMovies.length / CONFIG.chunkSize)
  console.log(`📦 Creating ${totalChunks} chunks...`)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CONFIG.chunkSize
    const end = Math.min(start + CONFIG.chunkSize, uniqueMovies.length)
    const chunk = uniqueMovies.slice(start, end)

    // Save chunk
    const chunkPath = path.join(CONFIG.outputDir, `chunk-${i}.json`)
    const chunkData = {
      type: 'FeatureCollection',
      features: chunk,
    }
    fs.writeFileSync(chunkPath, JSON.stringify(chunkData))

    // Add to search index
    for (const feature of chunk) {
      const props = feature.properties

      // Extract unique locations
      const locations = Array.from(new Set(
        props.location_names.map((loc: string) => {
          const parts = loc.split(',')
          return parts.length > 1 ? parts[1].trim() : parts[0].trim()
        })
      ))

      searchIndex.push({
        id: props.movie_id,
        title: props.title,
        year: props.year,
        genres: props.genres || (props.top_genre ? [props.top_genre] : []),
        locations,
        rating: props.imdb_rating,
        poster: props.thumbnail_52 || props.poster,
        chunk: i,
      })
    }

    console.log(`  ✓ Chunk ${i + 1}/${totalChunks} (${chunk.length} movies)`)
  }

  // Save search index
  const indexData = {
    version: 1,
    totalMovies: uniqueMovies.length,
    totalChunks,
    generatedAt: new Date().toISOString(),
    index: searchIndex,
  }

  fs.writeFileSync(CONFIG.indexPath, JSON.stringify(indexData))
  console.log(`\n✅ Search index saved: ${CONFIG.indexPath}`)

  // Calculate size savings
  const originalSize = fs.statSync(CONFIG.inputPath).size
  const indexSize = fs.statSync(CONFIG.indexPath).size
  const avgChunkSize = fs.statSync(path.join(CONFIG.outputDir, 'chunk-0.json')).size

  console.log(`\n📊 Size comparison:`)
  console.log(`   Original GeoJSON: ${(originalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   Search index: ${(indexSize / 1024).toFixed(2)} KB`)
  console.log(`   Avg chunk size: ${(avgChunkSize / 1024).toFixed(2)} KB`)
  console.log(`   Initial load reduction: ${(((originalSize - indexSize) / originalSize) * 100).toFixed(1)}%`)
}

/**
 * Main execution
 */
async function main() {
  try {
    await optimizeSearchData()
    console.log('\n✅ Search optimization complete!')
  } catch (error) {
    console.error('❌ Error optimizing search:', error)
    process.exit(1)
  }
}

main()
