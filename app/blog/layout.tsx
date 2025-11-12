'use client'

import { useState, Suspense, lazy } from 'react'

const Navigation = lazy(() => import('../../components/Navigation'))
const PartnershipModal = lazy(() => import('../../components/PartnershipModal'))

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isPartnershipModalOpen, setIsPartnershipModalOpen] = useState(false)

  return (
    <>
      {/* Global Navigation */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 sm:w-auto">
        <Suspense fallback={
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        }>
          <Navigation onPartnershipClick={() => setIsPartnershipModalOpen(true)} />
        </Suspense>
      </div>

      {children}

      {/* Partnership Modal */}
      <Suspense fallback={null}>
        <PartnershipModal
          isOpen={isPartnershipModalOpen}
          onClose={() => setIsPartnershipModalOpen(false)}
        />
      </Suspense>
    </>
  )
}
