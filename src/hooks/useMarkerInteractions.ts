/**
 * Hook for managing marker click and hover interactions
 */

import { useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import type { Movie } from '../types'
import type { GeoJSONFeature } from '../utils/map/geoJsonHelpers'

interface UseMarkerInteractionsProps {
  geojsonFeatures: GeoJSONFeature[]
  onMovieSelect: (movie: Movie | null) => void
  focusedMovieId?: string | null
  onClearFocus?: () => void
  convertGeoJSONToMovie?: (feature: any) => Promise<Movie>
}

export function useMarkerInteractions({
  geojsonFeatures,
  onMovieSelect,
  focusedMovieId,
  onClearFocus,
  convertGeoJSONToMovie
}: UseMarkerInteractionsProps) {
  const lastClickedLocationRef = useRef<string | null>(null)
  const clickCycleIndexRef = useRef<number>(0)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  /**
   * Setup marker click handler with overlap cycling
   */
  const setupMarkerClick = useCallback((map: maplibregl.Map) => {
    const handleMarkerClick = async (e: any) => {
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

      // Get clicked coordinates
      const [clickedLng, clickedLat] = (feature.geometry as any).coordinates

      // Try to find in geojsonFeatures by movie_id
      const featureByMovieId = geojsonFeatures.find(f => f.properties.movie_id === feature.properties.movie_id)

      if (featureByMovieId && convertGeoJSONToMovie) {
        // Use the async converter to get full movie data with scenes
        const movieFromFeature = await convertGeoJSONToMovie(featureByMovieId)

        // Find which location was clicked by matching coordinates (tolerance of 0.001 degrees ~111m)
        const clickedLocationIndex = movieFromFeature.locations.findIndex(loc => {
          const latDiff = Math.abs(loc.lat - clickedLat)
          const lngDiff = Math.abs(loc.lng - clickedLng)
          return latDiff < 0.001 && lngDiff < 0.001
        })

        // Add clicked location index to movie object
        const movieWithClickedLocation = {
          ...movieFromFeature,
          clickedLocationIndex: clickedLocationIndex >= 0 ? clickedLocationIndex : undefined
        }

        onMovieSelect(movieWithClickedLocation)
      } else if (featureByMovieId) {
        // Fallback: create basic movie from GeoJSON properties (without scenes)
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
  }, [geojsonFeatures, onMovieSelect, focusedMovieId, onClearFocus, convertGeoJSONToMovie])

  /**
   * Setup marker hover tooltips
   */
  const setupMarkerHover = useCallback((map: maplibregl.Map) => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false, // Keep popup when mouse moves to hover over it
      offset: 25,
      className: 'movie-marker-popup',
      maxWidth: 'none'
    })

    popupRef.current = popup

    // Track if mouse is over popup
    let isOverPopup = false
    let isOverMarker = false

    map.on('mouseenter', 'movie-markers', (e: any) => {
      isOverMarker = true
      map.getCanvas().style.cursor = 'pointer'

      // Get ALL features at this point (overlapping markers)
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['movie-markers']
      })

      if (features.length === 0) return

      const coordinates = (features[0].geometry as any).coordinates.slice()

      if (features.length === 1) {
        // Single movie - show detailed info with location and scene
        const movie = features[0].properties
        const posterUrl = movie.poster || '/images/placeholder-poster.jpg'

        // Get location name - handle both array and string formats
        let locationName = 'Unknown Location'
        if (movie.location_names) {
          if (Array.isArray(movie.location_names)) {
            locationName = movie.location_names[0] || 'Unknown Location'
          } else if (typeof movie.location_names === 'string') {
            // Check if it's a stringified array (MapLibre might convert arrays to strings)
            if (movie.location_names.startsWith('[')) {
              try {
                const parsed = JSON.parse(movie.location_names)
                locationName = Array.isArray(parsed) ? (parsed[0] || 'Unknown Location') : movie.location_names
              } catch (e) {
                locationName = movie.location_names
              }
            } else {
              locationName = movie.location_names
            }
          }
        }

        // Parse location name (format: "City, Country (Address)")
        const locationParts = locationName.split('(')
        const cityCountry = locationParts[0].trim()
        const address = locationParts.length > 1 ? locationParts[1].replace(')', '').trim() : ''

        const [city = 'Unknown', ...countryParts] = cityCountry.split(',').map((s: string) => s.trim())
        const country = countryParts.join(', ') || ''

        const html = `
          <style>
            .movie-hover-card {
              margin: 0 !important;
              padding: 0 !important;
            }
            .hover-clickable {
              cursor: pointer;
              transition: all 0.2s;
            }
            .hover-clickable:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 40px rgba(255,215,0,0.3);
            }
          </style>
          <div class="movie-hover-card hover-clickable" style="
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #FFD700;
            border-radius: 12px;
            overflow: hidden;
            min-width: 300px;
            max-width: 320px;
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
                  🎬 ${movie.title}
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

              <!-- Location Info -->
              <div style="
                background: rgba(99, 102, 241, 0.1);
                border-left: 3px solid #6366f1;
                padding: 8px 10px;
                border-radius: 6px;
                margin-bottom: 10px;
              ">
                <div style="
                  color: #a5b4fc;
                  font-size: 10px;
                  font-weight: bold;
                  text-transform: uppercase;
                  margin-bottom: 4px;
                ">📍 Location</div>
                <div style="color: #e0e0ff; font-size: 12px; font-weight: 500;">
                  ${city}${country ? `, ${country}` : ''}
                </div>
                ${address ? `
                  <div style="color: #c7d2fe; font-size: 11px; margin-top: 2px;">
                    ${address}
                  </div>
                ` : ''}
              </div>

              <!-- Scene Info (if available) -->
              ${movie.scene_description ? `
                <div style="
                  background: rgba(251, 191, 36, 0.1);
                  border-left: 3px solid #f59e0b;
                  padding: 8px 10px;
                  border-radius: 6px;
                  margin-bottom: 10px;
                ">
                  <div style="
                    color: #fcd34d;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                  ">🎬 Scene</div>
                  <div style="
                    color: #fde68a;
                    font-size: 11px;
                    font-style: italic;
                    line-height: 1.4;
                  ">
                    ${movie.scene_description}
                  </div>
                </div>
              ` : ''}

              <div style="
                color: #FFD700;
                font-size: 11px;
                font-weight: bold;
                padding-top: 10px;
                border-top: 1px solid #444;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
              ">
                <span style="font-size: 14px;">👆</span>
                Click to view full details
              </div>
            </div>
          </div>
        `
        popup.setLngLat(coordinates).setHTML(html).addTo(map)

        // Add event listener to popup element to keep it open when hovering AND make it clickable
        setTimeout(() => {
          const popupEl = popup.getElement()
          if (popupEl) {
            popupEl.addEventListener('mouseenter', () => {
              isOverPopup = true
            })
            popupEl.addEventListener('mouseleave', () => {
              isOverPopup = false
              if (!isOverMarker) {
                popup.remove()
              }
            })
            // Make the popup clickable - trigger the same logic as clicking the marker
            popupEl.addEventListener('click', async (e) => {
              e.stopPropagation()

              // Close popup first
              popup.remove()

              // Get the feature and trigger movie selection directly
              const feature = features[0]
              const featureByMovieId = geojsonFeatures.find(f => f.properties.movie_id === feature.properties.movie_id)

              if (featureByMovieId && convertGeoJSONToMovie) {
                const [lng, lat] = coordinates
                const movieFromFeature = await convertGeoJSONToMovie(featureByMovieId)

                // Find clicked location index (same tolerance as marker click)
                const clickedLocationIndex = movieFromFeature.locations.findIndex(loc => {
                  const latDiff = Math.abs(loc.lat - lat)
                  const lngDiff = Math.abs(loc.lng - lng)
                  return latDiff < 0.001 && lngDiff < 0.001
                })

                const movieWithClickedLocation = {
                  ...movieFromFeature,
                  clickedLocationIndex: clickedLocationIndex >= 0 ? clickedLocationIndex : undefined
                }

                onMovieSelect(movieWithClickedLocation)
              }
            })
          }
        }, 0)
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
          <div class="hover-clickable" style="
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
              color: #01affe;
              font-size: 12px;
              font-weight: bold;
              padding-top: 12px;
              margin-top: 12px;
              border-top: 2px solid #444;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">
              ✨ Zoom closer to select a movie
            </div>
          </div>
        `
        popup.setLngLat(coordinates).setHTML(html).addTo(map)

        // Add event listener to popup element
        setTimeout(() => {
          const popupEl = popup.getElement()
          if (popupEl) {
            popupEl.addEventListener('mouseenter', () => {
              isOverPopup = true
            })
            popupEl.addEventListener('mouseleave', () => {
              isOverPopup = false
              if (!isOverMarker) {
                popup.remove()
              }
            })
          }
        }, 0)
      }
    })

    map.on('mouseleave', 'movie-markers', () => {
      isOverMarker = false
      map.getCanvas().style.cursor = ''

      // Only close popup if not hovering over it
      setTimeout(() => {
        if (!isOverPopup) {
          popup.remove()
        }
      }, 100)
    })
  }, [geojsonFeatures, onMovieSelect, convertGeoJSONToMovie])

  return {
    setupMarkerClick,
    setupMarkerHover
  }
}
