/**
 * Google Analytics tracking utilities for FilmingMap
 * https://filmingmap.com
 */

// Get the GA Measurement ID from environment variables
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

/**
 * Track page views
 * Call this when navigating between pages
 */
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }
}

/**
 * Track custom events
 * Use this to track user interactions
 */
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

/**
 * Pre-defined events for common user interactions
 */

export const trackMovieClick = (movieTitle: string, movieId: string) => {
  event({
    action: 'movie_click',
    category: 'engagement',
    label: `${movieTitle} (${movieId})`,
  })
}

export const trackSearch = (query: string) => {
  event({
    action: 'search',
    category: 'engagement',
    label: query,
  })
}

export const trackFilterChange = (filterType: string, filterValue: string) => {
  event({
    action: 'filter_change',
    category: 'engagement',
    label: `${filterType}: ${filterValue}`,
  })
}

export const trackMapInteraction = (interactionType: 'zoom' | 'pan' | 'rotate') => {
  event({
    action: 'map_interaction',
    category: 'engagement',
    label: interactionType,
  })
}

export const trackLocationView = (locationName: string) => {
  event({
    action: 'location_view',
    category: 'engagement',
    label: locationName,
  })
}

export const trackTrailerClick = (movieTitle: string) => {
  event({
    action: 'trailer_click',
    category: 'engagement',
    label: movieTitle,
  })
}

export const trackShareClick = (platform: string, movieTitle: string) => {
  event({
    action: 'share_click',
    category: 'social',
    label: `${platform} - ${movieTitle}`,
  })
}

// TypeScript declaration for gtag
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event',
      targetId: string,
      config?: Record<string, any>
    ) => void
  }
}
