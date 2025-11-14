/**
 * SearchBar Component - Fuzzy search with Fuse.js
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Fuse from 'fuse.js'
import type { Movie } from '../types'
import { debounce } from '../utils/helpers'

interface SearchBarProps {
  onSearch: (query: string) => void
  onMovieSelect: (movie: Movie | null) => void
}

export default function SearchBar({ onSearch, onMovieSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [fuse, setFuse] = useState<Fuse<Movie> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  /**
   * Load movies and initialize Fuse.js
   */
  useEffect(() => {
    const loadMovies = async () => {
      try {
        const response = await fetch('/geo/movies.geojson')
        const geojsonData = await response.json()

        // Convert GeoJSON features to Movie objects
        const movies: Movie[] = geojsonData.features.map((feature: any) => {
          // Extract locations from geometry
          let locations = []

          if (feature.geometry.type === 'Point') {
            const [lng, lat] = feature.geometry.coordinates
            locations = [{
              lat,
              lng,
              city: feature.properties.location_names[0]?.split(',')[0] || 'Unknown',
              country: feature.properties.location_names[0]?.split(',')[1]?.trim() || 'Unknown',
            }]
          } else if (feature.geometry.type === 'MultiPoint') {
            const coords = feature.geometry.coordinates
            locations = coords.map((coord: number[], idx: number) => {
              const [lng, lat] = coord
              const locationName = feature.properties.location_names[idx] || 'Unknown'
              const [city, country] = locationName.split(',').map((s: string) => s.trim())
              return {
                lat,
                lng,
                city: city || 'Unknown',
                country: country || 'Unknown',
              }
            })
          }

          return {
            movie_id: feature.properties.movie_id,
            title: feature.properties.title,
            year: feature.properties.year,
            imdb_id: feature.properties.movie_id,
            tmdb_id: String(feature.properties.tmdb_id),
            genres: (feature.properties as any).genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
            poster: feature.properties.poster || undefined,
            trailer: feature.properties.trailer || undefined,
            imdb_rating: feature.properties.imdb_rating || undefined,
            locations,
          }
        })

        // Initialize Fuse.js for fuzzy search
        const fuseInstance = new Fuse(movies, {
          keys: [
            { name: 'title', weight: 2 },
            { name: 'genres', weight: 1 },
            { name: 'locations.city', weight: 1.5 },
            { name: 'locations.country', weight: 1.5 },
          ],
          threshold: 0.3,
          includeScore: true,
        })
        setFuse(fuseInstance)
      } catch (error) {
        console.error('Failed to load movies:', error)
      }
    }
    loadMovies()
  }, [])

  /**
   * Handle search with debouncing
   */
  const handleSearch = useCallback(
    debounce((searchQuery: string) => {
      if (!fuse || !searchQuery.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      const searchResults = fuse.search(searchQuery)
      const movies = searchResults.slice(0, 8).map((result) => result.item)
      setResults(movies)
      setIsOpen(movies.length > 0)
      onSearch(searchQuery)
    }, 300),
    [fuse, onSearch]
  )

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value)
  }

  /**
   * Handle movie selection
   */
  const handleMovieSelect = (movie: Movie) => {
    setQuery(movie.title)
    setIsOpen(false)
    onMovieSelect(movie)
  }

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          placeholder="Search..."
          aria-label="Search movies"
          className="w-full px-4 py-3 pl-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setIsOpen(false)
              onMovieSelect(null)
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto custom-scrollbar">
          <ul role="listbox" aria-label="Search results">
            {results.map((movie) => (
              <li
                key={movie.movie_id}
                role="option"
                onClick={() => handleMovieSelect(movie)}
                className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {movie.poster && (
                    <img
                      src={movie.poster}
                      alt={`${movie.title} poster`}
                      className="w-12 h-16 object-cover rounded"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                      {movie.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {movie.year} • {movie.genres.slice(0, 2).join(', ')}
                      {movie.imdb_rating && (
                        <span className="ml-2 text-yellow-500 font-semibold">
                          ⭐ {movie.imdb_rating.toFixed(1)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-yellow-500 dark:text-yellow-400 font-semibold">
                        {movie.locations.length} location{movie.locations.length !== 1 ? 's' : ''}
                      </span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
