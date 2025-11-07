# 🚀 CineMap Next.js - Quick Reference

## Common Commands

```bash
# Development
npm run dev              # Start Next.js dev server (localhost:3000)
npm run dev:vite         # Start old Vite dev server (fallback)

# Building
npm run build            # Full production build (auto-generates slugs + sitemap)
npm run build:slugs      # Generate movie slugs only
npm start                # Start production server

# Data Management
npm run fetch            # Fetch new movies from TMDb
npm run download:posters # Download movie posters
```

---

## Project Structure

```
/app                    # Next.js pages (SSR)
  /movie/[slug]        # Dynamic movie routes
  layout.tsx           # Root layout
  page.tsx             # Homepage
  sitemap.ts           # Auto-generated sitemap
  robots.ts            # SEO crawler rules

/components            # React components
  MapClient.tsx        # Homepage map wrapper
  MoviePage.tsx        # Movie detail page
  MapPreview.tsx       # Embedded map preview

/lib                   # Server utilities
  movies.ts            # Data fetching & caching
  slugify.ts           # URL slug generation
  metadata.ts          # SEO metadata
  types.ts             # Shared TypeScript types

/src                   # Legacy Vite code (still used)
  /components          # Map, SearchBar, Filters
  /utils               # Helper functions

/data                  # Movie data
  movies_enriched.json # 622 movies
  movies_slugs.json    # slug → movie_id mapping
```

---

## URL Structure

### Clean URLs (No Hash Routing)
```
/                           # Homepage with globe
/movie/the-godfather        # Movie page (SSR)
/movie/pulp-fiction         # Movie page (SSR)
/sitemap.xml               # Auto-generated sitemap
/robots.txt                # SEO rules
```

### Map State
- Stored in **localStorage** (key: `cinemap_view`)
- No URL pollution
- Persists across sessions

---

## Key Features

### SEO
- ✅ Server-Side Rendering (SSR)
- ✅ Static Site Generation (SSG)
- ✅ Schema.org JSON-LD
- ✅ Open Graph tags
- ✅ Twitter Cards
- ✅ Automatic sitemaps
- ✅ Clean semantic URLs

### Performance
- ✅ Data caching
- ✅ Code splitting
- ✅ Lazy loading
- ✅ Image optimization
- ✅ Optimized for 10k+ movies

---

## Adding New Movies

```bash
# 1. Update source data
npm run fetch

# 2. Download posters
npm run download:posters

# 3. Rebuild with new slugs
npm run build
```

Slugs are auto-generated during build!

---

## Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TMDB_API_KEY=your_api_key_here
```

Production `.env.production`:
```env
NEXT_PUBLIC_SITE_URL=https://cinemap.com
```

---

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Manual Build
```bash
npm run build
npm start
```

---

## Troubleshooting

### Slugs not generating?
```bash
npm run build:slugs
```

### Map not loading?
- Check MapLibre API key in `src/components/Map.tsx`
- Ensure `'use client'` directive present

### TypeScript errors?
```bash
rm -rf .next
npm run dev
```

### Clear cache?
```bash
rm -rf .next
rm -rf node_modules/.cache
```

---

## File Sizes

- Homepage: ~500KB (with map)
- Movie page: ~200KB
- Total build: ~2MB (gzipped)

---

## Performance Targets

- Lighthouse SEO: 95+
- First Contentful Paint: <1.5s
- Time to Interactive: <3.5s
- Core Web Vitals: All green

---

## Scaling Notes

### For 10k+ Movies

Enable ISR in `app/movie/[slug]/page.tsx`:
```typescript
export const revalidate = 86400 // 24 hours
```

Use pagination:
```typescript
import { getMoviesPaginated } from '@/lib/movies'

const { movies, total, pages } = getMoviesPaginated(page, 100)
```

---

## Quick Links

- Dev: http://localhost:3000
- Sitemap: http://localhost:3000/sitemap.xml
- Robots: http://localhost:3000/robots.txt
- Docs: [NEXTJS_IMPLEMENTATION_COMPLETE.md](./NEXTJS_IMPLEMENTATION_COMPLETE.md)

---

**Happy developing!** 🎬🚀
