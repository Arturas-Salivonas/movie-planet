/**
 * Progressive Loading Utility for Map Markers
 * Optimizes rendering by batching and deferring off-screen markers
 */

export interface ProgressiveLoaderOptions {
  batchSize?: number
  delayBetweenBatches?: number
}

/**
 * Load items in batches with delays to avoid blocking the main thread
 */
export async function loadInBatches<T>(
  items: T[],
  callback: (batch: T[], startIndex: number) => void,
  options: ProgressiveLoaderOptions = {}
): Promise<void> {
  const { batchSize = 50, delayBetweenBatches = 16 } = options

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    callback(batch, i)
    
    // Yield to browser to keep UI responsive
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }
}

/**
 * Check if a coordinate is within viewport bounds with buffer
 */
export function isInViewport(
  lng: number,
  lat: number,
  bounds: { north: number; south: number; east: number; west: number },
  bufferPercent: number = 0.2
): boolean {
  const lngBuffer = Math.abs(bounds.east - bounds.west) * bufferPercent
  const latBuffer = Math.abs(bounds.north - bounds.south) * bufferPercent

  return (
    lng >= bounds.west - lngBuffer &&
    lng <= bounds.east + lngBuffer &&
    lat >= bounds.south - latBuffer &&
    lat <= bounds.north + latBuffer
  )
}

/**
 * Priority-based loading: load visible items first, then off-screen
 */
export function prioritizeByViewport<T>(
  items: T[],
  getCoordinates: (item: T) => { lng: number; lat: number },
  viewport: { north: number; south: number; east: number; west: number }
): { visible: T[]; hidden: T[] } {
  const visible: T[] = []
  const hidden: T[] = []

  items.forEach(item => {
    const { lng, lat } = getCoordinates(item)
    if (isInViewport(lng, lat, viewport)) {
      visible.push(item)
    } else {
      hidden.push(item)
    }
  })

  return { visible, hidden }
}
