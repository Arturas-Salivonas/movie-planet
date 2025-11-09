/**
 * Hook for managing clickable region circles on the map
 * Handles region hover, popups, and navigation
 */

import { useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'

export function useClickableRegions() {
  const hoveredRegionIdRef = useRef<string | number | null>(null)
  const currentPopupRef = useRef<maplibregl.Popup | null>(null)

  /**
   * Add clickable regions layer to the map
   */
  const addClickableRegions = useCallback(async (map: maplibregl.Map) => {
    try {
      const regionsResponse = await fetch('/geo/clickable-regions.geojson')
      const regionsData = await regionsResponse.json()

      map.addSource('clickable-regions', {
        type: 'geojson',
        data: regionsData,
        tolerance: 0
      })

      // Add circle layer (grey glow that appears when zoomed in)
      map.addLayer({
        id: 'region-circles',
        type: 'circle',
        source: 'clickable-regions',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 8,
            3, 16,
            4, 40,
            6, 80,
            10, 200
          ],
          'circle-color': '#9ca3af9c',
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, 0.2,
            3, 0.25,
            4, 0.3,
            6, ['case', ['boolean', ['feature-state', 'hover'], false], 0.5, 0.35]
          ]
        }
      }, 'movie-markers') // Insert BEFORE movie-markers so it's underneath

      return true
    } catch (error) {
      console.error('Failed to load clickable regions:', error)
      return false
    }
  }, [])

  /**
   * Setup region hover handlers
   */
  const setupRegionHover = useCallback((map: maplibregl.Map) => {
    map.on('mousemove', 'region-circles', (e: any) => {
      // Check if there's a movie marker at this position (higher priority)
      const movieFeatures = map.queryRenderedFeatures(e.point, { layers: ['movie-markers'] })
      if (movieFeatures && movieFeatures.length > 0) {
        // There's a movie marker here, don't show region popup
        if (currentPopupRef.current) {
          currentPopupRef.current.remove()
          currentPopupRef.current = null
        }
        if (hoveredRegionIdRef.current !== null) {
          map.setFeatureState(
            { source: 'clickable-regions', id: hoveredRegionIdRef.current },
            { hover: false }
          )
          hoveredRegionIdRef.current = null
        }
        return
      }

      if (e.features && e.features.length > 0) {
        map.getCanvas().style.cursor = 'pointer'

        const feature = e.features[0]
        const name = feature.properties.name
        const movieCount = feature.properties.movieCount

        // Update hover state
        if (hoveredRegionIdRef.current !== e.features[0].id) {
          if (hoveredRegionIdRef.current !== null) {
            map.setFeatureState(
              { source: 'clickable-regions', id: hoveredRegionIdRef.current as string | number },
              { hover: false }
            )
          }
          hoveredRegionIdRef.current = e.features[0].id
          map.setFeatureState(
            { source: 'clickable-regions', id: hoveredRegionIdRef.current as string | number },
            { hover: true }
          )
        }

        // Show popup on hover
        if (!currentPopupRef.current || currentPopupRef.current.getLngLat().lng !== e.lngLat.lng) {
          if (currentPopupRef.current) {
            currentPopupRef.current.remove()
          }

          currentPopupRef.current = new (maplibregl as any).Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'region-popup',
            maxWidth: '300px'
          })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="
                padding: 20px;
                text-align: center;
                background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
                border-radius: 12px;
              ">
                <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: bold; color: #fff;">
                  📍 ${name}
                </h3>
                <p style="margin: 0; color: #d1d5db; font-size: 14px;">
                  ${movieCount} movies filmed here
                </p>
                <p style="
                  color: #FFD700;
                  font-size: 11px;
                  font-weight: bold;
                  padding-top: 10px;
                  border-top: 1px solid #444;
                  text-align: center;
                ">
                  Click to see full list
                </p>
              </div>
            `)
            .addTo(map)
        }
      }
    })

    map.on('mouseleave', 'region-circles', () => {
      if (hoveredRegionIdRef.current !== null) {
        map.setFeatureState(
          { source: 'clickable-regions', id: hoveredRegionIdRef.current as string | number },
          { hover: false }
        )
      }
      hoveredRegionIdRef.current = null
      map.getCanvas().style.cursor = ''

      if (currentPopupRef.current) {
        currentPopupRef.current.remove()
        currentPopupRef.current = null
      }
    })
  }, [])

  /**
   * Setup region click handlers for navigation
   */
  const setupRegionClick = useCallback((map: maplibregl.Map) => {
    map.on('click', 'region-circles', (e: any) => {
      // Check if there's a movie marker at this position (higher priority)
      const movieFeatures = map.queryRenderedFeatures(e.point, { layers: ['movie-markers'] })
      if (movieFeatures && movieFeatures.length > 0) {
        return
      }

      if (e.features && e.features.length > 0) {
        const feature = e.features[0]
        const slug = feature.properties.slug
        window.location.href = `/location/${slug}`
      }
    })
  }, [])

  return {
    addClickableRegions,
    setupRegionHover,
    setupRegionClick
  }
}
