/**
 * Hook for persisting filter state to localStorage
 */

import { useEffect, useState } from 'react'
import type { FilterState } from '../types'

const STORAGE_KEY = 'filmingmap_filters'
const VISITED_KEY = 'filmingmap_visited'

const DEFAULT_FILTERS: FilterState = {
  genres: [],
  decades: [1980, 2030],
  streaming: [],
  starRating: [0, 10],
  topIMDB: true, // Default for first-time visitors
}

/**
 * Check if user has visited before
 */
function hasVisitedBefore(): boolean {
  try {
    return localStorage.getItem(VISITED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Mark user as visited
 */
function markAsVisited(): void {
  try {
    localStorage.setItem(VISITED_KEY, 'true')
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Load filters from localStorage
 */
function loadFilters(): FilterState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate the structure
      return {
        genres: Array.isArray(parsed.genres) ? parsed.genres : DEFAULT_FILTERS.genres,
        decades: Array.isArray(parsed.decades) && parsed.decades.length === 2
          ? [parsed.decades[0], parsed.decades[1]]
          : DEFAULT_FILTERS.decades,
        streaming: Array.isArray(parsed.streaming) ? parsed.streaming : DEFAULT_FILTERS.streaming,
        starRating: Array.isArray(parsed.starRating) && parsed.starRating.length === 2
          ? [parsed.starRating[0], parsed.starRating[1]]
          : DEFAULT_FILTERS.starRating,
        topIMDB: typeof parsed.topIMDB === 'boolean' ? parsed.topIMDB : DEFAULT_FILTERS.topIMDB,
      }
    }
  } catch (error) {
    console.warn('Failed to load filters from localStorage:', error)
  }
  return DEFAULT_FILTERS
}

/**
 * Save filters to localStorage
 */
function saveFilters(filters: FilterState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch (error) {
    console.warn('Failed to save filters to localStorage:', error)
  }
}

/**
 * Hook to manage filter persistence
 */
export function useFilterPersistence() {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(true)
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize filters on mount
  useEffect(() => {
    const visited = hasVisitedBefore()
    setIsFirstVisit(!visited)

    if (visited) {
      // Returning user - load their saved filters
      const savedFilters = loadFilters()
      setFiltersState(savedFilters)
    } else {
      // First-time user - use defaults (TOP 250 active)
      setFiltersState(DEFAULT_FILTERS)
      markAsVisited()
    }

    setIsInitialized(true)
  }, [])

  // Save filters whenever they change (but only after initialization)
  const setFilters = (newFilters: FilterState) => {
    setFiltersState(newFilters)
    if (isInitialized) {
      saveFilters(newFilters)
    }
  }

  return {
    filters,
    setFilters,
    isFirstVisit,
    isInitialized,
  }
}
