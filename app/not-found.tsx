import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-2xl">
        <div className="text-9xl">
          🎬
        </div>
        <h1 className="text-6xl font-bold text-white">
          404
        </h1>
        <h2 className="text-3xl font-semibold text-white">
          Movie Not Found
        </h2>
        <p className="text-xl text-gray-300">
          Sorry, we couldn't find the movie you're looking for.
          It might have been removed or the link might be incorrect.
        </p>
        <div className="flex gap-4 justify-center pt-6">
          <Link
            href="/"
            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white rounded-lg font-bold text-lg transition-all shadow-xl"
          >
            ← Back to Map
          </Link>
        </div>
      </div>
    </div>
  )
}
