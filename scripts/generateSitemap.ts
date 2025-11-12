/**
 * Generate static sitemap.xml file
 * This script creates a sitemap during build time and saves it to public/sitemap.xml
 * Solves Vercel deployment issues with dynamic sitemaps
 */

import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://filmingmap.com'

/**
 * Load slug mapping
 */
function getSlugMap(): Record<string, string> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'movies_slugs.json')
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(fileContent)
  } catch (error) {
    console.error('Failed to load slug map:', error)
    return {}
  }
}

/**
 * Get all movie slugs
 */
function getAllMovieSlugs(): string[] {
  const slugMap = getSlugMap()
  return Object.keys(slugMap)
}

/**
 * Get all location slugs from data directory
 */
function getAllLocationSlugs(): string[] {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    
    if (!fs.existsSync(dataDir)) {
      console.error('Data directory does not exist:', dataDir)
      return []
    }
    
    const files = fs.readdirSync(dataDir)
    const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))
    
    return locationFiles.map(f => f.replace('location_', '').replace('.json', ''))
  } catch (error) {
    console.error('Error reading location files:', error)
    return []
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

/**
 * Generate sitemap XML
 */
function generateSitemapXML(): string {
  const now = new Date().toISOString()
  
  console.log('🗺️  Generating static sitemap.xml...')
  console.log('Base URL:', BASE_URL)
  
  // Start XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  
  // Homepage
  xml += '  <url>\n'
  xml += `    <loc>${escapeXml(BASE_URL)}</loc>\n`
  xml += `    <lastmod>${now}</lastmod>\n`
  xml += '    <changefreq>daily</changefreq>\n'
  xml += '    <priority>1.0</priority>\n'
  xml += '  </url>\n'
  
  // Blog page
  xml += '  <url>\n'
  xml += `    <loc>${escapeXml(`${BASE_URL}/blog`)}</loc>\n`
  xml += `    <lastmod>${now}</lastmod>\n`
  xml += '    <changefreq>monthly</changefreq>\n'
  xml += '    <priority>0.8</priority>\n'
  xml += '  </url>\n'
  
  // Locations index
  xml += '  <url>\n'
  xml += `    <loc>${escapeXml(`${BASE_URL}/location`)}</loc>\n`
  xml += `    <lastmod>${now}</lastmod>\n`
  xml += '    <changefreq>weekly</changefreq>\n'
  xml += '    <priority>0.95</priority>\n'
  xml += '  </url>\n'
  
  // Location pages
  const locationSlugs = getAllLocationSlugs()
  console.log(`📍 Adding ${locationSlugs.length} location pages...`)
  
  for (const slug of locationSlugs) {
    xml += '  <url>\n'
    xml += `    <loc>${escapeXml(`${BASE_URL}/location/${slug}`)}</loc>\n`
    xml += `    <lastmod>${now}</lastmod>\n`
    xml += '    <changefreq>weekly</changefreq>\n'
    xml += '    <priority>0.9</priority>\n'
    xml += '  </url>\n'
  }
  
  // Movie pages
  const movieSlugs = getAllMovieSlugs()
  console.log(`🎬 Adding ${movieSlugs.length} movie pages...`)
  
  for (const slug of movieSlugs) {
    xml += '  <url>\n'
    xml += `    <loc>${escapeXml(`${BASE_URL}/movie/${slug}`)}</loc>\n`
    xml += `    <lastmod>${now}</lastmod>\n`
    xml += '    <changefreq>monthly</changefreq>\n'
    xml += '    <priority>0.8</priority>\n'
    xml += '  </url>\n'
  }
  
  // Close XML
  xml += '</urlset>\n'
  
  const totalEntries = 3 + locationSlugs.length + movieSlugs.length
  console.log(`📊 Total sitemap entries: ${totalEntries}`)
  
  return xml
}

/**
 * Main execution
 */
function main() {
  try {
    // Generate sitemap XML
    const sitemapXML = generateSitemapXML()
    
    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), 'public')
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }
    
    // Write to public/sitemap.xml
    const outputPath = path.join(publicDir, 'sitemap.xml')
    fs.writeFileSync(outputPath, sitemapXML, 'utf-8')
    
    console.log(`✅ Sitemap saved to: ${outputPath}`)
    console.log(`📏 File size: ${(sitemapXML.length / 1024).toFixed(2)} KB`)
    
  } catch (error) {
    console.error('❌ Error generating sitemap:', error)
    process.exit(1)
  }
}

// Run the script
main()
