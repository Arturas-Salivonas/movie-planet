/**
 * Generate actual PNG sprite sheets from movie poster thumbnails
 * This combines all thumbnails into single sprite images to reduce HTTP requests
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

interface MovieData {
  movie_id: string
  poster?: string
  thumbnail_52?: string
  locations_count: number
}

interface SpritePosition {
  x: number
  y: number
  width: number
  height: number
  pixelRatio: number
}

const SPRITE_CONFIG = {
  iconWidth: 52,
  iconHeight: 52,
  columns: 50, // 50 icons per row for reasonable sprite width
  maxMoviesPerSprite: 1000, // Split into multiple sprites if needed
  outputDir: path.join(process.cwd(), 'public/images/sprites'),
  metadataPath: path.join(process.cwd(), 'public/images/sprite-metadata.json'),
}

/**
 * Load all movie data from GeoJSON
 */
async function loadMovieData(): Promise<MovieData[]> {
  const geojsonPath = path.join(process.cwd(), 'public/geo/movies.geojson')
  const geojsonContent = fs.readFileSync(geojsonPath, 'utf-8')
  const geojson = JSON.parse(geojsonContent)

  const movies: MovieData[] = []
  const seenIds = new Set<string>()

  for (const feature of geojson.features) {
    const movieId = feature.properties.movie_id

    if (seenIds.has(movieId)) continue
    seenIds.add(movieId)

    movies.push({
      movie_id: movieId,
      poster: feature.properties.poster,
      thumbnail_52: feature.properties.thumbnail_52,
      locations_count: feature.properties.locations_count || 1,
    })
  }

  console.log(`✅ Loaded ${movies.length} unique movies`)
  return movies
}

/**
 * Create fallback icon buffer
 */
async function createFallbackIcon(): Promise<Buffer> {
  // Create a simple gradient background with film emoji
  const svg = `
    <svg width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="52" height="52" fill="url(#grad)" rx="4"/>
      <text x="26" y="32" font-size="28" text-anchor="middle" fill="white">🎬</text>
    </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/**
 * Generate sprite sheets from thumbnails
 */
async function generateSprites(movies: MovieData[]): Promise<void> {
  const { iconWidth, iconHeight, columns, maxMoviesPerSprite, outputDir, metadataPath } = SPRITE_CONFIG

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Calculate sprite layout
  const totalSprites = Math.ceil(movies.length / maxMoviesPerSprite)
  console.log(`📦 Creating ${totalSprites} sprite sheet(s)...`)

  const allMetadata: Record<string, SpritePosition & { sprite: string }> = {}
  const fallbackIconBuffer = await createFallbackIcon()

  for (let spriteIndex = 0; spriteIndex < totalSprites; spriteIndex++) {
    const startIdx = spriteIndex * maxMoviesPerSprite
    const endIdx = Math.min(startIdx + maxMoviesPerSprite, movies.length)
    const moviesInSprite = movies.slice(startIdx, endIdx)

    const rows = Math.ceil(moviesInSprite.length / columns)
    const spriteWidth = columns * iconWidth
    const spriteHeight = rows * iconHeight

    console.log(`\n📐 Sprite ${spriteIndex + 1}/${totalSprites}: ${spriteWidth}x${spriteHeight} (${moviesInSprite.length} movies)`)

    // Create base transparent canvas
    const compositeImages: Array<{ input: Buffer; top: number; left: number }> = []

    // Process each movie
    let successCount = 0
    let fallbackCount = 0

    for (let i = 0; i < moviesInSprite.length; i++) {
      const movie = moviesInSprite[i]
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = col * iconWidth
      const y = row * iconHeight

      let iconBuffer: Buffer

      try {
        // Try to load thumbnail
        const imagePath = movie.thumbnail_52 || movie.poster

        if (imagePath) {
          const fullPath = path.join(process.cwd(), 'public', imagePath)

          if (fs.existsSync(fullPath)) {
            // Resize and crop to exact size
            iconBuffer = await sharp(fullPath)
              .resize(iconWidth, iconHeight, { fit: 'cover', position: 'center' })
              .png()
              .toBuffer()

            successCount++
          } else {
            iconBuffer = fallbackIconBuffer
            fallbackCount++
          }
        } else {
          iconBuffer = fallbackIconBuffer
          fallbackCount++
        }
      } catch (error) {
        console.warn(`⚠️  Failed to process ${movie.movie_id}`)
        iconBuffer = fallbackIconBuffer
        fallbackCount++
      }

      // Add to composite
      compositeImages.push({
        input: iconBuffer,
        top: y,
        left: x,
      })

      // Store metadata
      const spriteName = `sprite-${spriteIndex}`
      allMetadata[`poster-${movie.movie_id}`] = {
        x,
        y,
        width: iconWidth,
        height: iconHeight,
        pixelRatio: 1,
        sprite: spriteName,
      }

      // Progress
      if ((i + 1) % 100 === 0) {
        console.log(`  ⏳ Processed ${i + 1}/${moviesInSprite.length} icons...`)
      }
    }

    // Create sprite sheet
    const spriteOutput = path.join(outputDir, `sprite-${spriteIndex}.png`)

    await sharp({
      create: {
        width: spriteWidth,
        height: spriteHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(compositeImages)
      .png({ compressionLevel: 9, palette: true })
      .toFile(spriteOutput)

    const stats = fs.statSync(spriteOutput)
    console.log(`  ✅ Sprite saved: ${spriteOutput}`)
    console.log(`     Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`     Success: ${successCount} | Fallback: ${fallbackCount}`)
  }

  // Save metadata
  const metadata = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalMovies: movies.length,
    totalSprites: totalSprites,
    spriteWidth: columns * iconWidth,
    spriteHeight: Math.ceil(maxMoviesPerSprite / columns) * iconHeight,
    iconWidth,
    iconHeight,
    sprites: allMetadata,
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  console.log(`\n✅ Sprite metadata saved: ${metadataPath}`)

  // Calculate total size
  const totalSize = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.png'))
    .reduce((sum, f) => sum + fs.statSync(path.join(outputDir, f)).size, 0)

  console.log(`\n📊 Total sprite size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`🎯 Individual requests eliminated: ${movies.length} → ${totalSprites}`)
  console.log(`💾 Request reduction: ${((1 - totalSprites / movies.length) * 100).toFixed(1)}%`)
}

/**
 * Main execution
 */
async function main() {
  console.log('🎬 Starting sprite sheet generation...\n')

  try {
    const movies = await loadMovieData()
    await generateSprites(movies)
    console.log('\n✅ Sprite generation complete!')
  } catch (error) {
    console.error('❌ Error generating sprites:', error)
    process.exit(1)
  }
}

main()
