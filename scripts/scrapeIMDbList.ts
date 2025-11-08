/**
 * IMDb List Scraper
 *
 * Automatically scrapes IMDb to discover movies and TV shows
 * Usage:
 *   npm run scrape:movies 100  - Add 100 movies
 *   npm run scrape:tvshows 50  - Add 50 TV shows
 *   npm run scrape:all 200     - Add 200 mixed content
 *
 * Features:
 *   - Tracks scraped items to prevent duplicates
 *   - Resumes from last checkpoint
 *   - Filters out items already in database
 *   - Progressive scraping of IMDb lists
 */

import puppeteer, { Page } from 'puppeteer'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface IMDbItem {
  imdb_id: string
  title: string
  year: number
  type: 'movie' | 'tvshow'
  rating?: number
}

interface ScrapingState {
  lastScrapedPage: number
  lastScrapedIndex: number
  scrapedItems: Set<string>
  timestamp: string
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  INPUT_FILE: 'data/movies_input.json',
  STATE_FILE: 'data/scraping_state.json',

  // IMDb URLs for different content types
  IMDB_URLS: {
    movies: [
      'https://www.imdb.com/search/title/?title_type=feature&sort=num_votes,desc&start=', // Popular movies
    ],
    tvshows: [
      'https://www.imdb.com/search/title/?title_type=tv_series&sort=num_votes,desc&start=', // Popular TV shows
    ],
    all: [
      'https://www.imdb.com/search/title/?title_type=feature,tv_series&sort=num_votes,desc&start=',
    ]
  },

  ITEMS_PER_PAGE: 50, // IMDb shows 50 items per page
  MAX_ITEMS_PER_URL: 1000, // Maximum items to load from a single URL (via "Load More")
  REQUEST_DELAY: 2000, // 2 seconds between requests
  MAX_RETRIES: 3,
  HEADLESS: true,
}

// ============================================================================
// State Management
// ============================================================================

async function loadState(): Promise<ScrapingState> {
  try {
    const stateFile = path.join(__dirname, '..', CONFIG.STATE_FILE)
    const data = await fs.readFile(stateFile, 'utf-8')
    const state = JSON.parse(data)
    return {
      ...state,
      scrapedItems: new Set(state.scrapedItems || [])
    }
  } catch {
    return {
      lastScrapedPage: 0,
      lastScrapedIndex: 0,
      scrapedItems: new Set<string>(),
      timestamp: new Date().toISOString()
    }
  }
}

async function saveState(state: ScrapingState): Promise<void> {
  const stateFile = path.join(__dirname, '..', CONFIG.STATE_FILE)
  const data = {
    ...state,
    scrapedItems: Array.from(state.scrapedItems),
    timestamp: new Date().toISOString()
  }
  await fs.writeFile(stateFile, JSON.stringify(data, null, 2))
}

async function loadExistingItems(): Promise<Set<string>> {
  const inputFile = path.join(__dirname, '..', CONFIG.INPUT_FILE)
  try {
    const data = await fs.readFile(inputFile, 'utf-8')
    const items = JSON.parse(data)
    return new Set(items.map((item: any) => item.imdb_id).filter(Boolean))
  } catch {
    return new Set()
  }
}

async function addItemsToInput(newItems: IMDbItem[]): Promise<void> {
  const inputFile = path.join(__dirname, '..', CONFIG.INPUT_FILE)

  let existingItems: any[] = []
  try {
    const data = await fs.readFile(inputFile, 'utf-8')
    existingItems = JSON.parse(data)
  } catch {
    // File doesn't exist, start fresh
  }

  // Convert to input format
  const formattedItems = newItems.map(item => ({
    imdb_id: item.imdb_id,
    title: item.title,
    year: item.year,
    type: item.type
  }))

  // Append new items
  const updatedItems = [...existingItems, ...formattedItems]
  await fs.writeFile(inputFile, JSON.stringify(updatedItems, null, 2))

  console.log(`✅ Added ${newItems.length} items to ${CONFIG.INPUT_FILE}`)
}

// ============================================================================
// Scraping Functions
// ============================================================================

async function scrapeIMDbSearchPage(page: Page, url: string, maxItems: number = 500): Promise<IMDbItem[]> {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

  // Wait for the content to load
  await page.waitForSelector('.lister-item, .ipc-metadata-list-summary-item', { timeout: 10000 })

  // Check if we're on the new IMDb design with "Load More" button
  const hasLoadMoreButton = await page.$('.ipc-see-more__button')

  if (hasLoadMoreButton) {
    console.log(`   🔄 New IMDb design detected - using "Load More" strategy`)    // Keep clicking "Load More" until we have enough items or button disappears
    let previousCount = 0
    let stuckCount = 0

    while (stuckCount < 3) {
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('.ipc-metadata-list-summary-item').length
      })

      console.log(`   📊 Loaded ${currentCount} items so far...`)

      if (currentCount >= maxItems) {
        console.log(`   ✅ Reached target of ${maxItems} items`)
        break
      }

      // Check if we're stuck (no new items loaded)
      if (currentCount === previousCount) {
        stuckCount++
        console.log(`   ⏳ Waiting for more items... (${stuckCount}/3)`)
      } else {
        stuckCount = 0
      }
      previousCount = currentCount

      // Try to find and click the "Load More" button
      try {
        // Find and click button using page.evaluate (more reliable)
        const buttonClicked = await page.evaluate(() => {
          const selectors = [
            'button.ipc-see-more__button',
            'button[class*="ipc-see-more"]',
            '.ipc-see-more button'
          ]

          for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector)
            for (const btn of buttons) {
              const text = btn.textContent || ''
              if (text.toLowerCase().includes('more')) {
                (btn as HTMLButtonElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => (btn as HTMLButtonElement).click(), 300)
                return true
              }
            }
          }
          return false
        })

        if (!buttonClicked) {
          console.log(`   ℹ️  No more "Load More" button found`)
          break
        }

        // Wait for new content to load
        await new Promise(resolve => setTimeout(resolve, 2000)) // Give it time to load

      } catch (error: any) {
        console.log(`   ⚠️  Could not click "Load More": ${error.message}`)
        break
      }
    }

    console.log(`   ✅ Finished loading items via "Load More" button`)
  }

  const items = await page.evaluate(() => {
    const results: IMDbItem[] = []

    // New IMDb design selector
    const newItems = document.querySelectorAll('.ipc-metadata-list-summary-item')
    if (newItems.length > 0) {
      newItems.forEach(item => {
        const titleElement = item.querySelector('.ipc-title__text')
        const linkElement = item.querySelector('a.ipc-title-link-wrapper')
        const metadataElements = item.querySelectorAll('.ipc-inline-list__item')
        const ratingElement = item.querySelector('[data-testid="ratingGroup--imdb-rating"]')

        if (!linkElement || !titleElement) return

        const href = (linkElement as HTMLAnchorElement).href
        const imdbMatch = href.match(/\/title\/(tt\d+)/)
        if (!imdbMatch) return

        const titleText = titleElement.textContent?.trim() || ''
        const titleMatch = titleText.match(/^\d+\.\s*(.+)/) // Remove ranking number
        const title = titleMatch ? titleMatch[1] : titleText

        let year = 0
        let type: 'movie' | 'tvshow' = 'movie'

        // Extract year and type from metadata
        metadataElements.forEach(el => {
          const text = el.textContent?.trim() || ''
          const yearMatch = text.match(/(\d{4})/)
          if (yearMatch) year = parseInt(yearMatch[1])
          if (text.toLowerCase().includes('tv') || text.toLowerCase().includes('series')) {
            type = 'tvshow'
          }
        })

        let rating: number | undefined
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim()
          const ratingMatch = ratingText?.match(/(\d+\.\d+)/)
          if (ratingMatch) rating = parseFloat(ratingMatch[1])
        }

        results.push({
          imdb_id: imdbMatch[1],
          title,
          year: year || new Date().getFullYear(),
          type,
          rating
        })
      })
    } else {
      // Old IMDb design selector
      const oldItems = document.querySelectorAll('.lister-item')
      oldItems.forEach(item => {
        const titleElement = item.querySelector('.lister-item-header a')
        const yearElement = item.querySelector('.lister-item-year')
        const ratingElement = item.querySelector('.ratings-imdb-rating strong')
        const typeElement = item.querySelector('.genre')

        if (!titleElement) return

        const href = (titleElement as HTMLAnchorElement).href
        const imdbMatch = href.match(/\/title\/(tt\d+)/)
        if (!imdbMatch) return

        const title = titleElement.textContent?.trim() || ''

        let year = new Date().getFullYear()
        if (yearElement) {
          const yearMatch = yearElement.textContent?.match(/(\d{4})/)
          if (yearMatch) year = parseInt(yearMatch[1])
        }

        let type: 'movie' | 'tvshow' = 'movie'
        if (typeElement?.textContent?.toLowerCase().includes('tv') ||
            item.textContent?.toLowerCase().includes('tv series')) {
          type = 'tvshow'
        }

        let rating: number | undefined
        if (ratingElement) {
          rating = parseFloat(ratingElement.textContent || '0')
        }

        results.push({
          imdb_id: imdbMatch[1],
          title,
          year,
          type,
          rating
        })
      })
    }

    return results
  })

  return items
}

async function scrapeIMDbTopChart(page: Page, url: string, type: 'movie' | 'tvshow'): Promise<IMDbItem[]> {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

  await page.waitForSelector('.titleColumn, .ipc-metadata-list-summary-item', { timeout: 10000 })

  const items = await page.evaluate((itemType: 'movie' | 'tvshow') => {
    const results: IMDbItem[] = []

    // Try new design first
    const newItems = document.querySelectorAll('.ipc-metadata-list-summary-item')
    if (newItems.length > 0) {
      newItems.forEach(item => {
        const linkElement = item.querySelector('a.ipc-title-link-wrapper')
        const titleElement = item.querySelector('.ipc-title__text')
        const yearElement = item.querySelector('.cli-title-metadata-item')
        const ratingElement = item.querySelector('[data-testid="ratingGroup--imdb-rating"]')

        if (!linkElement || !titleElement) return

        const href = (linkElement as HTMLAnchorElement).href
        const imdbMatch = href.match(/\/title\/(tt\d+)/)
        if (!imdbMatch) return

        const titleText = titleElement.textContent?.trim() || ''
        const titleMatch = titleText.match(/^\d+\.\s*(.+)/)
        const title = titleMatch ? titleMatch[1] : titleText

        let year = new Date().getFullYear()
        if (yearElement) {
          const yearMatch = yearElement.textContent?.match(/(\d{4})/)
          if (yearMatch) year = parseInt(yearMatch[1])
        }

        let rating: number | undefined
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim()
          const ratingMatch = ratingText?.match(/(\d+\.\d+)/)
          if (ratingMatch) rating = parseFloat(ratingMatch[1])
        }

        results.push({
          imdb_id: imdbMatch[1],
          title,
          year,
          type: itemType,
          rating
        })
      })
    } else {
      // Old design
      const oldItems = document.querySelectorAll('.titleColumn')
      oldItems.forEach(item => {
        const linkElement = item.querySelector('a')
        const yearElement = item.querySelector('.secondaryInfo')

        if (!linkElement) return

        const href = linkElement.href
        const imdbMatch = href.match(/\/title\/(tt\d+)/)
        if (!imdbMatch) return

        const title = linkElement.textContent?.trim() || ''

        let year = new Date().getFullYear()
        if (yearElement) {
          const yearMatch = yearElement.textContent?.match(/(\d{4})/)
          if (yearMatch) year = parseInt(yearMatch[1])
        }

        // Find rating in sibling elements
        const parent = item.parentElement
        const ratingElement = parent?.querySelector('.ratingColumn strong')
        let rating: number | undefined
        if (ratingElement) {
          rating = parseFloat(ratingElement.textContent || '0')
        }

        results.push({
          imdb_id: imdbMatch[1],
          title,
          year,
          type: itemType,
          rating
        })
      })
    }

    return results
  }, type)

  return items
}

// ============================================================================
// Main Scraping Logic
// ============================================================================

async function scrapeContent(
  contentType: 'movies' | 'tvshows' | 'all',
  targetCount: number
): Promise<IMDbItem[]> {
  console.log(`\n🎬 Starting IMDb ${contentType} scraper`)
  console.log(`🎯 Target: ${targetCount} new items\n`)

  const browser = await puppeteer.launch({
    headless: CONFIG.HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  // Set user agent to avoid bot detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  const state = await loadState()
  const existingIds = await loadExistingItems()
  const scrapedItems: IMDbItem[] = []

  console.log(`📊 Database status:`)
  console.log(`   Items in database: ${existingIds.size}`)
  console.log(`   Previously scraped: ${state.scrapedItems.size}`)
  console.log(`   Starting from page: ${state.lastScrapedPage + 1}\n`)

  const urls = CONFIG.IMDB_URLS[contentType]
  let currentPage = state.lastScrapedPage

  try {
    while (scrapedItems.length < targetCount) {
      for (const baseUrl of urls) {
        // Handle Top 250 charts differently (they're single pages)
        if (baseUrl.includes('/chart/')) {
          console.log(`📄 Scraping Top 250 chart: ${baseUrl}`)

          const type = contentType === 'tvshows' ? 'tvshow' : 'movie'
          const items = await scrapeIMDbTopChart(page, baseUrl, type)

          // Filter out duplicates
          const newItems = items.filter(item =>
            !existingIds.has(item.imdb_id) &&
            !state.scrapedItems.has(item.imdb_id)
          )

          newItems.forEach(item => {
            if (scrapedItems.length < targetCount) {
              scrapedItems.push(item)
              state.scrapedItems.add(item.imdb_id)
              existingIds.add(item.imdb_id) // Prevent duplicates in same run
            }
          })

          console.log(`   Found ${items.length} items, ${newItems.length} new`)

          if (scrapedItems.length >= targetCount) break

        } else {
          // Handle paginated search results (new design uses "Load More" button)
          const startIndex = currentPage * CONFIG.ITEMS_PER_PAGE + 1
          const url = `${baseUrl}${startIndex}`

          console.log(`📄 Page ${currentPage + 1}: ${url}`)
          console.log(`   🎯 Will attempt to load up to ${CONFIG.MAX_ITEMS_PER_URL} items from this URL`)

          let retries = 0
          let items: IMDbItem[] = []

          while (retries < CONFIG.MAX_RETRIES) {
            try {
              // Pass the max items we want to load from this URL
              items = await scrapeIMDbSearchPage(page, url, CONFIG.MAX_ITEMS_PER_URL)
              break
            } catch (error: any) {
              retries++
              console.log(`   ⚠️  Retry ${retries}/${CONFIG.MAX_RETRIES}: ${error.message}`)
              if (retries < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY * 2))
              }
            }
          }

          if (items.length === 0) {
            console.log(`   ⚠️  No more items found, stopping pagination`)
            break
          }

          // Filter out duplicates
          const newItems = items.filter(item =>
            !existingIds.has(item.imdb_id) &&
            !state.scrapedItems.has(item.imdb_id)
          )

          newItems.forEach(item => {
            if (scrapedItems.length < targetCount) {
              scrapedItems.push(item)
              state.scrapedItems.add(item.imdb_id)
              existingIds.add(item.imdb_id)

              console.log(`   ✅ ${item.imdb_id}: ${item.title} (${item.year}) ${item.rating ? `⭐ ${item.rating}` : ''}`)
            }
          })

          console.log(`   Found ${items.length} items, ${newItems.length} new, total: ${scrapedItems.length}/${targetCount}`)

          currentPage++
          state.lastScrapedPage = currentPage

          // Save state after each page
          await saveState(state)

          if (scrapedItems.length >= targetCount) break

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY))
        }
      }

      // If we've gone through all URLs and still don't have enough items, break
      if (scrapedItems.length < targetCount) {
        console.log(`\n⚠️  Reached end of available items`)
        break
      }
    }

  } finally {
    await browser.close()
  }

  return scrapedItems
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
🎬 IMDb Content Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  npm run scrape:movies <count>    Scrape movies
  npm run scrape:tvshows <count>   Scrape TV shows
  npm run scrape:all <count>       Scrape mixed content

Examples:
  npm run scrape:movies 100        Add 100 new movies
  npm run scrape:tvshows 50        Add 50 new TV shows
  npm run scrape:all 200           Add 200 mixed items

Features:
  ✓ Auto-detects duplicates
  ✓ Resumes from last position
  ✓ Saves progress continuously
  ✓ Works with existing database

After scraping:
  npm run fetch                     Process the scraped items
    `)
    process.exit(0)
  }

  // Determine content type from script name or argument
  const scriptName = process.argv[1]
  let contentType: 'movies' | 'tvshows' | 'all' = 'all'

  if (scriptName.includes('movies')) {
    contentType = 'movies'
  } else if (scriptName.includes('tvshows') || scriptName.includes('tv')) {
    contentType = 'tvshows'
  }

  // Allow override via argument
  if (args[0]?.match(/^(movies|tvshows|all)$/)) {
    contentType = args[0] as 'movies' | 'tvshows' | 'all'
    args.shift()
  }

  const count = parseInt(args[0] || '50')

  if (isNaN(count) || count <= 0) {
    console.error('❌ Invalid count. Please provide a positive number.')
    process.exit(1)
  }

  const items = await scrapeContent(contentType, count)

  if (items.length > 0) {
    await addItemsToInput(items)

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`\n✅ Successfully scraped ${items.length} new ${contentType}!`)
    console.log(`\n📊 Summary:`)

    const movies = items.filter(i => i.type === 'movie').length
    const tvshows = items.filter(i => i.type === 'tvshow').length

    if (movies > 0) console.log(`   Movies: ${movies}`)
    if (tvshows > 0) console.log(`   TV Shows: ${tvshows}`)

    console.log(`\n📝 Items added to: ${CONFIG.INPUT_FILE}`)
    console.log(`\n📌 Next step:`)
    console.log(`   npm run fetch    Process these items and fetch details\n`)
  } else {
    console.log(`\n⚠️  No new items found. All items may already be in database.`)
  }
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
