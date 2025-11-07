/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable font optimization to prevent Google Fonts loading
  optimizeFonts: false,

  images: {
    domains: ['image.tmdb.org'],
    formats: ['image/webp', 'image/avif'],
    unoptimized: false, // Enable Next.js image optimization
  },

  // Optimize for 10k+ movies - enable static export
  // output: 'export', // Uncomment for static hosting

  // Optimize CSS (disabled - requires critters package)
  // experimental: {
  //   optimizeCss: true,
  // },

  // Performance optimizations for large datasets
  compress: true,
  poweredByHeader: false,

  // Static page generation
  generateBuildId: async () => {
    // Use git commit hash or timestamp
    return `build-${Date.now()}`
  },

  // Webpack optimizations for 10k+ pages
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize client bundle
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Separate vendor chunks for better caching
            maplibre: {
              test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/,
              name: 'maplibre',
              priority: 10,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 5,
            },
          },
        },
      }
    }
    return config
  },

  // Handle static assets
  async rewrites() {
    return []
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/geo/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
