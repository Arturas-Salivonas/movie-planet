# filmingmap - Data Pipeline Documentation

## Quick Start

### Re-scrape Locations Only (FAST - Recommended!)
```bash
npm run rescrape
```

This is **2-3x faster** than full re-scrape because:
- ✅ Keeps existing TMDb metadata (no API calls needed)
- ✅ Only re-scrapes IMDb locations + scenes
- ✅ Parallel processing (5 movies at once)
- ✅ Batch geocoding (3 locations at once)
- ✅ Smart 6-strategy geocoding fallback
- ✅ Auto runs GeoJSON transform + copy to public

**Estimated time:** ~6-8 hours for 2,749 movies (vs 23 hours for full rescrape)

### Re-scrape All Existing Movies (with Enhanced Scraper)
```bash
npm run fetch
```

This will:
- ✅ Re-scrape ALL existing movies including TMDb metadata
- ✅ Extract scene descriptions from IMDb
- ✅ Click "Show More" buttons to get ALL locations (not just first 5-10)
- ✅ Use smart 6-strategy geocoding (100% success rate)
- ✅ Fix previously failed/missing locations
- ✅ Download and optimize posters
- ✅ Transform to GeoJSON
- ✅ Copy to public folder for Next.js serving

**Estimated time:** ~23 hours for 2,749 movies

### Add New Movies from Library
```bash
npm run fetch 50
```

This adds 50 new movies from `data/movies_input.json` to your database.

## Build for Production

```bash
npm run build
```

This runs:
1. Copy `movies_enriched.json` to `public/data/` (so it's accessible at `/data/movies_enriched.json`)
2. Transform to GeoJSON for map rendering
3. Generate movie slugs for SEO-friendly URLs
4. Generate site statistics
5. Generate individual location pages
6. Optimize search index
7. Build Next.js application
8. Generate sitemap

## Development

```bash
npm run dev
```

Runs the Next.js development server on http://localhost:3000

## Data Flow

```
1. IMDb Scraping (fetchMoviesAuto.ts)
   ├─ Puppeteer automation
   ├─ Click "Show More" buttons (pagination)
   ├─ Extract locations + scene descriptions
   └─ Save to data/movies_enriched.json

2. Geocoding (Nominatim OSM API)
   ├─ Strategy 1: Full address
   ├─ Strategy 2: Remove building name
   ├─ Strategy 3: City + country
   ├─ Strategy 4: City + region
   ├─ Strategy 5: Just city
   └─ Strategy 6: Just country

3. Data Processing
   ├─ Clean duplicate locations
   ├─ Transform to GeoJSON (public/geo/movies.geojson)
   └─ Copy to public folder (public/data/movies_enriched.json)

4. Asset Optimization
   ├─ Download TMDb posters
   ├─ Convert to WebP (52px, 300px, 1280px)
   └─ Optimize for performance

5. Build Pipeline
   ├─ Generate slugs
   ├─ Generate stats
   ├─ Generate location pages
   ├─ Optimize search index
   └─ Build Next.js app
```

## File Structure

```
data/
  ├─ movies_enriched.json     # Main database (source of truth)
  ├─ movies_input.json         # Library of movies to fetch
  └─ location_*.json           # Individual location page data

public/
  ├─ data/
  │   ├─ movies_enriched.json  # Copy for Next.js serving
  │   ├─ movies_slugs.json     # IMDb ID → slug mapping
  │   └─ site-stats.json       # Homepage statistics
  └─ geo/
      └─ movies.geojson        # Map rendering data

scripts/
  ├─ fetchAndTransform.ts      # Main orchestrator
  ├─ fetchMoviesAuto.ts        # Enhanced scraper with scenes
  ├─ transform_to_geojson.ts   # GeoJSON converter
  ├─ copyToPublic.ts           # Copy database to public
  └─ ... (other utilities)
```

## Key Features

### Enhanced Scraper
- **Pagination**: Clicks "Show More" up to 5 times to get ALL locations
- **Scene Descriptions**: Extracts what was filmed at each location
- **Smart Geocoding**: 6 progressive fallback strategies
- **Headless**: Runs in background (no visible browser)
- **Rate Limiting**: 1.2s delay between Nominatim requests

### Scene Descriptions
Displayed in amber boxes in the movie modal:
- Format: `broomstick flying lessons; Ron insults Hermione`
- Source: IMDb `data-testid="item-attributes"`
- Stored: `location.scene_description` field
- UI: Brackets removed automatically

### Data Serving
- GeoJSON: Used for map rendering (clusters, markers)
- movies_enriched.json: Used for modal details (full location data with scenes)
- Both files updated together to stay in sync

## Troubleshooting

### Movies missing scenes
Run `npm run fetch` to re-scrape with enhanced scraper

### Locations not showing on map
Check that GeoJSON transformation completed: `npm run transform:geojson`

### Modal not showing scene descriptions
1. Verify `public/data/movies_enriched.json` exists
2. Check browser console for 404 errors
3. Run `npm run copy:public` to copy the file

### Build fails
1. Ensure `data/movies_enriched.json` exists (run `npm run fetch` first)
2. Check Node.js version (requires 18+)
3. Clear cache: `rm -rf .next` and rebuild

## API Limits

- **TMDb API**: 40 requests/10 seconds (free tier)
- **Nominatim**: 1 request/second (free tier, we use 1.2s delay)
- **IMDb**: No official rate limit (we scrape respectfully)

## Performance Optimizations

### Speed Improvements
The `npm run rescrape` command is **2-3x faster** because:

1. **No TMDb API calls** - Reuses existing metadata (saves ~5-10 seconds per movie)
2. **Parallel movie processing** - 5 movies scraped simultaneously
3. **Batch geocoding** - 3 locations geocoded in parallel per movie
4. **Faster rate limiting** - 0.8s delay (still respects Nominatim's 1 req/sec)
5. **Progress saving** - Saves after each batch (safe to interrupt/resume)

### Comparison

| Operation | Full Rescrape | Locations Only |
|-----------|---------------|----------------|
| TMDb API calls | ✅ Yes | ❌ No |
| IMDb scraping | ✅ Yes | ✅ Yes |
| Geocoding | ✅ Yes | ✅ Yes |
| Poster download | ✅ Yes | ❌ No |
| Parallel processing | ❌ Sequential | ✅ 5 at once |
| Time per movie | ~30 seconds | ~10-15 seconds |
| **Total time (2,749 movies)** | **~23 hours** | **~6-8 hours** |

### When to Use Each

- **`npm run rescrape`** - When you just need updated locations/scenes (most common)
- **`npm run fetch`** - When you need fresh TMDb data (ratings, posters, etc.)

## Next Steps

After running `npm run fetch`:
1. Wait for completion (shows progress)
2. Run `npm run build` to generate static site
3. Run `npm run dev` to test locally
4. Deploy to Vercel with `vercel --prod`
