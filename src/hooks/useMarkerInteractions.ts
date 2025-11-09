/**
 * Hook for managing marker click and hover interactions
 */

import { useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie } from '../types'
import type { GeoJSONFeature } from '../utils/map/geoJsonHelpers'
import { convertFeatureToMovie } from '../utils/map/geoJsonHelpers'

interface UseMarkerInteractionsProps {
  geojsonFeatures: GeoJSONFeature[]
  onMovieSelect: (movie: Movie | null) => void
  focusedMovieId?: string | null
  onClearFocus?: () => void
}

export function useMarkerInteractions({
  geojsonFeatures,
  onMovieSelect,
  focusedMovieId,
  onClearFocus
}: UseMarkerInteractionsProps) {
  const lastClickedLocationRef = useRef<string | null>(null)
  const clickCycleIndexRef = useRef<number>(0)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  /**
   * Setup marker click handler with overlap cycling
   */
  const setupMarkerClick = useCallback((map: maplibregl.Map) => {
    const handleMarkerClick = (e: any) => {
      if (!e.features || e.features.length === 0) return

      // Get all features at click point (overlapping markers)
      const clickedFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['movie-markers']
      })

      if (clickedFeatures.length === 0) return

      // Create location key for this click
      const firstFeature = clickedFeatures[0]
      const [lng, lat] = firstFeature.geometry.type === 'Point'
        ? (firstFeature.geometry as any).coordinates
        : [0, 0]
      const locationKey = `${lng.toFixed(4)}_${lat.toFixed(4)}`

      // Check if clicking same location again (cycle through)
      if (lastClickedLocationRef.current === locationKey && clickedFeatures.length > 1) {
        clickCycleIndexRef.current = (clickCycleIndexRef.current + 1) % clickedFeatures.length
      } else {
        // New location - reset cycle
        lastClickedLocationRef.current = locationKey
        clickCycleIndexRef.current = 0
      }

      const feature = clickedFeatures[clickCycleIndexRef.current]

      // Try to find in geojsonFeatures by movie_id
      const featureByMovieId = geojsonFeatures.find(f => f.properties.movie_id === feature.properties.movie_id)

      if (featureByMovieId) {
        const movieFromFeature = convertFeatureToMovie(featureByMovieId)
        onMovieSelect(movieFromFeature)
      } else {
        // Last resort: create a minimal movie object
        const movieFromClick = {
          movie_id: feature.properties.movie_id,
          title: feature.properties.title,
          year: feature.properties.year,
          imdb_id: feature.properties.movie_id,
          tmdb_id: String(feature.properties.tmdb_id),
          genres: feature.properties.genres || (feature.properties.top_genre ? [feature.properties.top_genre] : []),
          poster: feature.properties.poster || undefined,
          trailer: feature.properties.trailer || undefined,
          imdb_rating: feature.properties.imdb_rating || undefined,
          locations: [{
            lat: 0,
            lng: 0,
            city: 'Unknown',
            country: 'Unknown',
          }],
        }
        onMovieSelect(movieFromClick as Movie)
      }
    }

    map.on('click', 'movie-markers', handleMarkerClick)

    // Clear focus when clicking on empty map
    const handleMapClick = (e: any) => {
      if (!e.features || e.features.length === 0) {
        if (focusedMovieId && onClearFocus) {
          onClearFocus()
        }
      }
    }

    map.on('click', handleMapClick)
  }, [geojsonFeatures, onMovieSelect, focusedMovieId, onClearFocus])

  /**
   * Setup marker hover tooltips
   */
  const setupMarkerHover = useCallback((map: maplibregl.Map) => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 25,
      className: 'movie-marker-popup',
      maxWidth: 'none'
    })

    popupRef.current = popup

    map.on('mouseenter', 'movie-markers', (e: any) => {
      map.getCanvas().style.cursor = 'pointer'

      // Get ALL features at this point (overlapping markers)
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['movie-markers']
      })

      if (features.length === 0) return

      const coordinates = (features[0].geometry as any).coordinates.slice()

      if (features.length === 1) {
        // Single movie - show hero banner with poster
        const movie = features[0].properties
        const posterUrl = movie.poster || '/images/placeholder-poster.jpg'

        const html = `
          <style>
            .movie-hover-card {
              margin: 0 !important;
              padding: 0 !important;
            }
          </style>
          <div class="movie-hover-card" style="
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #FFD700;
            border-radius: 12px;
            overflow: hidden;
            min-width: 280px;
            max-width: 300px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            margin: 0;
            padding: 0;
          ">
            <div style="
              width: 100%;
              height: 140px;
              background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7)),
                          url('${posterUrl}');
              background-size: cover;
              background-position: center;
              display: flex;
              align-items: flex-end;
              padding: 12px;
              position: relative;
            ">
              <div style="
                background: rgba(0,0,0,0.8);
                backdrop-filter: blur(10px);
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid rgba(255,215,0,0.3);
                width: 100%;
              ">
                <div style="
                  color: #FFD700;
                  font-weight: bold;
                  font-size: 15px;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                  display: flex;
                  align-items: center;
                  gap: 6px;
                ">
                   ${movie.title}
                </div>
              </div>
            </div>
            <div style="padding: 12px 14px;">
              <div style="
                color: #e0e0e0;
                font-size: 13px;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
              ">
                <span style="
                  background: rgba(255,215,0,0.2);
                  color: #FFD700;
                  padding: 3px 8px;
                  border-radius: 6px;
                  font-size: 11px;
                  font-weight: bold;
                ">📅 ${movie.year}</span>
                ${movie.top_genre ? `
                  <span style="
                    background: rgba(6,184,42,0.2);
                    color: #06b82a;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: bold;
                  ">${movie.top_genre}</span>
                ` : ''}
                ${movie.imdb_rating ? `
                  <span style="
                    background: rgba(255,215,0,0.2);
                    color: #FFD700;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: bold;
                  ">⭐ ${movie.imdb_rating}</span>
                ` : ''}
              </div>
              <div style="
                color: #FFD700;
                font-size: 11px;
                font-weight: bold;
                padding-top: 10px;
                border-top: 1px solid #444;
                text-align: center;
              ">
                 Click to view full details
              </div>
            </div>
          </div>
        `
        popup.setLngLat(coordinates).setHTML(html).addTo(map)
      } else {
        // Multiple movies - show list
        const movieList = features.slice(0, 6).map((f: any, idx: number) => {
          const movie = f.properties
          return `
            <div style="
              padding: 8px;
              border-radius: 6px;
              background: ${idx % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)'};
              margin: 4px 0;
            ">
              <div style="color: #FFD700; font-weight: bold; font-size: 12px;">
                ${idx + 1}. ${movie.title}
              </div>
              <div style="color: #999; font-size: 10px; margin-top: 2px;">
                ${movie.year} ${movie.top_genre ? `• ${movie.top_genre}` : ''}
              </div>
            </div>
          `
        }).join('')

        const moreCount = features.length > 6 ? features.length - 6 : 0

        const html = `
          <div style="
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 3px solid #FF6B6B;
            border-radius: 12px;
            padding: 14px;
            min-width: 280px;
            max-width: 320px;
            box-shadow: 0 12px 48px rgba(255,107,107,0.4);
          ">
            <div style="
              color: #FF6B6B;
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 8px;
              border-bottom: 2px solid #FF6B6B;
            ">
              <span>📍 ${features.length} Movies in this Location!</span>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
              ${movieList}
              ${moreCount > 0 ? `
                <div style="
                  text-align: center;
                  color: #FFD700;
                  font-style: italic;
                  margin-top: 8px;
                  padding: 8px;
                  background: rgba(255,215,0,0.1);
                  border-radius: 6px;
                ">
                  ...and ${moreCount} more
                </div>
              ` : ''}
            </div>
            <div style="
              color: #FFD700;
              font-size: 12px;
              font-weight: bold;
              padding-top: 12px;
              margin-top: 12px;
              border-top: 2px solid #444;
              text-align: center;
            ">
             Zoom in to see all movies
            </div>
          </div>
        `
        popup.setLngLat(coordinates).setHTML(html).addTo(map)
      }
    })

    map.on('mouseleave', 'movie-markers', () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    })
  }, [])

  return {
    setupMarkerClick,
    setupMarkerHover
  }
}
