/**
 * General utility functions
 */

import type { Movie } from '../types'

/**
 * Format year range for display
 */
export const formatYearRange = (start: number, end: number): string => {
  if (start === end) return `${start}`
  return `${start}-${end}`
}

/**
 * Get unique list of genres from movies
 */
export const getUniqueGenres = (movies: readonly Movie[]): string[] => {
  const genresSet = new Set<string>()
  movies.forEach(movie => {
    movie.genres.forEach(genre => genresSet.add(genre))
  })
  return Array.from(genresSet).sort()
}

/**
 * Get unique list of streaming platforms
 */
export const getUniqueStreamingPlatforms = (movies: readonly Movie[]): string[] => {
  const platformsSet = new Set<string>()
  movies.forEach(movie => {
    movie.streaming?.forEach(platform => platformsSet.add(platform))
  })
  return Array.from(platformsSet).sort()
}

/**
 * Get unique list of countries
 */
export const getUniqueCountries = (movies: readonly Movie[]): string[] => {
  const countriesSet = new Set<string>()
  movies.forEach(movie => {
    movie.locations.forEach(loc => countriesSet.add(loc.country))
  })
  return Array.from(countriesSet).sort()
}

/**
 * Filter movies by criteria
 */
export const filterMovies = (
  movies: readonly Movie[],
  filters: {
    genres: string[]
    decades: [number, number]
    streaming: string[]
  }
): Movie[] => {
  return movies.filter(movie => {
    // Genre filter
    if (filters.genres.length > 0) {
      const hasMatchingGenre = movie.genres.some(genre =>
        filters.genres.includes(genre)
      )
      if (!hasMatchingGenre) return false
    }

    // Decade filter
    if (movie.year < filters.decades[0] || movie.year > filters.decades[1]) {
      return false
    }

    // Streaming filter
    if (filters.streaming.length > 0 && movie.streaming) {
      const hasMatchingPlatform = movie.streaming.some(platform =>
        filters.streaming.includes(platform)
      )
      if (!hasMatchingPlatform) return false
    }

    return true
  })
}

/**
 * Debounce function for search input
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Format IMDb rating for display
 */
export const formatRating = (rating?: number): string => {
  if (!rating) return 'N/A'
  return rating.toFixed(1)
}

/**
 * Extract YouTube video ID from URL
 */
export const getYouTubeVideoId = (url?: string): string | null => {
  if (!url) return null
  const match = url.match(/[?&]v=([^&]+)/)
  return match ? match[1] : null
}

/**
 * Generate YouTube embed URL
 */
export const getYouTubeEmbedUrl = (url?: string): string | null => {
  const videoId = getYouTubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null
}

/**
 * Clamp a number between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}
