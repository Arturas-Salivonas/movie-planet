# Next.js Migration Plan - CineMap SSR & SEO Strategy

## 📋 Overview

Migration from Vite/React SPA to Next.js 14+ with App Router for:
- **Server-Side Rendering (SSR)** for better SEO and initial load
- **Dynamic movie pages** with clean URLs (`/movie/the-bandit`)
- **Automated sitemap generation** during build
- **JSON-LD Schema.org markup** for rich search results
- **OG tags** for social media sharing
- **Clean URLs** without hash-based map coordinates

---

## 🎯 Goals

1. ✅ Each movie gets a dedicated SSR page: `/movie/[slug]`
2. ✅ Homepage remains interactive with globe (CSR for map, SSR for metadata)
3. ✅ Automatic sitemap generation on build
4. ✅ Schema.org markup for movies (Movie, Place, GeoCoordinates)
5. ✅ OG tags with movie posters for social sharing
6. ✅ Remove hash routing (`#2.88/43/6.65`) from URLs
7. ✅ Full automation: `npm run build` generates everything

---

## 🗂️ Project Structure (Next.js)

```
cinemap/
├── app/
│   ├── layout.tsx                    # Root layout (global metadata)
│   ├── page.tsx                      # Homepage (globe + search)
│   ├── movie/
│   │   └── [slug]/
│   │       ├── page.tsx              # Dynamic movie page (SSR)
│   │       ├── opengraph-image.tsx   # Dynamic OG image generation
│   │       └── loading.tsx           # Loading skeleton
│   ├── api/
│   │   ├── movies/route.ts           # API route for client-side data
│   │   └── search/route.ts           # Search API endpoint
│   ├── sitemap.ts                    # Dynamic sitemap generation
│   ├── robots.txt                    # SEO crawler rules
│   └── not-found.tsx                 # 404 page
├── components/
│   ├── Map.tsx                       # Client component (globe)
│   ├── MovieModal.tsx                # Converted to MoviePage component
│   ├── MovieCard.tsx                 # Movie preview cards
│   ├── SearchBar.tsx                 # Search functionality
│   ├── Filters.tsx                   # Filter panel
│   └── Schema/
│       ├── MovieSchema.tsx           # JSON-LD for movies
│       └── WebsiteSchema.tsx         # JSON-LD for homepage
├── lib/
│   ├── movies.ts                     # Movie data utilities
│   ├── slugify.ts                    # URL slug generation
│   ├── metadata.ts                   # Metadata generators
│   └── geojson.ts                    # GeoJSON utilities
├── data/
│   ├── movies_enriched.json          # Source data
│   └── movies_slugs.json             # Pre-generated slug mapping (build-time)
├── public/
│   ├── images/
│   │   └── posters/                  # Movie posters
│   ├── geo/
│   │   └── movies.geojson            # GeoJSON data
│   ├── og-images/                    # Generated OG images (optional)
│   └── robots.txt
├── scripts/
│   ├── generate-slugs.ts             # Generate slug mappings
│   ├── generate-sitemap.ts           # Sitemap generation (backup)
│   └── build-seo-data.ts             # Pre-build SEO optimization
├── next.config.js                    # Next.js configuration
├── package.json                      # Updated scripts
└── tsconfig.json                     # TypeScript config

```

---

## 🔧 Technical Implementation

### 1. URL Structure & Routing

#### Current (Vite SPA)
```
https://cinemap.com/                    # Homepage
https://cinemap.com/#2.88/43/6.65       # Map position (hash routing)
```

#### New (Next.js SSR)
```
https://cinemap.com/                              # Homepage (SSR metadata + CSR map)
https://cinemap.com/movie/the-shawshank-redemption # Movie page (SSR)
https://cinemap.com/movie/the-godfather           # Movie page (SSR)
https://cinemap.com/movie/pulp-fiction            # Movie page (SSR)
```

#### Hash Routing Removal
- Remove `hash: true` from MapLibre config
- Use Next.js router for navigation
- Store map state in URL query params (optional): `?lat=43&lng=6.65&zoom=2.88`
- Or use local storage for map position (better UX)

---

### 2. Slug Generation Strategy

#### Slug Format
```typescript
// Example transformations:
"The Shawshank Redemption" → "the-shawshank-redemption"
"The Godfather: Part II"   → "the-godfather-part-ii"
"12 Angry Men"             → "12-angry-men"
"Amélie"                   → "amelie"
"The Dark Knight (2008)"   → "the-dark-knight-2008"
```

#### Implementation: `lib/slugify.ts`
```typescript
export function generateSlug(title: string, year?: number): string {
  let slug = title
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, '') // Trim hyphens

  // Add year suffix if duplicate title exists
  if (year) {
    slug = `${slug}-${year}`
  }

  return slug
}

// Reverse lookup: slug → movie_id
export function getMovieBySlug(slug: string): Movie | null {
  const slugMap = loadSlugMapping() // Load from pre-generated JSON
  const movieId = slugMap[slug]
  return movieId ? getMovieById(movieId) : null
}
```

#### Pre-Build Script: `scripts/generate-slugs.ts`
```typescript
// Run during build to generate slug mappings
import fs from 'fs'
import { generateSlug } from '../lib/slugify'

interface SlugMapping {
  [slug: string]: string // slug → movie_id
}

async function generateSlugs() {
  const movies = JSON.parse(
    fs.readFileSync('./data/movies_enriched.json', 'utf-8')
  )

  const slugMap: SlugMapping = {}
  const duplicates = new Set<string>()

  // First pass: detect duplicate slugs
  const slugCount: Record<string, number> = {}
  movies.forEach((movie: any) => {
    const baseSlug = generateSlug(movie.title)
    slugCount[baseSlug] = (slugCount[baseSlug] || 0) + 1
  })

  // Second pass: assign slugs with year suffix if needed
  movies.forEach((movie: any) => {
    const baseSlug = generateSlug(movie.title)
    const slug = slugCount[baseSlug] > 1
      ? generateSlug(movie.title, movie.year)
      : baseSlug

    slugMap[slug] = movie.movie_id
  })

  // Write slug mapping to JSON
  fs.writeFileSync(
    './data/movies_slugs.json',
    JSON.stringify(slugMap, null, 2)
  )

  console.log(`✅ Generated ${Object.keys(slugMap).length} movie slugs`)
}

generateSlugs()
```

---

### 3. Dynamic Movie Pages (`app/movie/[slug]/page.tsx`)

```typescript
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMovieBySlug, getAllMovieSlugs } from '@/lib/movies'
import MoviePage from '@/components/MoviePage'
import MovieSchema from '@/components/Schema/MovieSchema'

interface Props {
  params: { slug: string }
}

// Generate static params for all movies (SSG)
export async function generateStaticParams() {
  const slugs = getAllMovieSlugs()
  return slugs.map((slug) => ({ slug }))
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = getMovieBySlug(params.slug)

  if (!movie) return {}

  const title = `${movie.title} (${movie.year}) - Filming Locations | CineMap`
  const description = `Explore the ${movie.locations.length} filming locations of ${movie.title}. ${movie.genres.join(', ')}. IMDb: ${movie.imdb_rating}/10`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'video.movie',
      images: [
        {
          url: movie.poster || '/default-poster.jpg',
          width: 500,
          height: 750,
          alt: `${movie.title} poster`,
        },
      ],
      siteName: 'CineMap',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [movie.poster || '/default-poster.jpg'],
    },
    alternates: {
      canonical: `https://cinemap.com/movie/${params.slug}`,
    },
  }
}

// Server-side rendered movie page
export default function MoviePageRoute({ params }: Props) {
  const movie = getMovieBySlug(params.slug)

  if (!movie) {
    notFound()
  }

  return (
    <>
      {/* JSON-LD Schema */}
      <MovieSchema movie={movie} />

      {/* Movie content */}
      <MoviePage movie={movie} />
    </>
  )
}
```

---

### 4. Schema.org JSON-LD Implementation

#### Movie Schema (`components/Schema/MovieSchema.tsx`)
```typescript
import { Movie } from '@/types'

interface Props {
  movie: Movie
}

export default function MovieSchema({ movie }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    dateCreated: movie.year.toString(),
    genre: movie.genres,
    aggregateRating: movie.imdb_rating ? {
      '@type': 'AggregateRating',
      ratingValue: movie.imdb_rating,
      bestRating: '10',
      ratingCount: '1000000', // Approximate
    } : undefined,
    image: movie.poster,
    trailer: movie.trailer ? {
      '@type': 'VideoObject',
      embedUrl: `https://www.youtube.com/embed/${movie.trailer}`,
    } : undefined,
    contentLocation: movie.locations.map((loc) => ({
      '@type': 'Place',
      name: `${loc.city}, ${loc.country}`,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: loc.lat,
        longitude: loc.lng,
      },
      description: loc.description,
    })),
    sameAs: [
      `https://www.imdb.com/title/${movie.imdb_id}`,
      `https://www.themoviedb.org/movie/${movie.tmdb_id}`,
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

#### Website Schema (`components/Schema/WebsiteSchema.tsx`)
```typescript
export default function WebsiteSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CineMap',
    description: 'Explore filming locations of your favorite movies on an interactive 3D globe',
    url: 'https://cinemap.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://cinemap.com/movie/{search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

---

### 5. Sitemap Generation (`app/sitemap.ts`)

```typescript
import { MetadataRoute } from 'next'
import { getAllMovieSlugs } from '@/lib/movies'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cinemap.com'

  // Homepage
  const homepage = {
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1,
  }

  // All movie pages
  const movieSlugs = getAllMovieSlugs()
  const moviePages = movieSlugs.map((slug) => ({
    url: `${baseUrl}/movie/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [homepage, ...moviePages]
}

// Generate robots.txt
export function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: 'https://cinemap.com/sitemap.xml',
  }
}
```

---

### 6. Homepage Integration

#### `app/page.tsx` - SSR Metadata + CSR Map
```typescript
import { Metadata } from 'next'
import MapClient from '@/components/MapClient'
import WebsiteSchema from '@/components/Schema/WebsiteSchema'

export const metadata: Metadata = {
  title: 'CineMap - Discover Movie Filming Locations on an Interactive 3D Globe',
  description: 'Explore 677+ movies and their authentic filming locations on a rotating 3D world map. Search by genre, year, and rating.',
  openGraph: {
    title: 'CineMap - Movie Filming Locations',
    description: 'Interactive 3D globe showing where your favorite movies were filmed',
    type: 'website',
    url: 'https://cinemap.com',
    images: ['/og-image.jpg'],
  },
}

export default function HomePage() {
  return (
    <>
      <WebsiteSchema />

      {/* Client component with map (hydration) */}
      <MapClient />
    </>
  )
}
```

#### `components/MapClient.tsx` - Client-Only Map Component
```typescript
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Dynamically import Map to prevent SSR issues
const Map = dynamic(() => import('./Map'), { ssr: false })

export default function MapClient() {
  const router = useRouter()
  const [selectedMovie, setSelectedMovie] = useState(null)

  const handleMovieSelect = (movie) => {
    // Navigate to movie page instead of showing modal
    router.push(`/movie/${movie.slug}`)
  }

  return <Map onMovieSelect={handleMovieSelect} />
}
```

---

### 7. Map State Management (Remove Hash Routing)

#### Option A: Query Parameters (SEO-friendly but changes URL)
```typescript
// Store map state in URL query
const router = useRouter()
const searchParams = useSearchParams()

// Update URL when map moves
map.on('moveend', () => {
  const center = map.getCenter()
  const zoom = map.getZoom()

  router.push(`/?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}`, {
    scroll: false, // Don't scroll to top
  })
})

// Restore map state from URL on load
useEffect(() => {
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const zoom = searchParams.get('zoom')

  if (lat && lng && zoom) {
    map.setCenter([parseFloat(lng), parseFloat(lat)])
    map.setZoom(parseFloat(zoom))
  }
}, [])
```

#### Option B: Local Storage (Cleaner URLs, recommended)
```typescript
// Save map state to localStorage
map.on('moveend', () => {
  const center = map.getCenter()
  const zoom = map.getZoom()

  localStorage.setItem('mapState', JSON.stringify({
    lat: center.lat,
    lng: center.lng,
    zoom: zoom
  }))
})

// Restore from localStorage on mount
useEffect(() => {
  const savedState = localStorage.getItem('mapState')
  if (savedState) {
    const { lat, lng, zoom } = JSON.parse(savedState)
    map.setCenter([lng, lat])
    map.setZoom(zoom)
  }
}, [])
```

**Recommendation: Use Option B (localStorage)** for cleaner URLs.

---

### 8. Build Automation

#### Updated `package.json` Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "npm run prebuild && next build",
    "prebuild": "npm run build:slugs && npm run build:seo",
    "build:slugs": "tsx scripts/generate-slugs.ts",
    "build:seo": "tsx scripts/build-seo-data.ts",
    "postbuild": "npm run validate:sitemap",
    "validate:sitemap": "curl -s http://localhost:3000/sitemap.xml > /dev/null && echo '✅ Sitemap generated'",
    "start": "next start",
    "lint": "next lint",
    "analyze": "ANALYZE=true next build"
  }
}
```

#### Build Flow
```
1. npm run build
   ↓
2. prebuild: generate-slugs.ts
   - Creates data/movies_slugs.json
   - Maps slug → movie_id
   ↓
3. prebuild: build-seo-data.ts (optional)
   - Pre-generates OG images
   - Validates metadata
   ↓
4. next build
   - Generates static pages for all movies (SSG)
   - Creates sitemap.xml
   - Optimizes assets
   ↓
5. postbuild: validate:sitemap
   - Checks sitemap generation
   ↓
6. ✅ Ready for deployment
```

---

## 🚀 Migration Steps

### Phase 1: Setup (Week 1)
- [ ] Install Next.js 14+ (`npx create-next-app@latest --typescript`)
- [ ] Configure `next.config.js` for images, public assets
- [ ] Migrate Tailwind CSS config
- [ ] Set up folder structure (`app/`, `components/`, `lib/`)

### Phase 2: Data Layer (Week 1)
- [ ] Create `lib/movies.ts` with data utilities
- [ ] Implement slug generation (`lib/slugify.ts`)
- [ ] Build `scripts/generate-slugs.ts`
- [ ] Generate `movies_slugs.json` mapping

### Phase 3: Pages & Routing (Week 2)
- [ ] Convert homepage to `app/page.tsx` (SSR metadata + CSR map)
- [ ] Create dynamic movie pages (`app/movie/[slug]/page.tsx`)
- [ ] Implement `generateStaticParams()` for SSG
- [ ] Remove hash routing from map, use localStorage

### Phase 4: SEO & Metadata (Week 2)
- [ ] Implement `generateMetadata()` for all pages
- [ ] Create Schema.org components (Movie, Website, Place)
- [ ] Add OG tags and Twitter cards
- [ ] Generate `app/sitemap.ts`
- [ ] Create `app/robots.ts`

### Phase 5: Components (Week 3)
- [ ] Convert Map to client component with `'use client'`
- [ ] Migrate MovieModal → MoviePage (server component)
- [ ] Update SearchBar with Next.js router
- [ ] Adapt Filters for SSR/CSR hybrid

### Phase 6: API Routes (Week 3)
- [ ] Create `/api/movies/route.ts` for client-side fetching
- [ ] Create `/api/search/route.ts` for search
- [ ] Optimize data loading (cache, revalidation)

### Phase 7: Build & Testing (Week 4)
- [ ] Test `npm run build` automation
- [ ] Validate sitemap generation
- [ ] Test OG image rendering
- [ ] Lighthouse SEO audit (target: 95+)
- [ ] Test dynamic routes (`/movie/[slug]`)

### Phase 8: Deployment (Week 4)
- [ ] Deploy to Vercel/Netlify
- [ ] Configure custom domain
- [ ] Submit sitemap to Google Search Console
- [ ] Monitor Core Web Vitals

---

## 📊 Expected SEO Improvements

### Before (Vite SPA)
- ❌ No SSR (crawlers see empty `<div id="root">`)
- ❌ No unique URLs per movie
- ❌ No structured data (Schema.org)
- ❌ No sitemap
- ❌ Poor social sharing (no OG tags)
- ❌ Lighthouse SEO: ~40-60

### After (Next.js SSR)
- ✅ Full SSR (crawlers see complete HTML)
- ✅ Unique URLs with slugs (`/movie/the-godfather`)
- ✅ Rich snippets with Schema.org markup
- ✅ Auto-generated sitemap (677+ pages)
- ✅ Dynamic OG images for social sharing
- ✅ Lighthouse SEO: 95-100

---

## 🎯 Key Features Summary

| Feature | Implementation | Automation |
|---------|---------------|------------|
| **Movie Slugs** | `lib/slugify.ts` | `npm run build:slugs` |
| **Dynamic Pages** | `app/movie/[slug]/page.tsx` | SSG via `generateStaticParams()` |
| **Sitemap** | `app/sitemap.ts` | Auto-generated on build |
| **Schema.org** | JSON-LD components | Rendered per page |
| **OG Images** | `opengraph-image.tsx` | Dynamic generation |
| **Clean URLs** | Remove hash routing | localStorage for map state |
| **Build Pipeline** | `package.json` scripts | `npm run build` does everything |

---

## 🛠️ Configuration Files

### `next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['image.tmdb.org'], // If using external images
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    optimizeCss: true, // Optimize CSS
  },
  // Static export for hosting on CDN (optional)
  // output: 'export',
}

module.exports = nextConfig
```

### `.env.local`
```env
NEXT_PUBLIC_SITE_URL=https://cinemap.com
NEXT_PUBLIC_MAPBOX_TOKEN=your_token
TMDB_API_KEY=your_api_key
```

---

## 📈 Performance Targets

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Lighthouse SEO Score**: 95+
- **Core Web Vitals**: All green
- **Sitemap**: 100% coverage (677+ movies)

---

## 🔄 Rollback Plan

Keep the Vite version in a separate branch (`legacy-vite`) for easy rollback if needed:
```bash
git checkout -b legacy-vite
git checkout main
# Start Next.js migration on main branch
```

---

## 📚 Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Schema.org Movie Reference](https://schema.org/Movie)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Next.js Sitemap Guide](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)

---

## ✅ Success Criteria

1. ✅ `npm run build` generates slugs + sitemap automatically
2. ✅ All 677+ movies have unique URLs (e.g., `/movie/the-godfather`)
3. ✅ Google can crawl and index all movie pages
4. ✅ Rich snippets appear in search results
5. ✅ Social sharing shows movie posters + metadata
6. ✅ No hash routing in URLs
7. ✅ Lighthouse SEO score > 95

---

## 🎬 Next Steps

**Ready to start?** Here's the first command:

```bash
# Create Next.js app in a new folder (test first)
npx create-next-app@latest cinemap-nextjs --typescript --tailwind --app --src-dir --import-alias "@/*"

# Or migrate in place:
npm install next@latest react@latest react-dom@latest
```

Let me know when you're ready to begin, and I'll help with the implementation! 🚀
