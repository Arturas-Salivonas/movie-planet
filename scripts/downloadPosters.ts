/**
 * Poster Download & Optimization Script
 *
 * This script:
 * 1. Downloads movie posters from TMDb
 * 2. Converts them to WebP format (smaller, faster)
 * 3. Saves them locally in public/images/posters/
 * 4. Updates movies_enriched.json to use local paths
 * 5. Caches results to avoid re-downloading
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  POSTERS_DIR: 'public/images/posters',
  INPUT_FILE: 'data/movies_enriched.json',
  OUTPUT_FILE: 'data/movies_enriched.json',
  CACHE_FILE: 'data/cache/poster_downloads.json',
  TMDB_IMAGE_BASE: 'https://image.tmdb.org',
  POSTER_WIDTH: 300, // Resize to 300px width (optimization)
  QUALITY: 85, // WebP quality (1-100)
}

interface Movie {
  movie_id: string
  title: string
  year: number
  poster?: string
  [key: string]: any
}

interface DownloadCache {
  [tmdbUrl: string]: {
    localPath: string
    downloadedAt: string
  }
}

// ============================================================================
// Utilities
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Load download cache
 */
async function loadCache(): Promise<DownloadCache> {
  try {
    const cachePath = path.join(__dirname, '..', CONFIG.CACHE_FILE)
    const data = await fs.readFile(cachePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

/**
 * Save download cache
 */
async function saveCache(cache: DownloadCache): Promise<void> {
  const cachePath = path.join(__dirname, '..', CONFIG.CACHE_FILE)
  const cacheDir = path.dirname(cachePath)
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2))
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 10000,
  })
  return Buffer.from(response.data)
}

/**
 * Convert image to WebP format and resize
 */
async function convertToWebP(imageBuffer: Buffer, outputPath: string): Promise<void> {
  await sharp(imageBuffer)
    .resize(CONFIG.POSTER_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: CONFIG.QUALITY })
    .toFile(outputPath)
}

/**
 * Get file extension from URL or buffer
 */
function getImageFormat(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|webp)/)
  return match ? match[1] : 'jpg'
}

/**
 * Generate local filename for poster
 */
function generateLocalFilename(imdbId: string): string {
  return `${imdbId}.webp`
}

/**
 * Download and process a single poster
 */
async function downloadPoster(
  movie: Movie,
  cache: DownloadCache
): Promise<string | null> {
  const posterUrl = movie.poster

  if (!posterUrl) {
    console.log(`  ⚠️  No poster URL for ${movie.title}`)
    return null
  }

  // Skip if already downloaded
  if (cache[posterUrl]) {
    console.log(`  ✓ Cached: ${movie.title}`)
    return cache[posterUrl].localPath
  }

  try {
    // Generate local filename
    const filename = generateLocalFilename(movie.movie_id)
    const localPath = `/images/posters/${filename}`
    const fullPath = path.join(__dirname, '..', CONFIG.POSTERS_DIR, filename)

    // Check if file already exists on disk
    try {
      await fs.access(fullPath)
      console.log(`  ✓ Exists: ${movie.title}`)
      cache[posterUrl] = {
        localPath,
        downloadedAt: new Date().toISOString(),
      }
      return localPath
    } catch {
      // File doesn't exist, need to download
    }

    // Download image
    console.log(`  📥 Downloading: ${movie.title}`)
    const imageBuffer = await downloadImage(posterUrl)

    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    // Convert to WebP and save
    console.log(`  🔄 Converting to WebP: ${movie.title}`)
    await convertToWebP(imageBuffer, fullPath)

    // Update cache
    cache[posterUrl] = {
      localPath,
      downloadedAt: new Date().toISOString(),
    }

    console.log(`  ✅ Saved: ${localPath}`)
    return localPath
  } catch (error) {
    console.error(`  ❌ Failed to download poster for ${movie.title}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎬 Poster Download & Optimization Script\n')

  // Create posters directory
  const postersDir = path.join(__dirname, '..', CONFIG.POSTERS_DIR)
  await fs.mkdir(postersDir, { recursive: true })
  console.log(`📁 Posters directory: ${postersDir}\n`)

  // Load movies
  const inputPath = path.join(__dirname, '..', CONFIG.INPUT_FILE)
  const data = await fs.readFile(inputPath, 'utf-8')
  const parsedData = JSON.parse(data)

  // Handle both array format and object format
  const movies: Movie[] = Array.isArray(parsedData) ? parsedData : (parsedData.movies || [])

  console.log(`📊 Found ${movies.length} movies\n`)

  // Load cache
  const cache = await loadCache()
  console.log(`💾 Loaded cache with ${Object.keys(cache).length} entries\n`)

  // Filter movies that need poster download
  const moviesWithPosters = movies.filter(m => m.poster && m.poster.includes('tmdb.org'))
  console.log(`🎯 ${moviesWithPosters.length} movies need poster download\n`)

  // Download and convert posters
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (let i = 0; i < moviesWithPosters.length; i++) {
    const movie = moviesWithPosters[i]
    console.log(`[${i + 1}/${moviesWithPosters.length}] ${movie.title} (${movie.year})`)

    const originalPosterUrl = movie.poster
    const localPath = await downloadPoster(movie, cache)

    if (localPath) {
      // Update movie poster path
      movie.poster = localPath
      // Check if it was already cached
      if (cache[originalPosterUrl!] && cache[originalPosterUrl!].downloadedAt !== new Date().toISOString().split('T')[0]) {
        skipCount++
      } else {
        successCount++
      }
    } else {
      errorCount++
    }

    // Save cache every 10 movies
    if ((i + 1) % 10 === 0) {
      await saveCache(cache)
      console.log(`\n💾 Cache saved (${i + 1}/${moviesWithPosters.length})\n`)
    }

    // Rate limiting (be nice to servers)
    if (i < moviesWithPosters.length - 1) {
      await sleep(200) // 200ms between downloads
    }
  }

  // Save final cache
  await saveCache(cache)

  // Save updated movies file (preserve original format)
  const outputPath = path.join(__dirname, '..', CONFIG.OUTPUT_FILE)
  const outputData = Array.isArray(parsedData) ? movies : { ...parsedData, movies }
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2))

  console.log('\n' + '='.repeat(60))
  console.log('✅ Poster download complete!\n')
  console.log(`📊 Statistics:`)
  console.log(`   - Total movies: ${moviesWithPosters.length}`)
  console.log(`   - Successfully downloaded: ${successCount}`)
  console.log(`   - Skipped (cached): ${skipCount}`)
  console.log(`   - Errors: ${errorCount}`)
  console.log(`\n📁 Posters saved to: ${CONFIG.POSTERS_DIR}`)
  console.log(`📝 Updated: ${CONFIG.OUTPUT_FILE}`)
  console.log('='.repeat(60))
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
