import { MetadataRoute } from 'next'
import { getAllMovieSlugs } from '../lib/movies'
import * as fs from 'fs'
import * as path from 'path'

// Force Node.js runtime for file system access
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // Changed from 'force-static' to always regenerate
export const revalidate = 0 // Always regenerate, no caching

/**
 * Get all location slugs from data directory
 */
function getAllLocationSlugs(): string[] {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    
    // Verify directory exists
    if (!fs.existsSync(dataDir)) {
      console.error('Data directory does not exist:', dataDir)
      return []
    }
    
    const files = fs.readdirSync(dataDir)

    // Find all location_*.json files
    const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))
    
    console.log(`Found ${locationFiles.length} location files`)

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
 * Last updated: 2025-11-12
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'
  const now = new Date()

  console.log('=== SITEMAP GENERATION START ===')
  console.log('Base URL:', baseUrl)
  console.log('Working directory:', process.cwd())

  // Homepage
  const homepage: MetadataRoute.Sitemap[0] = {
    url: baseUrl,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 1.0,
  }

  // Blog page
  const blogPage: MetadataRoute.Sitemap[0] = {
    url: `${baseUrl}/blog`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }

  // Locations index page
  const locationsIndex: MetadataRoute.Sitemap[0] = {
    url: `${baseUrl}/location`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.95,
  }

  // Get all movie slugs
  console.log('Fetching movie slugs...')
  const movieSlugs = getAllMovieSlugs()
  console.log(`Found ${movieSlugs.length} movie slugs`)
  
  if (movieSlugs.length === 0) {
    console.error('WARNING: No movie slugs found! Check data files.')
  }

  // Movie pages - batch process for better performance
  const moviePages: MetadataRoute.Sitemap = movieSlugs.map((slug) => ({
    url: `${baseUrl}/movie/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Location pages
  console.log('Fetching location slugs...')
  const locationSlugs = getAllLocationSlugs()
  console.log(`Found ${locationSlugs.length} location slugs`)
  
  if (locationSlugs.length === 0) {
    console.error('WARNING: No location slugs found! Check data directory.')
  }

  const locationPages: MetadataRoute.Sitemap = locationSlugs.map((slug) => ({
    url: `${baseUrl}/location/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9, // High priority for location landing pages
  }))

  const totalPages = 3 + locationPages.length + moviePages.length
  console.log(`Total sitemap entries: ${totalPages}`)
  console.log('=== SITEMAP GENERATION END ===')

  return [homepage, blogPage, locationsIndex, ...locationPages, ...moviePages]
}

// For very large sitemaps (10k+ pages), you can split into multiple sitemaps:
// See: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
