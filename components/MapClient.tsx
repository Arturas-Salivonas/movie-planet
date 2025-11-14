'use client'

/**
 * MapClient - Client wrapper for the map component
 * Refactored for better modularity and maintainability
 */

import { useState, lazy, Suspense, useEffect, useRef, forwardRef } from 'react'
import type { Movie, FilterState } from '../lib/types'
import type { MapRef } from '../src/components/Map'
import { useMovieNavigation } from '../src/hooks/useMovieNavigation'
import { useRelatedMovies } from '../src/hooks/useRelatedMovies'
import { useFilterPersistence } from '../src/hooks/useFilterPersistence'
import { STYLES } from '../lib/constants/theme'

// Lazy load components
const SearchBar = lazy(() => import('../src/components/SearchBarOptimized'))
const Filters = lazy(() => import('../src/components/Filters'))
const MovieModal = lazy(() => import('../src/components/MovieModal'))
const PartnershipModal = lazy(() => import('./PartnershipModal'))
const Navigation = lazy(() => import('./Navigation'))

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
  convertGeoJSONToMovie?: (feature: any) => Promise<Movie>
}

// Dynamically import MapWrapper with proper ref forwarding
const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('../src/components/MapWrapper').then(mod => setMapComponent(() => mod.default))
  }, [])

  if (!MapComponent) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center" style={STYLES.spaceBackground}>
        <div className="text-center space-y-6 px-8">
          <div className="text-7xl animate-bounce">🎬</div>
          <h2 className="text-3xl font-bold text-white">FilmingMap</h2>
          <p className="text-xl text-gray-300">Loading globe...</p>
        </div>
      </div>
    )
  }

  return <MapComponent {...props} ref={ref} />
})

Map.displayName = 'Map'

interface MapClientProps {
  initialMovieSlug?: string
  initialMovie?: Movie
  initialRelatedMovies?: Movie[]
}

export default function MapClient({
  initialMovieSlug: _initialMovieSlug,
  initialMovie,
  initialRelatedMovies = []
}: MapClientProps) {
  const mapRef = useRef<MapRef>(null)
  const [focusedMovieId, setFocusedMovieId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLocationViewed, setIsLocationViewed] = useState<boolean>(false)
  const [isPartnershipModalOpen, setIsPartnershipModalOpen] = useState<boolean>(false)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false)

  // Use filter persistence hook (localStorage)
  const { filters, setFilters } = useFilterPersistence()

  // Movie navigation hook
  const { selectedMovie, handleMovieSelect, closeModal, convertGeoJSONToMovie } = useMovieNavigation({
    initialMovie
  })

  // Related movies hook
  const { relatedMovies, fetchRelatedMovies, clearRelatedMovies } = useRelatedMovies()

  // Initialize related movies if provided
  useEffect(() => {
    if (initialRelatedMovies.length > 0 && relatedMovies.length === 0) {
      // Don't overwrite if already loaded
      clearRelatedMovies()
    }
  }, [initialRelatedMovies, relatedMovies.length, clearRelatedMovies])

  // Fetch related movies when a movie is selected
  useEffect(() => {
    if (selectedMovie) {
      fetchRelatedMovies(selectedMovie)
    } else {
      clearRelatedMovies()
    }
  }, [selectedMovie, fetchRelatedMovies, clearRelatedMovies])

  // Listen for partnership modal open event from Map component
  useEffect(() => {
    const handleOpenPartnership = () => {
      setIsPartnershipModalOpen(true)
    }
    window.addEventListener('openPartnershipModal', handleOpenPartnership)
    return () => window.removeEventListener('openPartnershipModal', handleOpenPartnership)
  }, [])

  const handleResetView = () => {
    // Reset focused movie (show all markers again)
    setFocusedMovieId(null)

    // Reset map view to default
    if (mapRef.current) {
      mapRef.current.resetView()
      setIsLocationViewed(false)

      // Show clickable regions again when clearing focus
      const mapInstance = mapRef.current.getMapInstance()
      if (mapInstance && mapInstance.getLayer('region-circles')) {
        mapInstance.setLayoutProperty('region-circles', 'visibility', 'visible')
      }
    }
  }

  const handleShowAllLocations = () => {
    if (selectedMovie && mapRef.current) {
      mapRef.current.showAllLocationsForMovie(selectedMovie)
      setFocusedMovieId(selectedMovie.movie_id)
      closeModal()
      setIsLocationViewed(true)
    }
  }

  const handleViewLocation = (location: any) => {
    if (mapRef.current && selectedMovie) {
      // Hide other markers by setting focused movie (same logic as "Show All on Map")
      setFocusedMovieId(selectedMovie.movie_id)

      // Fly to the specific location
      mapRef.current.flyToLocation(location.lat, location.lng)
      setIsLocationViewed(true)

      // Hide clickable regions when viewing a specific location
      const mapInstance = mapRef.current.getMapInstance()
      if (mapInstance && mapInstance.getLayer('region-circles')) {
        mapInstance.setLayoutProperty('region-circles', 'visibility', 'none')
      }
    }

    setTimeout(() => {
      closeModal()
    }, 100)
  }

  // Handle removing individual filters
  const removeGenreFilter = (genre: string) => {
    setFilters({ ...filters, genres: filters.genres.filter(g => g !== genre) })
  }

  const removeStreamingFilter = (platform: string) => {
    setFilters({ ...filters, streaming: filters.streaming.filter(p => p !== platform) })
  }

  const removeStarRatingFilter = () => {
    setFilters({ ...filters, starRating: [0, 10] })
  }

  const removeTopIMDBFilter = () => {
    setFilters({ ...filters, topIMDB: false })
  }

  const clearAllFilters = () => {
    setFilters({
      genres: [],
      decades: [1980, 2030],
      streaming: [],
      starRating: [0, 10],
      topIMDB: false,
    })
  }

  // Check if any filters are active
  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.streaming.length > 0 ||
    filters.starRating[0] !== 0 ||
    filters.starRating[1] !== 10 ||
    filters.topIMDB

  return (
    <div className="relative w-full h-full z-10">
      {/* Navigation - Full Width on Mobile, Centered on Desktop */}
      <div
        className="absolute top-4 left-4 right-4 lg:left-1/2 lg:right-auto lg:transform lg:-translate-x-1/2 z-10 lg:w-auto select-none"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        draggable={false}
      >
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <Navigation
            onPartnershipClick={() => setIsPartnershipModalOpen(true)}
            onSearchClick={() => setIsSearchOpen(!isSearchOpen)}
          />
        </Suspense>
      </div>

      {/* Search Bar & Filters Panel - Hidden on Mobile by Default, Always Visible on Desktop */}
      <div
        className={`absolute top-20 lg:top-4 right-4 z-20 w-[calc(100%-2rem)] sm:w-96 lg:w-80 space-y-3 transition-all duration-300 select-none ${
          isSearchOpen ? 'block' : 'hidden lg:block'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        draggable={false}
      >
        {/* Search Bar */}
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <SearchBar
            onSearch={setSearchQuery}
            onMovieSelect={(movie) => {
              handleMovieSelect(movie)
              setIsSearchOpen(false) // Close search on mobile after selection
            }}
            onSearchFocus={() => setIsFiltersOpen(false)}
          />
        </Suspense>

        {/* Filters Panel (Hidden on Mobile) */}
        <div className="hidden lg:block">
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
              isOpen={isFiltersOpen}
              onOpenChange={setIsFiltersOpen}
            />
          </Suspense>
        </div>
      </div>

      {/* Active Filters Display - Shows selected filters as removable chips */}
      {hasActiveFilters && (
        <div
          className="absolute bottom-20 lg:top-36 left-4 right-4 lg:right-4 lg:left-auto z-10 lg:w-80 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          draggable={false}
        >
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-2 lg:p-3 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1.5 lg:mb-2">
              <span className="text-[10px] lg:text-xs font-semibold text-gray-700 dark:text-gray-300">
                Active Filters
              </span>
              <button
                onClick={clearAllFilters}
                className="text-[10px] lg:text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 lg:gap-2">
              {/* Genre filters */}
              {filters.genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => removeGenreFilter(genre)}
                  className="inline-flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 text-[10px] lg:text-xs rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>{genre}</span>
                  <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              ))}

              {/* Streaming filters */}
              {filters.streaming.map((platform) => (
                <button
                  key={platform}
                  onClick={() => removeStreamingFilter(platform)}
                  className="inline-flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 text-[10px] lg:text-xs rounded-full hover:bg-primary-200 dark:hover:bg-primary-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>{platform}</span>
                  <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              ))}

              {/* Star rating filter */}
              {(filters.starRating[0] !== 0 || filters.starRating[1] !== 10) && (
                <button
                  onClick={removeStarRatingFilter}
                  className="inline-flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-accent-100 dark:bg-accent-900/40 text-accent-800 dark:text-accent-300 text-[10px] lg:text-xs rounded-full hover:bg-accent-200 dark:hover:bg-accent-900/60 transition-colors"
                  title="Click to remove"
                >
                  <span>⭐ {filters.starRating[0].toFixed(1)}-{filters.starRating[1].toFixed(1)}</span>
                  <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}

              {/* TOP 250 IMDB filter */}
              {filters.topIMDB && (
                <button
                  onClick={removeTopIMDBFilter}
                  className="inline-flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-accent-100 dark:bg-accent-900/40 text-accent-800 dark:text-accent-300 text-[10px] lg:text-xs rounded-full hover:bg-accent-200 dark:hover:bg-accent-900/60 transition-colors font-semibold border lg:border-2 border-accent-400 dark:border-accent-600 animate-pulse-soft shadow-md lg:shadow-lg shadow-accent-200/50 dark:shadow-accent-500/20"
                  title="Click to remove"
                >
                  <span className="hidden sm:inline">🏆IMDB TOP 250</span>
                  <span className="sm:hidden">🏆TOP 250</span>
                  <svg className="w-2.5 h-2.5 lg:w-3 lg:h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Map */}
      <Map
        ref={mapRef}
        selectedMovie={selectedMovie}
        onMovieSelect={handleMovieSelect}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
        onClearFocus={handleResetView}
        convertGeoJSONToMovie={convertGeoJSONToMovie}
      />

      {/* Movie Modal */}
      {selectedMovie && (
        <Suspense fallback={null}>
          <MovieModal
            movie={selectedMovie}
            relatedMovies={relatedMovies}
            onClose={closeModal}
            onRelatedMovieClick={handleMovieSelect}
            onShowAllLocations={handleShowAllLocations}
            onViewLocation={handleViewLocation}
          />
        </Suspense>
      )}

      {/* Reset View Button - Shows when a movie is focused OR a location is viewed */}
      {(focusedMovieId || isLocationViewed) && (
        <div className="absolute top-24 lg:top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <button
            onClick={handleResetView}
            className="w-full sm:w-auto px-5 sm:px-7 py-3 sm:py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-red-500/50 flex items-center justify-center gap-2 text-sm sm:text-base border-2 border-red-400"
          >
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Reset Map</span>
          </button>
        </div>
      )}

      {/* Footer - Attribution */}
      <div className="absolute bottom-4 left-4 z-10 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-2 sm:px-3 py-1 rounded max-w-[calc(100vw-2rem)] sm:max-w-none">
        <span className="hidden sm:inline">Created with ❤️ by </span>
        <a href="https://github.com/Arturas-Salivonas" target="_blank" rel="noopener noreferrer" className="hover:underline">
          <span className="sm:hidden">AS</span>
          <span className="hidden sm:inline">Arturas Salivonas</span>
        </a>
      </div>

      {/* Partnership Modal */}
      <Suspense fallback={null}>
        <PartnershipModal
          isOpen={isPartnershipModalOpen}
          onClose={() => setIsPartnershipModalOpen(false)}
        />
      </Suspense>
    </div>
  )
}
