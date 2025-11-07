/**
 * Generate slug mappings for all movies
 * Creates data/movies_slugs.json: { slug → movie_id }
 *
 * Run: npm run build:slugs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateSlug, isValidSlug } from '../lib/slugify.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Movie {
  movie_id: string
  title: string
  original_title?: string
  year: number
  imdb_id: string
  tmdb_id: number | string
}

interface SlugMapping {
  [slug: string]: string // slug → movie_id
}

interface SlugStats {
  total: number
  withYearSuffix: number
  duplicatesFound: number
  invalidSlugs: number
}

async function generateSlugs() {
  console.log('🎬 Generating movie slugs...\n')

  // Read movies data
  const moviesPath = path.join(__dirname, '../data/movies_enriched.json')
  const movies: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

  console.log(`📊 Processing ${movies.length} movies...`)

  const slugMap: SlugMapping = {}
  const reverseMap: Map<string, string[]> = new Map() // slug → movie_ids[]
  const stats: SlugStats = {
    total: 0,
    withYearSuffix: 0,
    duplicatesFound: 0,
    invalidSlugs: 0
  }

  // First pass: detect duplicate slugs
  const slugCount: Map<string, number> = new Map()

  movies.forEach((movie) => {
    const baseSlug = generateSlug(movie.title)
    slugCount.set(baseSlug, (slugCount.get(baseSlug) || 0) + 1)
  })

  // Second pass: assign slugs (with year suffix if duplicate)
  movies.forEach((movie) => {
    const baseSlug = generateSlug(movie.title)
    const count = slugCount.get(baseSlug) || 0

    // Use year suffix if slug is duplicated
    const slug = count > 1
      ? generateSlug(movie.title, movie.year)
      : baseSlug

    // Validate slug
    if (!isValidSlug(slug)) {
      console.warn(`⚠️  Invalid slug generated for "${movie.title}": "${slug}"`)
      stats.invalidSlugs++
      return
    }

    // Track for duplicate detection
    if (!reverseMap.has(slug)) {
      reverseMap.set(slug, [])
    }
    reverseMap.get(slug)!.push(movie.movie_id)

    // Add to mapping
    slugMap[slug] = movie.movie_id
    stats.total++

    if (count > 1) {
      stats.withYearSuffix++
    }
  })

  // Check for any remaining duplicates (rare edge case)
  reverseMap.forEach((movieIds, slug) => {
    if (movieIds.length > 1) {
      console.warn(`⚠️  Duplicate slug detected: "${slug}" → ${movieIds.join(', ')}`)
      stats.duplicatesFound++

      // Keep only the first movie for this slug
      slugMap[slug] = movieIds[0]
    }
  })

  // Write slug mapping to JSON
  const outputPath = path.join(__dirname, '../data/movies_slugs.json')
  fs.writeFileSync(outputPath, JSON.stringify(slugMap, null, 2), 'utf-8')

  // Write reverse index (movie_id → slug) for quick lookup
  const reverseSlugMap: Record<string, string> = {}
  Object.entries(slugMap).forEach(([slug, movieId]) => {
    reverseSlugMap[movieId] = slug
  })

  const reverseOutputPath = path.join(__dirname, '../data/movies_slugs_reverse.json')
  fs.writeFileSync(reverseOutputPath, JSON.stringify(reverseSlugMap, null, 2), 'utf-8')

  // Copy to public folder for client-side access
  const publicOutputPath = path.join(__dirname, '../public/data/movies_slugs.json')
  const publicReverseOutputPath = path.join(__dirname, '../public/data/movies_slugs_reverse.json')

  // Ensure public/data directory exists
  const publicDataDir = path.join(__dirname, '../public/data')
  if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true })
  }

  fs.writeFileSync(publicOutputPath, JSON.stringify(slugMap, null, 2), 'utf-8')
  fs.writeFileSync(publicReverseOutputPath, JSON.stringify(reverseSlugMap, null, 2), 'utf-8')

  // Print statistics
  console.log('\n✅ Slug generation complete!\n')
  console.log('📈 Statistics:')
  console.log(`   Total slugs: ${stats.total}`)
  console.log(`   With year suffix: ${stats.withYearSuffix} (${((stats.withYearSuffix / stats.total) * 100).toFixed(1)}%)`)
  console.log(`   Duplicates found: ${stats.duplicatesFound}`)
  console.log(`   Invalid slugs: ${stats.invalidSlugs}`)

  console.log('\n📁 Output files:')
  console.log(`   ${outputPath}`)
  console.log(`   ${reverseOutputPath}`)

  // Show examples
  console.log('\n🎬 Example slugs:')
  const examples = Object.entries(slugMap).slice(0, 5)
  examples.forEach(([slug, movieId]) => {
    const movie = movies.find(m => m.movie_id === movieId)
    if (movie) {
      console.log(`   "${movie.title}" → /movie/${slug}`)
    }
  })

  console.log('')
}

// Run the script
generateSlugs().catch((error) => {
  console.error('❌ Error generating slugs:', error)
  process.exit(1)
})
