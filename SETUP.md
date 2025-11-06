# Setup Guide for CineMap

Quick guide for setting up the project after cloning from GitHub.

## 📋 Prerequisites

- Node.js 18+ installed
- TMDb API account (free)

## 🚀 Setup Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cinemap.git
cd cinemap
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your TMDb API credentials:

```env
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token_here
```

**How to get TMDb credentials:**
1. Go to https://www.themoviedb.org/signup
2. Create a free account
3. Go to Settings → API
4. Request an API key (choose "Developer" option)
5. Copy both the API Key and Read Access Token

### 4. Generate Initial Data

The repository doesn't include the generated data files (they're too large). Generate them:

```bash
# Scrape movie locations from IMDb (takes ~12 minutes for 20 movies)
npm run fetch:auto

# Transform to GeoJSON for the map
npm run transform:geojson
```

### 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser!

## 📁 What's Included

✅ Source code (`src/`)
✅ Scripts for data collection (`scripts/`)
✅ Sample movie list (`data/movies_input.json`)
✅ Configuration files

## 📁 What's NOT Included (Generated)

❌ `.env` - Your API keys (create from `.env.example`)
❌ `node_modules/` - Dependencies (run `npm install`)
❌ `dist/` - Build output (run `npm run build`)
❌ `data/movies_enriched.json` - Generated movie data (run `npm run fetch:auto`)
❌ `public/geo/movies.geojson` - Generated map data (run `npm run transform:geojson`)
❌ `data/cache/` - Cached API responses (auto-created during scraping)

## 🎬 Adding More Movies

1. Edit `data/movies_input.json`
2. Add IMDb IDs (format: `{"imdb_id": "tt0111161", "title": "Movie Name"}`)
3. Run `npm run fetch:auto` to scrape
4. Run `npm run transform:geojson` to update map
5. Refresh the dev server

## 🐛 Troubleshooting

### "Failed to load data"
- Make sure you ran `npm run fetch:auto` first
- Check that `data/movies_enriched.json` exists

### "TMDb API error"
- Verify your API key in `.env` is correct
- Check you haven't exceeded the free tier limit (1000 requests/day)

### Scraper is slow
- Normal! Puppeteer launches a real browser
- ~35 seconds per movie is expected
- Progress is saved - you can stop and resume

### Geocoding failures
- Some specific addresses can't be geocoded
- The scraper will still get city-level coordinates
- This is normal and won't break the map

## 📚 Next Steps

- Read the main [README.md](README.md) for full documentation
- Check [package.json](package.json) for all available scripts
- Explore the codebase starting from [src/App.tsx](src/App.tsx)

---

**Questions?** Open an issue on GitHub!
