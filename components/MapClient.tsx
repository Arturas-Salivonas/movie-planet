'use client'

/**
 * MapClient - Client wrapper for the map component
 * Handles modal-based movie navigation with globe always visible
 */

import { useState, lazy, Suspense, useEffect, useRef, forwardRef } from 'react'
import type { Movie, FilterState } from '../lib/types'
import type { MapRef } from '../src/components/Map'

// Lazy load components
const SearchBar = lazy(() => import('../src/components/SearchBar'))
const Filters = lazy(() => import('../src/components/Filters'))
const MovieModal = lazy(() => import('../src/components/MovieModal'))
const PartnershipModal = lazy(() => import('./PartnershipModal'))

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
}

// Dynamically import MapWrapper with proper ref forwarding
const Map = forwardRef<MapRef, MapProps>((props, ref) => {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('../src/components/MapWrapper').then(mod => setMapComponent(() => mod.default))
  }, [])

  if (!MapComponent) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
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
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(initialMovie || null)
  const [relatedMovies, setRelatedMovies] = useState<Movie[]>(initialRelatedMovies)
  const [focusedMovieId, setFocusedMovieId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLocationViewed, setIsLocationViewed] = useState<boolean>(false)
  const [isPartnershipModalOpen, setIsPartnershipModalOpen] = useState<boolean>(false)
  const [filters, setFilters] = useState<FilterState>({
    genres: [],
    decades: [1980, 2030],
    streaming: [],
  })

  // Load slug mapping on client side
  const [slugMap, setSlugMap] = useState<Record<string, string>>({})
  const [reverseSlugMap, setReverseSlugMap] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load reverse slug mapping (movie_id -> slug)
    fetch('/data/movies_slugs_reverse.json')
      .then(res => res.json())
      .then(data => setSlugMap(data))
      .catch(err => console.error('Failed to load slug mapping:', err))

    // Load forward slug mapping (slug -> movie_id)
    fetch('/data/movies_slugs.json')
      .then(res => res.json())
      .then(data => setReverseSlugMap(data))
      .catch(err => console.error('Failed to load forward slug mapping:', err))
  }, [])

  // Check URL for movie query param on mount and handle browser back/forward
  useEffect(() => {
    const handleUrlChange = async () => {
      const params = new URLSearchParams(window.location.search)
      const movieSlug = params.get('movie')

      if (movieSlug && Object.keys(reverseSlugMap).length > 0) {
        // Get movie_id from slug
        const movieId = reverseSlugMap[movieSlug]
        if (movieId) {
          // Fetch movie data
          try {
            const response = await fetch('/geo/movies.geojson')
            const geojsonData = await response.json()
            const feature = geojsonData.features.find((f: any) => f.properties.movie_id === movieId)

            if (feature) {
              // Convert to Movie object
              const movie = convertGeoJSONToMovie(feature)
              setSelectedMovie(movie)
              fetchRelatedMovies(movie)
            }
          } catch (error) {
            console.error('Failed to load movie:', error)
          }
        }
      } else if (!movieSlug && selectedMovie) {
        // No movie param but modal is open - close it
        setSelectedMovie(null)
        setRelatedMovies([])
      }
    }

    handleUrlChange()

    // Listen for browser back/forward
    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [reverseSlugMap, selectedMovie])

  // Helper function to convert GeoJSON feature to Movie object
  const convertGeoJSONToMovie = (feature: any): Movie => {
    let locations = []
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates
      locations = [{
        lat, lng,
        city: feature.properties.location_names[0]?.split(',')[0] || 'Unknown',
        country: feature.properties.location_names[0]?.split(',')[1]?.trim() || 'Unknown',
      }]
    } else if (feature.geometry.type === 'MultiPoint') {
      locations = feature.geometry.coordinates.map((coord: number[], idx: number) => {
        const [lng, lat] = coord
        const locationName = feature.properties.location_names[idx] || 'Unknown'
        const [city, country] = locationName.split(',').map((s: string) => s.trim())
        return { lat, lng, city: city || 'Unknown', country: country || 'Unknown' }
      })
    }

    return {
      movie_id: feature.properties.movie_id,
      title: feature.properties.title,
      year: feature.properties.year,
      imdb_id: feature.properties.movie_id,
      tmdb_id: String(feature.properties.tmdb_id),
      genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
      poster: feature.properties.poster || undefined,
      imdb_rating: feature.properties.imdb_rating || undefined,
      locations,
    }
  }

  const handleMovieSelect = (movie: Movie | null) => {
    if (movie) {
      // Get slug for this movie
      const slug = slugMap[movie.movie_id]
      if (slug) {
        // Update URL with search param instead of navigating
        const url = new URL(window.location.href)
        url.searchParams.set('movie', slug)
        window.history.pushState({}, '', url.toString())

        // Set selected movie to show modal
        setSelectedMovie(movie)

        // Fetch related movies
        fetchRelatedMovies(movie)
      } else {
        console.error('No slug found for movie:', movie.movie_id)
      }
    } else {
      // Close modal and remove query param
      setSelectedMovie(null)
      setRelatedMovies([])
      const url = new URL(window.location.href)
      url.searchParams.delete('movie')
      window.history.pushState({}, '', url.toString())
    }
  }

  const fetchRelatedMovies = async (movie: Movie) => {
    try {
      // Fetch all movies to find related ones
      const response = await fetch('/geo/movies.geojson')
      const geojsonData = await response.json()

      // Convert to Movie objects and find related movies
      const allMovies: Movie[] = geojsonData.features.map((feature: any) => {
        let locations = []
        if (feature.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates
          locations = [{
            lat, lng,
            city: feature.properties.location_names[0]?.split(',')[0] || 'Unknown',
            country: feature.properties.location_names[0]?.split(',')[1]?.trim() || 'Unknown',
          }]
        } else if (feature.geometry.type === 'MultiPoint') {
          locations = feature.geometry.coordinates.map((coord: number[], idx: number) => {
            const [lng, lat] = coord
            const locationName = feature.properties.location_names[idx] || 'Unknown'
            const [city, country] = locationName.split(',').map((s: string) => s.trim())
            return { lat, lng, city: city || 'Unknown', country: country || 'Unknown' }
          })
        }

        return {
          movie_id: feature.properties.movie_id,
          title: feature.properties.title,
          year: feature.properties.year,
          imdb_id: feature.properties.movie_id,
          tmdb_id: String(feature.properties.tmdb_id),
          genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
          poster: feature.properties.poster || undefined,
          imdb_rating: feature.properties.imdb_rating || undefined,
          locations,
        }
      })

      // Find movies with matching genres (exclude current movie)
      const related = allMovies
        .filter(m => m.movie_id !== movie.movie_id)
        .filter(m => {
          const movieGenres = movie.genres || []
          const otherGenres = m.genres || []
          return movieGenres.some(g => otherGenres.includes(g))
        })
        .sort((a, b) => (b.imdb_rating || 0) - (a.imdb_rating || 0))
        .slice(0, 6)

      setRelatedMovies(related)
    } catch (error) {
      console.error('Failed to fetch related movies:', error)
    }
  }

  const handleResetFocus = () => {
    setFocusedMovieId(null)
  }

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.resetView()
      setIsLocationViewed(false)
      setFocusedMovieId(null)
    }
  }

  return (
    <div className="relative w-full h-full z-10">
      {/* Logo/Brand - Top Left */}
      <div className="absolute top-4 left-4 z-10 text-white px-2 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col gap-2">
          <div>
            <img src="images/logo/filmingmap-logo.webp" alt="filmingmap Logo" className="h-8 sm:h-auto" />
          </div>
          <button
            onClick={() => setIsPartnershipModalOpen(true)}
            className="text-xs sm:text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1 group"
          >
            <span>🤝</span>
            <span className="group-hover:underline">Partnership</span>
          </button>
        </div>
      </div>

      {/* Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-11/12 sm:w-96 max-w-md">
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

      {/* Filters Panel - Top Right (Hidden on Mobile) */}
      <div className="hidden lg:block absolute top-4 right-4 z-10 w-80">
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
        ref={mapRef}
        selectedMovie={selectedMovie}
        onMovieSelect={handleMovieSelect}
        searchQuery={searchQuery}
        filters={filters}
        focusedMovieId={focusedMovieId}
        onClearFocus={handleResetFocus}
      />

      {/* Movie Modal */}
      {selectedMovie && (
        <Suspense fallback={null}>
          <MovieModal
            movie={selectedMovie}
            relatedMovies={relatedMovies}
            onClose={() => handleMovieSelect(null)}
            onRelatedMovieClick={handleMovieSelect}
            onShowAllLocations={() => {
              // Show all locations with connecting lines and close modal
              if (selectedMovie && mapRef.current) {
                mapRef.current.showAllLocationsForMovie(selectedMovie)
                setFocusedMovieId(selectedMovie.movie_id)
                setSelectedMovie(null) // Close modal so user can see the map
                setIsLocationViewed(true)
                // Update URL to remove movie param
                const url = new URL(window.location.href)
                url.searchParams.delete('movie')
                window.history.pushState({}, '', url.toString())
              }
            }}
            onViewLocation={(location) => {
              // First, fly to the specific location
              if (mapRef.current) {
                mapRef.current.flyToLocation(location.lat, location.lng)
                setIsLocationViewed(true)
              }

              // Then close modal with a small delay so the fly animation starts first
              setTimeout(() => {
                setSelectedMovie(null)
                // Update URL to remove movie param
                const url = new URL(window.location.href)
                url.searchParams.delete('movie')
                window.history.pushState({}, '', url.toString())
              }, 100)
            }}
          />
        </Suspense>
      )}

      {/* Reset Focus Button - Shows when a movie is focused */}
      {focusedMovieId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <button
            onClick={handleResetFocus}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>Show All Movies</span>
          </button>
        </div>
      )}

      {/* Reset View Button - Shows when user has viewed a location */}
      {isLocationViewed && !focusedMovieId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 px-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <button
            onClick={handleResetView}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-semibold shadow-xl backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>Reset View</span>
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
