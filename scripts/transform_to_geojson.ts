/**
 * Transform to GeoJSON Script
 * Converts enriched movie data to GeoJSON format with multi-location support,
 * chunking for performance, and tile indexing for LOD (Level of Detail).
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'

// ============================================================================
// Types
// ============================================================================

interface EnrichedMovie {
  imdb_id: string
  tmdb_id: number
  title: string
  original_title?: string
  year: number
  genres: string[]
  poster?: string // Full URL
  poster_path?: string
  backdrop_path?: string
  overview?: string
  runtime?: number
  vote_average?: number
  imdb_rating?: number
  trailer?: string // YouTube ID
  trailer_url?: string
  locations: Array<{
    lat: number
    lng: number
    city: string
    country: string
    description: string
    start_date?: string
    end_date?: string
  }>
}

interface GeoJSONFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Point' | 'MultiPoint' | 'LineString'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: {
    movie_id: string
    tmdb_id: number
    title: string
    year: number
    poster: string | null
    trailer: string | null
    top_genre: string | null
    short_description: string
    imdb_rating: number | null
    locations_count: number
    location_names: string[]
    has_timeline: boolean
    centroid?: [number, number]
  }
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

interface TileIndex {
  zoom_levels: {
    [zoom: string]: {
      chunk_size: number
      chunks: Array<{
        id: string
        file: string
        bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
        feature_count: number
      }>
    }
  }
  metadata: {
    total_features: number
    total_chunks: number
    generated_at: string
  }
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  INPUT_FILE: 'data/movies_enriched.json',
  OUTPUT_GEOJSON: 'public/geo/movies.geojson',
  OUTPUT_DIR: 'public/geo',
  CHUNK_SIZE: 200,
  TILE_INDEX_FILE: 'public/geo/tile_index.json',
  PATHS_FILE: 'public/geo/movie_paths.geojson',
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate centroid of multiple points
 */
function calculateCentroid(coordinates: number[][]): [number, number] {
  const sum = coordinates.reduce(
    (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
    [0, 0]
  )
  return [sum[0] / coordinates.length, sum[1] / coordinates.length]
}

/**
 * Calculate bounding box for coordinates
 */
function calculateBounds(coordinates: number[][]): [number, number, number, number] {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  return [minLng, minLat, maxLng, maxLat]
}

/**
 * Sort locations by filming date (chronological order)
 */
function sortLocationsByDate(locations: EnrichedMovie['locations']): EnrichedMovie['locations'] {
  return [...locations].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0
    if (!a.start_date) return 1
    if (!b.start_date) return -1
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })
}

/**
 * Check if locations have timeline data
 */
function hasTimeline(locations: EnrichedMovie['locations']): boolean {
  return locations.some((loc) => loc.start_date !== undefined)
}

/**
 * Generate TMDb image URL
 */
function getTmdbImageUrl(path: string | undefined, size: 'w500' | 'original' = 'w500'): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

/**
 * Truncate description to max length
 */
function truncateDescription(text: string | undefined, maxLength: number = 200): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

// ============================================================================
// GeoJSON Transformation
// ============================================================================

/**
 * Transform a single movie to GeoJSON feature(s)
 */
function transformMovieToFeature(movie: EnrichedMovie): GeoJSONFeature | null {
  if (!movie.locations || movie.locations.length === 0) {
    return null
  }

  const coordinates = movie.locations.map((loc) => [loc.lng, loc.lat])
  const locationNames = movie.locations.map((loc) =>
    `${loc.city}, ${loc.country}${loc.description ? ` (${loc.description})` : ''}`
  )

  let geometry: GeoJSONFeature['geometry']
  let centroid: [number, number] | undefined

  if (coordinates.length === 1) {
    // Single location - Point geometry
    geometry = {
      type: 'Point',
      coordinates: coordinates[0],
    }
  } else {
    // Multiple locations - MultiPoint geometry
    geometry = {
      type: 'MultiPoint',
      coordinates: coordinates,
    }
    centroid = calculateCentroid(coordinates)
  }

  const feature: GeoJSONFeature = {
    type: 'Feature',
    id: `movie-${movie.tmdb_id}`,
    geometry,
    properties: {
      movie_id: movie.imdb_id,
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      year: movie.year,
      poster: movie.poster || getTmdbImageUrl(movie.poster_path) || null,
      trailer: movie.trailer || movie.trailer_url || null,
      top_genre: movie.genres && movie.genres.length > 0 ? movie.genres[0] : null,
      short_description: truncateDescription(movie.overview),
      imdb_rating: movie.imdb_rating || movie.vote_average || null,
      locations_count: movie.locations.length,
      location_names: locationNames,
      has_timeline: hasTimeline(movie.locations),
      centroid,
    },
  }

  return feature
}

/**
 * Generate movie paths (LineString) for movies with timeline data
 */
function generateMoviePaths(movies: EnrichedMovie[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []

  for (const movie of movies) {
    if (!movie.locations || movie.locations.length < 2) continue
    if (!hasTimeline(movie.locations)) continue

    const sortedLocations = sortLocationsByDate(movie.locations)
    const coordinates = sortedLocations.map((loc) => [loc.lng, loc.lat])

    const pathFeature: GeoJSONFeature = {
      type: 'Feature',
      id: `path-${movie.tmdb_id}`,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        movie_id: movie.imdb_id,
        tmdb_id: movie.tmdb_id,
        title: movie.title,
        year: movie.year,
        poster: movie.poster || getTmdbImageUrl(movie.poster_path) || null,
        trailer: movie.trailer || movie.trailer_url || null,
        top_genre: movie.genres && movie.genres.length > 0 ? movie.genres[0] : null,
        short_description: truncateDescription(movie.overview),
        imdb_rating: movie.imdb_rating || movie.vote_average || null,
        locations_count: movie.locations.length,
        location_names: sortedLocations.map((loc) => `${loc.city}, ${loc.country}`),
        has_timeline: true,
      },
    }

    features.push(pathFeature)
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

/**
 * Transform all movies to GeoJSON
 */
function transformToGeoJSON(movies: EnrichedMovie[]): GeoJSONFeatureCollection {
  const features: GeoJSONFeature[] = []

  for (const movie of movies) {
    const feature = transformMovieToFeature(movie)
    if (feature) {
      features.push(feature)
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

// ============================================================================
// Chunking & Tiling
// ============================================================================

/**
 * Split features into chunks
 */
function chunkFeatures(
  features: GeoJSONFeature[],
  chunkSize: number
): GeoJSONFeatureCollection[] {
  const chunks: GeoJSONFeatureCollection[] = []

  for (let i = 0; i < features.length; i += chunkSize) {
    const chunkFeatures = features.slice(i, i + chunkSize)
    chunks.push({
      type: 'FeatureCollection',
      features: chunkFeatures,
    })
  }

  return chunks
}

/**
 * Generate tile index for LOD (Level of Detail)
 */
function generateTileIndex(
  chunks: GeoJSONFeatureCollection[],
  chunkSize: number
): TileIndex {
  const tileIndex: TileIndex = {
    zoom_levels: {},
    metadata: {
      total_features: chunks.reduce((sum, chunk) => sum + chunk.features.length, 0),
      total_chunks: chunks.length,
      generated_at: new Date().toISOString(),
    },
  }

  // Define zoom level strategies
  // Zoom 0-3: Load first chunk only (overview)
  // Zoom 4-6: Load 25% of chunks
  // Zoom 7-9: Load 50% of chunks
  // Zoom 10+: Load all chunks

  const zoomStrategies = [
    { zooms: [0, 1, 2, 3], percentage: 0.05, label: 'overview' },
    { zooms: [4, 5, 6], percentage: 0.25, label: 'medium' },
    { zooms: [7, 8, 9], percentage: 0.5, label: 'detailed' },
    { zooms: [10, 11, 12, 13, 14, 15, 16, 17, 18], percentage: 1.0, label: 'full' },
  ]

  for (const strategy of zoomStrategies) {
    const chunksToLoad = Math.max(1, Math.ceil(chunks.length * strategy.percentage))

    for (const zoom of strategy.zooms) {
      tileIndex.zoom_levels[zoom] = {
        chunk_size: chunkSize,
        chunks: chunks.slice(0, chunksToLoad).map((chunk, index) => {
          // Calculate bounds for each chunk
          const allCoordinates: number[][] = []
          for (const feature of chunk.features) {
            if (feature.geometry.type === 'Point') {
              allCoordinates.push(feature.geometry.coordinates as number[])
            } else if (feature.geometry.type === 'MultiPoint') {
              allCoordinates.push(...(feature.geometry.coordinates as number[][]))
            }
          }

          const bounds = allCoordinates.length > 0
            ? calculateBounds(allCoordinates)
            : [0, 0, 0, 0]

          return {
            id: `chunk-${index + 1}`,
            file: `movies_page_${index + 1}.json`,
            bounds: bounds as [number, number, number, number],
            feature_count: chunk.features.length,
          }
        }),
      }
    }
  }

  return tileIndex
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Save GeoJSON to file
 */
async function saveGeoJSON(
  data: GeoJSONFeatureCollection,
  filePath: string
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

/**
 * Save chunks to individual files
 */
async function saveChunks(chunks: GeoJSONFeatureCollection[]): Promise<void> {
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true })

  for (let i = 0; i < chunks.length; i++) {
    const filePath = path.join(CONFIG.OUTPUT_DIR, `movies_page_${i + 1}.json`)
    await fs.writeFile(filePath, JSON.stringify(chunks[i], null, 2))
    console.log(`  ✓ Saved chunk ${i + 1}/${chunks.length} (${chunks[i].features.length} features)`)
  }
}

/**
 * Save tile index
 */
async function saveTileIndex(tileIndex: TileIndex): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG.TILE_INDEX_FILE), { recursive: true })
  await fs.writeFile(CONFIG.TILE_INDEX_FILE, JSON.stringify(tileIndex, null, 2))
}

// ============================================================================
// Statistics & Reporting
// ============================================================================

/**
 * Generate statistics report
 */
function generateStats(
  movies: EnrichedMovie[],
  features: GeoJSONFeature[],
  paths: GeoJSONFeature[]
): void {
  const singleLocation = features.filter((f) => f.properties.locations_count === 1).length
  const multiLocation = features.filter((f) => f.properties.locations_count > 1).length
  const withTimeline = features.filter((f) => f.properties.has_timeline).length
  const totalLocations = features.reduce((sum, f) => sum + f.properties.locations_count, 0)
  const avgLocations = (totalLocations / features.length).toFixed(2)

  console.log('\n📊 Statistics:')
  console.log(`  Total movies: ${movies.length}`)
  console.log(`  Movies with locations: ${features.length}`)
  console.log(`  Single location: ${singleLocation}`)
  console.log(`  Multi-location: ${multiLocation}`)
  console.log(`  With timeline data: ${withTimeline}`)
  console.log(`  Total filming locations: ${totalLocations}`)
  console.log(`  Average locations per movie: ${avgLocations}`)
  console.log(`  Movies with paths: ${paths.length}`)
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🗺️  Transform to GeoJSON\n')

  // Step 1: Load enriched movie data
  console.log('Step 1: Loading enriched movie data...')
  const rawData = await fs.readFile(CONFIG.INPUT_FILE, 'utf-8')
  const movies: EnrichedMovie[] = JSON.parse(rawData)
  console.log(`  ✓ Loaded ${movies.length} movies`)

  // Step 2: Transform to GeoJSON
  console.log('\nStep 2: Transforming to GeoJSON...')
  const geojson = transformToGeoJSON(movies)
  console.log(`  ✓ Generated ${geojson.features.length} features`)

  // Step 3: Generate movie paths (LineStrings for timeline-based movies)
  console.log('\nStep 3: Generating movie paths...')
  const paths = generateMoviePaths(movies)
  console.log(`  ✓ Generated ${paths.features.length} path features`)

  // Step 4: Save full GeoJSON
  console.log('\nStep 4: Saving full GeoJSON...')
  await saveGeoJSON(geojson, CONFIG.OUTPUT_GEOJSON)
  console.log(`  ✓ Saved to ${CONFIG.OUTPUT_GEOJSON}`)

  // Step 5: Save movie paths
  if (paths.features.length > 0) {
    console.log('\nStep 5: Saving movie paths...')
    await saveGeoJSON(paths, CONFIG.PATHS_FILE)
    console.log(`  ✓ Saved to ${CONFIG.PATHS_FILE}`)
  }

  // Step 6: Chunk features
  console.log(`\nStep 6: Chunking features (${CONFIG.CHUNK_SIZE} per chunk)...`)
  const chunks = chunkFeatures(geojson.features, CONFIG.CHUNK_SIZE)
  console.log(`  ✓ Created ${chunks.length} chunks`)

  // Step 7: Save chunks
  console.log('\nStep 7: Saving chunks...')
  await saveChunks(chunks)

  // Step 8: Generate tile index
  console.log('\nStep 8: Generating tile index...')
  const tileIndex = generateTileIndex(chunks, CONFIG.CHUNK_SIZE)
  await saveTileIndex(tileIndex)
  console.log(`  ✓ Saved to ${CONFIG.TILE_INDEX_FILE}`)

  // Step 9: Generate statistics
  generateStats(movies, geojson.features, paths.features)

  console.log('\n🎉 Done!')
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export { transformMovieToFeature, generateMoviePaths, chunkFeatures, generateTileIndex }
