'use client'

/**
 * MapClient - Client wrapper for the map component
 * Handles routing to movie pages
 */

import dynamic from 'next/dynamic'
import { useState, lazy, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Movie, FilterState } from '../lib/types'

// Lazy load components
const SearchBar = lazy(() => import('../src/components/SearchBar'))
const Filters = lazy(() => import('../src/components/Filters'))

// Dynamically import Map (CSR only - no SSR) with forwardRef support
const Map = dynamic(() => import('../src/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-center space-y-6 px-8">
        <div className="text-7xl animate-bounce">🎬</div>
        <h2 className="text-3xl font-bold text-white">CineMap</h2>
        <p className="text-xl text-gray-300">Loading globe...</p>
      </div>
    </div>
  ),
})

export default function MapClient() {
  const router = useRouter()
  const [focusedMovieId, setFocusedMovieId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    decades: [1980, 2030],
    streaming: [],
  })

  // Load slug mapping on client side
  const [slugMap, setSlugMap] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load reverse slug mapping (movie_id -> slug)
    fetch('/data/movies_slugs_reverse.json')
      .then(res => res.json())
      .then(data => setSlugMap(data))
      .catch(err => console.error('Failed to load slug mapping:', err))
  }, [])

  const handleMovieSelect = (movie: Movie | null) => {
    if (movie) {
      // Get slug for this movie
      const slug = slugMap[movie.movie_id]
      if (slug) {
        router.push(`/movie/${slug}`)
      } else {
        console.error('No slug found for movie:', movie.movie_id)
      }
    }
  }

  const handleResetFocus = () => {
    setFocusedMovieId(null)
  }

  return (
    <div className="relative w-full h-full z-10">
      {/* Search Bar - Top Left */}
      <div className="absolute top-4 left-4 z-10 w-96">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <SearchBar
            onSearch={setSearchQuery}
            onMovieSelect={handleMovieSelect}
          />
        </Suspense>
      </div>

      {/* Filters Panel - Top Right */}
      <div className="absolute top-4 right-4 z-10 w-80">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="space-y-3">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        }>
          <Filters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </Suspense>
      </div>

      {/* Main Map */}
      <Map
        selectedMovie={null}
        onMovieSelect={handleMovieSelect}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
        onClearFocus={handleResetFocus}
      />

      {/* Reset Focus Button - Shows when a movie is focused */}
      {focusedMovieId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleResetFocus}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
          >
            <span>↩️</span>
            <span>Show All Movies</span>
          </button>
        </div>
      )}

      {/* Footer - Attribution */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1 rounded">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © OpenStreetMap contributors
        </a>
        {' | '}
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          © CARTO
        </a>
      </div>
    </div>
  )
}
