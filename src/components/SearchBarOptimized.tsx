/**
 * SearchBar Component - OPTIMIZED with indexed search
 * Uses lightweight search index instead of loading full GeoJSON
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Fuse from 'fuse.js'
import type { Movie } from '../types'
import { debounce } from '../utils/helpers'

interface SearchBarProps {
  onSearch: (query: string) => void
  onMovieSelect: (movie: Movie | null) => void
}

interface SearchIndexEntry {
  id: string
  title: string
  year: number
  genres: string[]
  locations: string[]
  rating?: number
  poster?: string
  chunk: number
}

interface SearchIndex {
  version: number
  totalMovies: number
  totalChunks: number
  generatedAt: string
  index: SearchIndexEntry[]
}

export default function SearchBar({ onSearch, onMovieSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchIndexEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [fuse, setFuse] = useState<Fuse<SearchIndexEntry> | null>(null)
  const [loadingChunks, setLoadingChunks] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const chunkCacheRef = useRef<Map<number, any>>(new Map())

  /**
   * Load search index (lightweight) instead of full GeoJSON
   */
  useEffect(() => {
    const loadSearchIndex = async () => {
      try {
        // Try optimized search index first
        const response = await fetch('/geo/search/index.json')

        if (response.ok) {
          const searchIndex: SearchIndex = await response.json()

          // Initialize Fuse.js with lightweight index
          const fuseInstance = new Fuse(searchIndex.index, {
            keys: [
              { name: 'title', weight: 2 },
              { name: 'genres', weight: 1 },
              { name: 'locations', weight: 1.5 },
            ],
            threshold: 0.3,
            includeScore: true,
          })
          setFuse(fuseInstance)
        } else {
          // Fallback to full GeoJSON if index not available
          console.warn('⚠️ Search index not found, falling back to full GeoJSON')
          await loadLegacySearch()
        }
      } catch (error) {
        console.error('Failed to load search index:', error)
        await loadLegacySearch()
      }
    }

    loadSearchIndex()
  }, [])

  /**
   * Legacy search loading (fallback)
   */
  const loadLegacySearch = async () => {
    try {
      const response = await fetch('/geo/movies.geojson')
      const geojsonData = await response.json()

      // Convert to search index format
      const searchIndex: SearchIndexEntry[] = []
      const seenIds = new Set<string>()

      for (const feature of geojsonData.features) {
        const movieId = feature.properties.movie_id

        if (seenIds.has(movieId)) continue
        seenIds.add(movieId)

        const locations = Array.from(new Set(
          feature.properties.location_names.map((loc: string) => {
            const parts = loc.split(',')
            return parts.length > 1 ? parts[1].trim() : parts[0].trim()
          })
        )) as string[]

        searchIndex.push({
          id: movieId,
          title: feature.properties.title,
          year: feature.properties.year,
          genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
          locations,
          rating: feature.properties.imdb_rating,
          poster: feature.properties.thumbnail_52 || feature.properties.poster,
          chunk: -1, // No chunk in legacy mode
        })
      }

      const fuseInstance = new Fuse(searchIndex, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'genres', weight: 1 },
          { name: 'locations', weight: 1.5 },
        ],
        threshold: 0.3,
        includeScore: true,
      })
      setFuse(fuseInstance)
    } catch (error) {
      console.error('Failed to load legacy search:', error)
    }
  }

  /**
   * Load full movie data from chunk when needed
   */
  const loadMovieDetails = useCallback(async (entry: SearchIndexEntry): Promise<Movie | null> => {
    // Check cache first
    if (chunkCacheRef.current.has(entry.chunk)) {
      const chunk = chunkCacheRef.current.get(entry.chunk)
      const feature = chunk.features.find((f: any) => f.properties.movie_id === entry.id)
      return feature ? convertFeatureToMovie(feature) : null
    }

    // Load chunk if not cached
    try {
      setLoadingChunks(true)
      const response = await fetch(`/geo/search/chunk-${entry.chunk}.json`)
      const chunk = await response.json()

      // Cache the chunk
      chunkCacheRef.current.set(entry.chunk, chunk)

      // Find and convert the movie
      const feature = chunk.features.find((f: any) => f.properties.movie_id === entry.id)
      return feature ? convertFeatureToMovie(feature) : null
    } catch (error) {
      console.error('Failed to load movie chunk:', error)
      return null
    } finally {
      setLoadingChunks(false)
    }
  }, [])

  /**
   * Convert GeoJSON feature to Movie object
   */
  const convertFeatureToMovie = (feature: any): Movie => {
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
      tmdb_id: String(feature.properties.tmdb_id || ''),
      genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
      poster: feature.properties.poster || undefined,
      trailer: feature.properties.trailer || undefined,
      imdb_rating: feature.properties.imdb_rating || undefined,
      locations,
    }
  }

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
      const entries = searchResults.slice(0, 8).map((result) => result.item)
      setResults(entries)
      setIsOpen(entries.length > 0)
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
   * Handle movie selection - load full details
   */
  const handleMovieSelect = async (entry: SearchIndexEntry) => {
    setQuery(entry.title)
    setIsOpen(false)

    // Load full movie details from chunk
    const movie = await loadMovieDetails(entry)
    if (movie) {
      onMovieSelect(movie)
    }
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
          placeholder="Search movies..."
          aria-label="Search movies"
          className="w-full px-4 py-3 pl-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
          disabled={loadingChunks}
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          {loadingChunks ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
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
          )}
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
            {results.map((entry) => (
              <li
                key={entry.id}
                role="option"
                onClick={() => handleMovieSelect(entry)}
                className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {entry.poster && (
                    <img
                      src={entry.poster}
                      alt={`${entry.title} poster`}
                      className="w-12 h-16 object-cover rounded"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                      {entry.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {entry.year} • {entry.genres.slice(0, 2).join(', ')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {entry.locations.length} location
                      {entry.locations.length !== 1 ? 's' : ''}
                      {' • '}
                      {entry.locations.slice(0, 3).join(', ')}
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
