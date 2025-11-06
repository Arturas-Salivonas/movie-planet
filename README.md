# CineMap 🎬🌍

> An interactive 3D globe visualization showing authentic filming locations from the world's greatest movies.

[![MapLibre GL JS](https://img.shields.io/badge/MapLibre-GL%20JS-blue)](https://maplibre.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-purple)](https://vitejs.dev/)

## ✨ Features

- **🌍 Interactive 3D Globe** - Smooth rotating globe with MapLibre GL JS
- **🎬 20 Top-Rated Movies** - Curated collection with accurate filming locations
- **📍 Verified Locations** - All locations scraped directly from IMDb (60+ locations)
- **🔍 Smart Filtering** - Search and filter by genre, year, rating
- **🎯 Focus Mode** - Click "Show All on Map" to isolate a single movie's locations
- **🎨 Beautiful UI** - Circular movie posters, amber connecting lines, cinematic design
- **⚡ Fast & Responsive** - Built with Vite and React for optimal performance

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- TMDb API key (free - [get one here](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cinemap.git
   cd cinemap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your TMDb API credentials:
   ```env
   TMDB_API_KEY=your_api_key_here
   TMDB_API_READ_ACCESS_TOKEN=your_token_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📦 Project Structure

```
cinemap/
├── src/
│   ├── components/
│   │   ├── Map.tsx           # 3D globe with MapLibre GL JS
│   │   ├── Filters.tsx       # Search and filter controls
│   │   ├── MovieModal.tsx    # Movie details popup
│   │   └── SearchBar.tsx     # Movie search input
│   ├── utils/
│   │   ├── helpers.ts        # Filter and utility functions
│   │   └── mapbox.ts         # Map styling utilities
│   ├── types.ts              # TypeScript interfaces
│   ├── App.tsx               # Main application
│   └── main.tsx              # Entry point
├── scripts/
│   ├── fetchMoviesAuto.ts    # Automated IMDb scraper (Puppeteer)
│   ├── transform_to_geojson.ts  # Data transformer
│   └── generateSearchIndex.ts   # Search index generator
├── data/
│   ├── movies_input.json     # Input: List of IMDb IDs
│   └── movies_enriched.json  # Output: Full movie data with locations
├── public/
│   └── geo/
│       └── movies.geojson    # Generated GeoJSON for map
└── package.json
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start dev server

# Data Collection
npm run fetch:auto       # Scrape movies from IMDb (Puppeteer)
npm run transform:geojson # Convert enriched data to GeoJSON

# Build
npm run build            # Production build
npm run preview          # Preview production build
```

## 📊 How It Works

### 1. Data Collection
Add IMDb IDs to `data/movies_input.json`:
```json
[
  {"imdb_id": "tt0111161", "title": "The Shawshank Redemption"},
  {"imdb_id": "tt0068646", "title": "The Godfather"}
]
```

### 2. Automated Scraping
Run the scraper to fetch accurate filming locations:
```bash
npm run fetch:auto
```

The scraper:
- 🎯 Finds TMDb ID from IMDb ID
- 📽️ Fetches movie metadata (title, year, poster, rating)
- 📍 Scrapes filming locations from IMDb using Puppeteer
- 🗺️ Geocodes locations via Nominatim (OpenStreetMap)
- 💾 Caches all data to avoid redundant requests
- ⚡ Rate-limited to respect API guidelines

### 3. Transform to GeoJSON
Convert the enriched data to map-ready format:
```bash
npm run transform:geojson
```

### 4. View on Map
Start the dev server and explore:
```bash
npm run dev
```

## 🌟 Key Features Explained

### Globe Rotation
The globe automatically rotates slowly on page load. It stops when you interact with the map (drag, zoom, or click).

### Focus Mode
Click "Show All on Map" in any movie modal to:
- Hide all other movie markers
- Show only the selected movie's locations
- Display amber connecting lines between locations
- Center the map on those locations

### Circular Markers
Movie posters are displayed as circular markers with:
- 60px diameter
- White borders
- Clean, modern aesthetic
- No distracting badges

### Smart Caching
All data is cached in `data/cache/`:
- **TMDb data**: `tmdb_movie_*.json`
- **Geocoding**: `geocode_*.json`
- Prevents redundant API calls
- Speeds up subsequent runs

## 🎬 Scaling to 10,000+ Movies

The system is designed to handle large-scale data collection:

1. **Add movies** to `data/movies_input.json` (just IMDb IDs)
2. **Run scraper** overnight: `npm run fetch:auto`
3. **Transform data**: `npm run transform:geojson`
4. **Deploy**: `npm run build`

**Estimated time for 10,000 movies**: 8-12 hours
- ~35 seconds per movie (Puppeteer + geocoding)
- Progress saved continuously
- Resumable on crashes

## 🔑 API Keys & Rate Limits

### TMDb API (Required)
- Free tier: 1,000 requests per day
- Get your key: https://www.themoviedb.org/settings/api
- Used for: Movie metadata (title, poster, year, rating)

### Nominatim Geocoding (Free)
- Rate limit: 1 request per second (hardcoded in scraper)
- No API key needed
- Used for: Converting location names to coordinates

### MapLibre GL JS (Free)
- No API key required
- Uses OpenStreetMap data
- Completely free and open-source

## 🤝 Contributing

This is currently a personal backup project, but suggestions are welcome!

## 📝 License

MIT License - feel free to use this for your own projects!

## 🙏 Acknowledgments

- **IMDb** - Filming location data
- **TMDb** - Movie metadata and posters
- **OpenStreetMap** - Map data
- **Nominatim** - Geocoding service
- **MapLibre GL JS** - 3D globe visualization

---

**Made with ❤️ for cinema and cartography**
- **Stage 5**: Interactive UI components
- **Stage 6**: Static page generation for SEO
- **Stage 7**: Deployment to Vercel

## License

TBD

---

**Generated**: November 5, 2025
