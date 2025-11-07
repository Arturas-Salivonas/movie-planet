import { generateWebsiteSchema } from '../lib/metadata'
import MapClient from '../components/MapClient'

/**
 * Homepage - Interactive map with all movies
 * Server component with SSR metadata + client-side map
 */
export default function HomePage() {
  const schema = generateWebsiteSchema()

  return (
    <div className="w-full h-full overflow-hidden">
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Client component with map */}
      <MapClient />
    </div>
  )
}
