import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'CineMap - Movie Filming Locations',
        short_name: 'CineMap',
        description: 'Explore filming locations of your favorite movies on an interactive 3D globe',
        theme_color: '#10be50',
        background_color: '#1F2937',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Cache all static assets including GeoJSON and WebP posters
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,geojson,webp}'],
        // Increase max file size to cache GeoJSON and all posters (default is 2MB)
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB for all assets + posters
        // Runtime caching for GeoJSON and images
        runtimeCaching: [
          {
            // Cache local GeoJSON files (no https prefix for local files)
            urlPattern: /\/geo\/.*\.geojson$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geojson-cache-v2',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache local poster images (WebP format)
            urlPattern: /\/images\/posters\/.*\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-posters-v1',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Legacy TMDb images (fallback for any remaining external posters)
            urlPattern: /^https:\/\/image\.tmdb\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.maptiler\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles-v1',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: 'localhost',
    strictPort: true,
    open: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
    },
    headers: {
      // Enable browser caching for images in dev mode
      'Cache-Control': 'public, max-age=31536000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize chunk size for faster loading
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Extract MapLibre GL into its own chunk (heavy library ~400KB)
          'maplibre-gl': ['maplibre-gl'],
          // Extract React and related libs into vendor chunk
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})
