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
   * Reset all filters
   */
  const resetFilters = () => {
    onFiltersChange({
      genres: [],
      decades: [1980, 2030],
      streaming: [],
      starRating: [0, 10],
      topIMDB: false,
    })
  }

  const activeFilterCount =
    filters.genres.length +
    filters.streaming.length +
    (filters.starRating[0] !== 0 || filters.starRating[1] !== 10 ? 1 : 0) +
    (filters.topIMDB ? 1 : 0)

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

          {/* Star Rating */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>⭐ IMDB Rating</span>
              {(filters.starRating[0] !== 0 || filters.starRating[1] !== 10) && (
                <button
                  onClick={() => onFiltersChange({ ...filters, starRating: [0, 10] })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  Minimum: {filters.starRating[0].toFixed(1)} ⭐
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={filters.starRating[0]}
                  onChange={(e) => {
                    const newMin = Number(e.target.value)
                    const newMax = Math.max(newMin, filters.starRating[1])
                    onFiltersChange({ ...filters, starRating: [newMin, newMax] })
                  }}
                  className="w-full h-2 bg-gradient-to-r from-yellow-200 to-yellow-400 rounded-lg appearance-none cursor-pointer"
                  aria-label="Minimum IMDB rating"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  Maximum: {filters.starRating[1].toFixed(1)} ⭐
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={filters.starRating[1]}
                  onChange={(e) => {
                    const newMax = Number(e.target.value)
                    const newMin = Math.min(newMax, filters.starRating[0])
                    onFiltersChange({ ...filters, starRating: [newMin, newMax] })
                  }}
                  className="w-full h-2 bg-gradient-to-r from-yellow-200 to-yellow-400 rounded-lg appearance-none cursor-pointer"
                  aria-label="Maximum IMDB rating"
                />
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Range:</span>
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {filters.starRating[0].toFixed(1)} - {filters.starRating[1].toFixed(1)} ⭐
                </span>
              </div>
            </div>
          </div>

          {/* TOP 250 IMDB */}
          <div className={`mb-6 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border-2 transition-all duration-300 ${
            filters.topIMDB
              ? 'border-yellow-400 dark:border-yellow-500 shadow-lg shadow-yellow-200/50 dark:shadow-yellow-500/20 animate-pulse-soft'
              : 'border-yellow-300 dark:border-yellow-700'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.topIMDB}
                onChange={(e) => onFiltersChange({ ...filters, topIMDB: e.target.checked })}
                className="mt-1 w-5 h-5 text-yellow-600 bg-white border-yellow-400 rounded focus:ring-yellow-500 focus:ring-2 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className={`text-xl ${filters.topIMDB ? 'animate-bounce-gentle' : ''}`}>🏆</span>
                  <span>IMDB TOP 250</span>
                  {filters.topIMDB && (
                    <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-400 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 rounded-full font-semibold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Show only the highest-rated 250 movies/tv shows on IMDB by ranking
                </p>
              </div>
            </label>
          </div>

          {/* Streaming Platforms */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">

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
