'use client'

/**
 * MapWrapper - Wrapper to ensure proper ref forwarding with Next.js dynamic imports
 */

import { forwardRef } from 'react'
import Map from './Map/index'
import type { MapRef } from './Map/index'
import type { Movie, FilterState } from '../types'

interface MapProps {
  selectedMovie: Movie | null
  onMovieSelect: (movie: Movie | null) => void
  searchQuery: string
  filters: FilterState
  focusedMovieId?: string | null
  onClearFocus?: () => void
  convertGeoJSONToMovie?: (feature: any) => Promise<Movie>
}

const MapWrapper = forwardRef<MapRef, MapProps>((props, ref) => {
  return <Map {...props} ref={ref} />
})

MapWrapper.displayName = 'MapWrapper'

export default MapWrapper
