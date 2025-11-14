/**
 * Coordinate utilities for map operations
 */

import type { Location } from '../../types'

/**
 * Calculate bounds from movie locations
 */
export function calculateBoundsFromLocations(locations: Location[]): {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
} | null {
  if (locations.length === 0) return null

  let minLng = locations[0].lng
  let maxLng = locations[0].lng
  let minLat = locations[0].lat
  let maxLat = locations[0].lat

  locations.forEach(loc => {
    minLng = Math.min(minLng, loc.lng)
    maxLng = Math.max(maxLng, loc.lng)
    minLat = Math.min(minLat, loc.lat)
    maxLat = Math.max(maxLat, loc.lat)
  })

  return { minLng, maxLng, minLat, maxLat }
}

/**
 * Calculate centroid from an array of coordinates
 */
export function calculateCentroid(coordinates: number[][]): [number, number] {
  if (coordinates.length === 0) return [0, 0]
  if (coordinates.length === 1) return coordinates[0] as [number, number]

  const sum = coordinates.reduce(
    (acc, coord) => {
      acc[0] += coord[0]
      acc[1] += coord[1]
      return acc
    },
    [0, 0]
  )

  return [sum[0] / coordinates.length, sum[1] / coordinates.length]
}

/**
 * Apply spiral offset to overlapping markers
 * Groups features by approximate location and offsets them in a spiral pattern
 */
export function applySpiralOffset(features: any[], overlapThreshold: number = 0.0005) {
  const locationGroups: { [key: string]: any[] } = {}

  // Group features by approximate location
  features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates
    const gridKey = `${Math.round(lng / overlapThreshold)}_${Math.round(lat / overlapThreshold)}`

    if (!locationGroups[gridKey]) {
      locationGroups[gridKey] = []
    }
    locationGroups[gridKey].push(feature)
  })

  // Apply spiral offset to overlapping markers
  const processedFeatures: any[] = []
  Object.values(locationGroups).forEach((group: any[]) => {
    if (group.length === 1) {
      // No overlap - keep original position
      processedFeatures.push(group[0])
    } else {
      // Multiple markers at same location - apply spiral offset
      group.forEach((feature: any, index: number) => {
        const angle = (index / group.length) * 2 * Math.PI
        const radius = 0.0005 + (Math.floor(index / 8) * 0.0003) // Spiral outward
        const offsetLng = Math.cos(angle) * radius
        const offsetLat = Math.sin(angle) * radius

        const [lng, lat] = feature.geometry.coordinates
        processedFeatures.push({
          ...feature,
          geometry: {
            type: 'Point' as const,
            coordinates: [lng + offsetLng, lat + offsetLat]
          },
          properties: {
            ...feature.properties,
            _overlapping_count: group.length, // Track overlap count
            _overlap_index: index
          }
        })
      })
    }
  })

  return processedFeatures
}

/**
 * Convert MultiPoint features into individual Point features
 * This makes it easier to work with markers on the map
 */
export function flattenMultiPointFeatures(features: any[]): any[] {
  const displayFeatures: any[] = []

  features.forEach(feature => {
    if (feature.geometry.type === 'MultiPoint') {
      // Create a separate feature for each location
      const coords = feature.geometry.coordinates as number[][]
      coords.forEach((coord, index) => {
        const locationName = feature.properties.location_names?.[index] || feature.properties.location_names?.[0] || 'Unknown'
        const sceneDescription = feature.properties.scene_descriptions?.[index] || null

        displayFeatures.push({
          ...feature,
          id: `${feature.id}-loc-${index}`,
          geometry: {
            type: 'Point' as const,
            coordinates: coord
          },
          properties: {
            ...feature.properties,
            // Override location_names with just this location's name
            location_names: [locationName],
            scene_description: sceneDescription
          }
        })
      })
    } else {
      // Single location - keep as is, but extract scene_description from array if needed
      const singleFeature = {
        ...feature,
        properties: {
          ...feature.properties,
          scene_description: feature.properties.scene_descriptions?.[0] || null
        }
      }
      displayFeatures.push(singleFeature)
    }
  })

  return displayFeatures
}
