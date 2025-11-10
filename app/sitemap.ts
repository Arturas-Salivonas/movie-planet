import { MetadataRoute } from 'next'
import { getAllMovieSlugs } from '../lib/movies'
import * as fs from 'fs'
import * as path from 'path'

// Force Node.js runtime for file system access
export const runtime = 'nodejs'
export const dynamic = 'force-static'

/**
 * Get all location slugs from data directory
 */
function getAllLocationSlugs(): string[] {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const files = fs.readdirSync(dataDir)

    // Find all location_*.json files
    const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))

    // Extract slugs from filenames
    return locationFiles.map(f => f.replace('location_', '').replace('.json', ''))
  } catch (error) {
    console.error('Error reading location files:', error)
    return []
  }
}

/**
 * Generate sitemap for all movies and locations
 * Optimized for 10k+ movies with proper priority and change frequency
 * Last updated: 2025-11-10
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'
  const now = new Date()

  console.log('🔨 Building sitemap...')
  console.log('Base URL:', baseUrl)
  console.log('Working directory:', process.cwd())

  // Homepage
  const homepage: MetadataRoute.Sitemap[0] = {
    url: baseUrl,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 1.0,
  }

  // Get all movie slugs
  let movieSlugs: string[] = []
  try {
    movieSlugs = getAllMovieSlugs()
    console.log(`📄 Found ${movieSlugs.length} movie slugs`)
  } catch (error) {
    console.error('❌ Error getting movie slugs:', error)
  }

  // Movie pages - batch process for better performance
  const moviePages: MetadataRoute.Sitemap = movieSlugs.map((slug) => ({
    url: `${baseUrl}/movie/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  // Location pages
  let locationSlugs: string[] = []
  try {
    locationSlugs = getAllLocationSlugs()
    console.log(`📍 Found ${locationSlugs.length} location slugs`)
  } catch (error) {
    console.error('❌ Error getting location slugs:', error)
  }

  const locationPages: MetadataRoute.Sitemap = locationSlugs.map((slug) => ({
    url: `${baseUrl}/location/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9, // High priority for location landing pages
  }))

  console.log(`✅ Sitemap generated: ${moviePages.length + locationPages.length + 1} total URLs`)

  return [homepage, ...locationPages, ...moviePages]
}

// For very large sitemaps (10k+ pages), you can split into multiple sitemaps:
// See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
