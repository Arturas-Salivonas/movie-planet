/**
 * Initialize or Reset Scraping State
 *
 * This utility manages the scraping state file
 *
 * Usage:
 *   npm run scrape:init           - Initialize state from existing data
 *   npm run scrape:reset          - Reset to clean state
 *   npm run scrape:status         - Show current status
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG = {
  INPUT_FILE: 'data/movies_input.json',
  ENRICHED_FILE: 'data/movies_enriched.json',
  STATE_FILE: 'data/scraping_state.json',
}

interface ScrapingState {
  lastScrapedPage: number
  lastScrapedIndex: number
  scrapedItems: string[]
  timestamp: string
}

async function loadJSON(filename: string): Promise<any> {
  try {
    const filepath = path.join(__dirname, '..', filename)
    const data = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function saveState(state: ScrapingState): Promise<void> {
  const filepath = path.join(__dirname, '..', CONFIG.STATE_FILE)
  await fs.writeFile(filepath, JSON.stringify(state, null, 2))
}

async function initializeState(): Promise<void> {
  console.log('\n🔄 Initializing Scraping State\n')

  const inputData = await loadJSON(CONFIG.INPUT_FILE)
  const enrichedData = await loadJSON(CONFIG.ENRICHED_FILE)

  const scrapedItems = new Set<string>()

  // Add all items from input file
  if (inputData && Array.isArray(inputData)) {
    inputData.forEach((item: any) => {
      if (item.imdb_id) {
        scrapedItems.add(item.imdb_id)
      }
    })
    console.log(`📥 Found ${scrapedItems.size} items in input file`)
  }

  // Add all items from enriched file
  if (enrichedData && Array.isArray(enrichedData)) {
    enrichedData.forEach((item: any) => {
      if (item.imdb_id) {
        scrapedItems.add(item.imdb_id)
      }
    })
    console.log(`📚 Found ${scrapedItems.size} total unique items`)
  }

  const state: ScrapingState = {
    lastScrapedPage: 0,
    lastScrapedIndex: 0,
    scrapedItems: Array.from(scrapedItems),
    timestamp: new Date().toISOString()
  }

  await saveState(state)

  console.log(`\n✅ State initialized with ${state.scrapedItems.length} items`)
  console.log(`💾 Saved to: ${CONFIG.STATE_FILE}\n`)
}

async function resetState(): Promise<void> {
  console.log('\n🔄 Resetting Scraping State\n')

  const state: ScrapingState = {
    lastScrapedPage: 0,
    lastScrapedIndex: 0,
    scrapedItems: [],
    timestamp: new Date().toISOString()
  }

  await saveState(state)

  console.log('✅ State reset to clean slate')
  console.log(`💾 Saved to: ${CONFIG.STATE_FILE}`)
  console.log('\n⚠️  Warning: This will allow re-scraping of previously found items\n')
}

async function showStatus(): Promise<void> {
  console.log('\n📊 Scraping System Status\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const inputData = await loadJSON(CONFIG.INPUT_FILE)
  const enrichedData = await loadJSON(CONFIG.ENRICHED_FILE)
  const stateData = await loadJSON(CONFIG.STATE_FILE)

  // Input queue stats
  const inputCount = inputData?.length || 0
  const inputMovies = inputData?.filter((i: any) => i.type === 'movie' || !i.type).length || 0
  const inputTVShows = inputData?.filter((i: any) => i.type === 'tvshow').length || 0

  console.log('📥 INPUT QUEUE (movies_input.json)')
  console.log(`   Total items: ${inputCount}`)
  console.log(`   Movies: ${inputMovies}`)
  console.log(`   TV Shows: ${inputTVShows}`)
  console.log()

  // Enriched database stats
  const enrichedCount = enrichedData?.length || 0
  const enrichedWithLocations = enrichedData?.filter((i: any) => i.locations?.length > 0).length || 0

  console.log('📚 ENRICHED DATABASE (movies_enriched.json)')
  console.log(`   Total items: ${enrichedCount}`)
  console.log(`   With locations: ${enrichedWithLocations}`)
  console.log(`   Without locations: ${enrichedCount - enrichedWithLocations}`)
  console.log()

  // Scraping state stats
  if (stateData) {
    console.log('🔍 SCRAPING STATE (scraping_state.json)')
    console.log(`   Last page scraped: ${stateData.lastScrapedPage}`)
    console.log(`   Items in history: ${stateData.scrapedItems?.length || 0}`)
    console.log(`   Last updated: ${new Date(stateData.timestamp).toLocaleString()}`)
  } else {
    console.log('🔍 SCRAPING STATE')
    console.log('   ⚠️  No state file found')
    console.log('   Run: npm run scrape:init')
  }
  console.log()

  // Processing stats
  const pending = inputCount - enrichedCount
  const percentage = inputCount > 0 ? ((enrichedCount / inputCount) * 100).toFixed(1) : '0'

  console.log('⚙️  PROCESSING STATUS')
  console.log(`   Pending: ${pending} items`)
  console.log(`   Completed: ${percentage}%`)
  console.log()

  // Recommendations
  console.log('💡 NEXT STEPS')
  if (!stateData) {
    console.log('   1. Initialize state: npm run scrape:init')
  } else if (pending > 100) {
    console.log(`   1. Process pending items: npm run fetch:auto`)
    console.log(`   2. Add more content: npm run scrape:movies 50`)
  } else if (pending > 0) {
    console.log(`   1. Process ${pending} pending items: npm run fetch:auto`)
  } else {
    console.log('   1. Add more content: npm run scrape:movies 100')
  }
  console.log()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

async function main() {
  const command = process.argv[2]

  switch (command) {
    case 'init':
      await initializeState()
      break

    case 'reset':
      await resetState()
      break

    case 'status':
    case undefined:
      await showStatus()
      break

    default:
      console.log(`
🔧 Scraping State Manager

Usage:
  npm run scrape:init     Initialize state from existing data
  npm run scrape:reset    Reset to clean state
  npm run scrape:status   Show current status

Commands:
  init    - Populate state with all existing IMDb IDs
  reset   - Clear all state (allows re-scraping)
  status  - Show database and queue statistics
      `)
  }
}

main().catch(error => {
  console.error('\n💥 Error:', error.message)
  process.exit(1)
})
