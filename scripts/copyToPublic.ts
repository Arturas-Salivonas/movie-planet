/**
 * Copy movies_enriched.json to public/data for Next.js serving
 *
 * This ensures the file is available at /data/movies_enriched.json during runtime
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function copyToPublic() {
  try {
    const sourcePath = path.join(__dirname, '../data/movies_enriched.json')
    const destPath = path.join(__dirname, '../public/data/movies_enriched.json')

    console.log('📂 Copying movies_enriched.json to public folder...')

    // Ensure source exists
    try {
      await fs.access(sourcePath)
    } catch {
      console.error('❌ Source file not found:', sourcePath)
      console.log('💡 Run "npm run fetch" first to generate the database')
      process.exit(1)
    }

    // Ensure public/data directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true })

    // Copy the file
    await fs.copyFile(sourcePath, destPath)

    const stats = await fs.stat(destPath)
    console.log(`✅ Copied to public/data/movies_enriched.json (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

copyToPublic()
