/**
 * Filters Component - Genre, decade, and streaming filters
 */

import { useState, useEffect } from 'react'
import type { FilterState, Movie } from '../types'
import { getUniqueGenres, getUniqueStreamingPlatforms } from '../utils/helpers'

interface FiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export default function Filters({ filters, onFiltersChange }: FiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [availableStreaming, setAvailableStreaming] = useState<string[]>([])

  /**
   * Load available filter options
   */
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch('/geo/movies.geojson')
        const geojsonData = await response.json()

        // Convert GeoJSON features to Movie objects for filter extraction
        const movies: Movie[] = geojsonData.features.map((feature: any) => ({
          movie_id: feature.properties.movie_id,
          title: feature.properties.title,
          year: feature.properties.year,
          imdb_id: feature.properties.movie_id,
          tmdb_id: String(feature.properties.tmdb_id),
          genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
          streaming: [], // Not available in GeoJSON
          locations: [],
        }))

        setAvailableGenres(getUniqueGenres(movies))
        setAvailableStreaming(getUniqueStreamingPlatforms(movies))
      } catch (error) {
        console.error('Failed to load filter options:', error)
      }
    }
    loadFilterOptions()
  }, [])

  /**
   * Handle genre toggle
   */
  const toggleGenre = (genre: string) => {
    const newGenres = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre]
    onFiltersChange({ ...filters, genres: newGenres })
  }

  /**
   * Handle streaming platform toggle
   */
  const toggleStreaming = (platform: string) => {
    const newStreaming = filters.streaming.includes(platform)
      ? filters.streaming.filter((p) => p !== platform)
      : [...filters.streaming, platform]
    onFiltersChange({ ...filters, streaming: newStreaming })
  }

  /**
   * Handle decade slider change
   */
  const handleDecadeChange = (index: 0 | 1, value: number) => {
    const newDecades: [number, number] = [...filters.decades]
    newDecades[index] = value
    onFiltersChange({ ...filters, decades: newDecades })
  }

  /**
   * Reset all filters
   */
  const resetFilters = () => {
    onFiltersChange({
      genres: [],
      decades: [1980, 2030],
      streaming: [],
    })
  }

  const activeFilterCount =
    filters.genres.length +
    filters.streaming.length +
    (filters.decades[0] !== 1980 || filters.decades[1] !== 2030 ? 1 : 0)

  return (
    <div className="relative">
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg hover:shadow-xl transition-shadow flex items-center justify-between text-gray-900 dark:text-white"
        aria-label="Toggle filters"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2">
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
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
          </svg>
          <span className="font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </span>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {/* Filters Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
          {/* Genres */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
              <span>Genres</span>
              {filters.genres.length > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, genres: [] })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    filters.genres.includes(genre)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                  }`}
                  aria-pressed={filters.genres.includes(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Decades */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Year Range
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  From: {filters.decades[0]}
                </label>
                <input
                  type="range"
                  min="1980"
                  max="2030"
                  step="5"
                  value={filters.decades[0]}
                  onChange={(e) => handleDecadeChange(0, Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  aria-label="Start year"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  To: {filters.decades[1]}
                </label>
                <input
                  type="range"
                  min="1980"
                  max="2030"
                  step="5"
                  value={filters.decades[1]}
                  onChange={(e) => handleDecadeChange(1, Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  aria-label="End year"
                />
              </div>
            </div>
          </div>

          {/* Streaming Platforms */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
              <span>Streaming On</span>
              {filters.streaming.length > 0 && (
                <button
                  onClick={() => onFiltersChange({ ...filters, streaming: [] })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </h3>
            <div className="space-y-2">
              {availableStreaming.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={filters.streaming.includes(platform)}
                    onChange={() => toggleStreaming(platform)}
                    className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {platform}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Reset Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-semibold"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
