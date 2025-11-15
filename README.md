# 🎬 FilmingMap.com

> An interactive 3D globe visualization platform that maps authentic filming locations from thousands of movies and TV series worldwide.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre-GL%20JS-blue)](https://maplibre.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)](https://tailwindcss.com/)

🌐 **Live Site**: [filmingmap.com](https://filmingmap.com)

## 📖 About

FilmingMap is a comprehensive platform that connects film enthusiasts with the real-world locations where their favorite movies and TV shows were filmed. Using an interactive 3D globe, users can explore thousands of filming locations, discover behind-the-scenes details, and plan their own movie tourism adventures.

### What Makes FilmingMap Special

- **Comprehensive Database**: 2,700+ movies and TV series with verified filming locations
- **Authentic Data**: All filming locations scraped directly from IMDb with scene descriptions
- **Interactive 3D Globe**: Smooth, rotating globe visualization powered by MapLibre GL JS
- **Smart Search**: Fast, indexed search across movies, locations, and scenes
- **Advanced Filtering**: Filter by genre, streaming platform, IMDB rating, and IMDB TOP 250
- **Location Pages**: Dedicated pages for each filming location with all movies filmed there
- **Movie Tourism**: Discover where Hollywood meets your favorite cities

## 🛠️ Technologies & Tools

### Frontend Framework
- **Next.js 14** - React framework with App Router and Server Components
- **React 18** - UI library with hooks and modern patterns
- **TypeScript 5** - Type-safe development with strict mode

### Mapping & Visualization
- **MapLibre GL JS 5** - 3D globe rendering with WebGL
- **GeoJSON** - Geographic data format for location markers
- **OpenStreetMap** - Base map data

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **Custom Theme** - Space-themed design with cyan (#01affe) and gold (#fcd34d) accents
- **Radial Gradients** - Deep space background aesthetic
- **Responsive Design** - Mobile-first approach

### Data Management
- **Web Scraping** - Puppeteer for IMDb location extraction
- **Geocoding** - Nominatim API for coordinate conversion
- **Data Caching** - File-based caching system for API responses
- **GeoJSON Transformation** - Automated pipeline for map data generation

### Search & Performance
- **Optimized Search Index** - Chunked JSON files for fast client-side search
- **Progressive Loading** - Lazy loading of components and images
- **Image Optimization** - WebP format for movie posters
- **Code Splitting** - Dynamic imports for better performance

### Development Tools
- **ESLint** - Code linting and quality enforcement
- **Prettier** - Code formatting
- **Git** - Version control
- **Node.js Scripts** - Automated data pipeline

## ✨ Key Features

### 🌍 Interactive 3D Globe
- Smooth rotating globe on page load
- Click and drag to explore
- Zoom in/out for detail
- Auto-rotation stops on user interaction

### 🎬 Movie Discovery
- Browse 2,700+ movies and TV series
- View circular movie poster markers
- Click markers to see movie details
- "Show All Locations" mode displays all filming locations for a single movie
- Amber connecting lines between locations

### 🔍 Advanced Search & Filtering
- Fast indexed search across titles, locations, and scenes
- Filter by genre (Action, Drama, Comedy, etc.)
- Filter by streaming platform (Netflix, Amazon, Disney+, etc.)
- Filter by IMDB rating range (0-10 stars)
- Filter IMDB TOP 250 movies
- Combine multiple filters

### 📍 Location Intelligence
- Verified filming locations from IMDb
- Scene descriptions for context
- Coordinates for precise mapping
- Duplicate location detection (removes locations within 100m)
- Clustering for areas with multiple filming spots

### 🗺️ Location Pages
- Dedicated page for each filming location
- List of all movies filmed in that location
- Statistics (total movies, total locations, genres)
- Search and filter within location
- Responsive grid layout

### 🎯 Focus Mode
- Isolate a single movie's filming locations
- Hide all other markers
- Visual connecting lines between locations
- Center map on selected movie locations
- Red "Reset Map" button to return to full view

### 📱 Responsive Design
- Mobile-first approach
- Touch-optimized controls
- Adaptive layouts for all screen sizes
- Mobile-friendly navigation

## 🏗️ Architecture

### Project Structure
```
filmingmap/
├── app/                      # Next.js App Router pages
│   ├── page.tsx             # Home page (3D globe)
│   ├── layout.tsx           # Root layout
│   ├── blog/                # Blog pages
│   ├── location/            # Location pages
│   │   └── [slug]/          # Dynamic location routes
│   └── movie/               # Movie pages (future)
├── components/              # React components
│   ├── MapClient.tsx        # Main map component
│   ├── Navigation.tsx       # Site navigation
│   ├── BlogClient.tsx       # Blog page component
│   └── LocationPageClient.tsx # Location detail page
├── src/
│   ├── components/          # Core map components
│   │   ├── Map/            # MapLibre GL integration
│   │   ├── MovieModal.tsx  # Movie details modal
│   │   ├── Filters.tsx     # Filter controls
│   │   └── SearchBarOptimized.tsx # Search functionality
│   ├── hooks/              # Custom React hooks
│   │   ├── useMapMarkers.ts      # Marker management
│   │   ├── useMarkerInteractions.ts # Click/hover handling
│   │   └── useMovieNavigation.ts # Movie routing
│   └── types/              # TypeScript type definitions
├── lib/
│   ├── constants/          # Theme colors and configuration
│   ├── metadata.ts         # SEO metadata generation
│   └── types.ts            # Shared TypeScript types
├── data/                   # Movie database
│   └── location_*.json     # Location-specific movie data
├── public/
│   ├── geo/                # GeoJSON data for map
│   │   ├── movies.geojson  # All movie locations
│   │   └── search/         # Search index chunks
│   └── images/             # Movie posters and assets
└── scripts/                # Data pipeline scripts
    ├── fetchMoviesAuto.ts  # IMDb scraper
    ├── transform_to_geojson.ts # GeoJSON generator
    └── optimize_search.ts   # Search index builder
```

### Data Pipeline

The project includes an automated data pipeline for scraping, processing, and optimizing movie location data:

1. **Web Scraping** (Puppeteer + IMDb)
   - Extracts filming locations from IMDb
   - Captures scene descriptions
   - Handles pagination and rate limits

2. **Metadata Enrichment** (TMDb API)
   - Fetches movie posters, ratings, genres
   - Retrieves cast information
   - Gets streaming availability

3. **Geocoding** (Nominatim API)
   - Converts location names to coordinates
   - Handles country/city variations
   - Caches results for performance

4. **Data Transformation**
   - Removes duplicate locations (100m threshold)
   - Generates GeoJSON for map visualization
   - Creates optimized search index
   - Builds location-specific JSON files

5. **SEO Generation**
   - Generates dynamic sitemaps
   - Creates location slugs
   - Builds metadata for all pages

## � Design System

### Color Palette
- **Primary**: #01affe (Cyan) - Main brand color for interactive elements
- **Accent**: #fcd34d (Gold) - Secondary color for highlights and accents
- **Background**: Radial gradient from #1b2735 to #090a0f (Deep space theme)

### Typography
- **Font Stack**: System fonts (-apple-system, Segoe UI, Roboto)
- **No External Fonts**: Optimized for performance

### Components
- **Buttons**: Gradient backgrounds with hover effects
- **Cards**: Glass-morphism effect with backdrop blur
- **Modals**: Centered with overlay and animations
- **Badges**: Rounded pills for tags and filters

## 📊 Performance

### Optimization Strategies
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: WebP format, responsive images
- **Search Index**: Chunked into 13 files for progressive loading
- **Lazy Loading**: Components and images load on demand
- **Caching**: Service Worker for offline capability
- **Minimal Dependencies**: Carefully selected packages

### Metrics
- 2,700+ movies with minimal bundle size
- Fast initial page load
- Smooth 60fps globe rotation
- Instant search results

## 🔐 Data Sources

- **IMDb** - Filming locations and scene descriptions
- **TMDb** - Movie metadata, posters, and ratings
- **OpenStreetMap** - Map tiles and geographic data
- **Nominatim** - Geocoding service

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Special thanks to:
- IMDb for comprehensive filming location data
- The Movie Database (TMDb) for movie metadata and posters
- OpenStreetMap contributors for map data
- MapLibre GL JS for the amazing 3D mapping library

---

**Made with ❤️ for cinema and cartography by filmingmap.com**
