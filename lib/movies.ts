/**
 * Movie data utilities for Next.js server and client components
 * Optimized for 10k+ movies with caching and efficient lookups
 */

import fs from 'fs'
import path from 'path'
import type { Movie } from './types'

// Singleton cache for movie data (prevents re-reading JSON on every request)
let moviesCache: Movie[] | null = null
let slugMapCache: Record<string, string> | null = null
let reverseSlugMapCache: Record<string, string> | null = null

/**
 * Get the absolute path to data files
 */
function getDataPath(filename: string): string {
  return path.join(process.cwd(), 'data', filename)
}

/**
 * Load all movies from JSON (cached)
 */
export function getAllMovies(): Movie[] {
  if (moviesCache) {
    return moviesCache
  }

  try {
    const filePath = getDataPath('movies_enriched.json')
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    moviesCache = JSON.parse(fileContent)
    return moviesCache!
  } catch (error) {
    console.error('Failed to load movies:', error)
    return []
  }
}

/**
 * Load slug mapping (cached)
 */
function getSlugMap(): Record<string, string> {
  if (slugMapCache) {
    return slugMapCache
  }

  try {
    const filePath = getDataPath('movies_slugs.json')

    if (!fs.existsSync(filePath)) {
      console.error('❌ movies_slugs.json does not exist at:', filePath)
      console.error('   Current working directory:', process.cwd())
      return {}
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    slugMapCache = JSON.parse(fileContent)
    console.log(`✅ Loaded ${Object.keys(slugMapCache!).length} movie slugs`)
    return slugMapCache!
  } catch (error) {
    console.error('❌ Failed to load slug map:', error)
    return {}
  }
}

/**
 * Load reverse slug mapping (cached)
 */
function getReverseSlugMap(): Record<string, string> {
  if (reverseSlugMapCache) {
    return reverseSlugMapCache
  }

  try {
    const filePath = getDataPath('movies_slugs_reverse.json')
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    reverseSlugMapCache = JSON.parse(fileContent)
    return reverseSlugMapCache!
  } catch (error) {
    console.error('Failed to load reverse slug map:', error)
    return {}
  }
}

/**
 * Get movie by slug
 */
export function getMovieBySlug(slug: string): Movie | null {
  const slugMap = getSlugMap()
  const movieId = slugMap[slug]

  if (!movieId) {
    return null
  }

  const movies = getAllMovies()
  return movies.find(m => m.movie_id === movieId) || null
}

/**
 * Get movie by ID
 */
export function getMovieById(movieId: string): Movie | null {
  const movies = getAllMovies()
  return movies.find(m => m.movie_id === movieId) || null
}

/**
 * Get slug for a movie ID
 */
export function getSlugByMovieId(movieId: string): string | null {
  const reverseSlugMap = getReverseSlugMap()
  return reverseSlugMap[movieId] || null
}

/**
 * Get all movie slugs (for static generation)
 */
export function getAllMovieSlugs(): string[] {
  const slugMap = getSlugMap()
  return Object.keys(slugMap)
}

/**
 * Get paginated movies (for large datasets)
 * Useful for building sitemaps in chunks
 */
export function getMoviesPaginated(page: number = 1, perPage: number = 100): {
  movies: Movie[]
  total: number
  pages: number
  currentPage: number
} {
  const allMovies = getAllMovies()
  const total = allMovies.length
  const pages = Math.ceil(total / perPage)
  const start = (page - 1) * perPage
  const end = start + perPage

  return {
    movies: allMovies.slice(start, end),
    total,
    pages,
    currentPage: page
  }
}

/**
 * Search movies by title (case-insensitive)
 */
export function searchMovies(query: string, limit: number = 20): Movie[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  const movies = getAllMovies()
  const searchTerm = query.toLowerCase().trim()

  return movies
    .filter(movie =>
      movie.title.toLowerCase().includes(searchTerm) ||
      (movie.original_title && movie.original_title.toLowerCase().includes(searchTerm))
    )
    .slice(0, limit)
}

/**
 * Get movies by genre
 */
export function getMoviesByGenre(genre: string, limit?: number): Movie[] {
  const movies = getAllMovies()
  const filtered = movies.filter(movie =>
    movie.genres && movie.genres.includes(genre)
  )

  return limit ? filtered.slice(0, limit) : filtered
}

/**
 * Get movies by year range
 */
export function getMoviesByYearRange(startYear: number, endYear: number): Movie[] {
  const movies = getAllMovies()
  return movies.filter(movie =>
    movie.year >= startYear && movie.year <= endYear
  )
}

/**
 * Get all unique genres
 */
export function getAllGenres(): string[] {
  const movies = getAllMovies()
  const genresSet = new Set<string>()

  movies.forEach(movie => {
    if (movie.genres) {
      movie.genres.forEach(genre => genresSet.add(genre))
    }
  })

  return Array.from(genresSet).sort()
}

/**
 * Get related movies (same genre or similar year)
 */
export function getRelatedMovies(movie: Movie, limit: number = 6): Movie[] {
  const movies = getAllMovies()

  // Score-based relevance
  const scored = movies
    .filter(m => m.movie_id !== movie.movie_id) // Exclude current movie
    .map(m => {
      let score = 0

      // Same genre +10 points per match
      if (movie.genres && m.genres) {
        const commonGenres = movie.genres.filter(g => m.genres?.includes(g))
        score += commonGenres.length * 10
      }

      // Similar year +5 points (within 5 years)
      const yearDiff = Math.abs(m.year - movie.year)
      if (yearDiff <= 5) {
        score += (5 - yearDiff)
      }

      // Higher rating +2 points
      if (m.imdb_rating && m.imdb_rating > 7) {
        score += 2
      }

      return { movie: m, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map(item => item.movie)
}

/**
 * Get movie statistics
 */
export function getMovieStats(): {
  total: number
  totalLocations: number
  genres: number
  yearRange: [number, number]
  averageRating: number
} {
  const movies = getAllMovies()
  const years = movies.map(m => m.year).filter(y => y > 0)
  const ratings = movies
    .map(m => m.imdb_rating)
    .filter((r): r is number => r !== undefined && r > 0)

  return {
    total: movies.length,
    totalLocations: movies.reduce((sum, m) => sum + m.locations.length, 0),
    genres: getAllGenres().length,
    yearRange: [Math.min(...years), Math.max(...years)],
    averageRating: ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0
  }
}

/**
 * Clear cache (useful for development/testing)
 */
export function clearCache(): void {
  moviesCache = null
  slugMapCache = null
  reverseSlugMapCache = null
}
