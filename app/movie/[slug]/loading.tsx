export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="text-7xl animate-bounce">
          🎬
        </div>
        <h2 className="text-3xl font-bold text-white">
          Loading Movie...
        </h2>
        <div className="w-64 bg-gray-700 rounded-full h-2 overflow-hidden mx-auto">
          <div className="bg-gradient-to-r from-primary-500 to-purple-600 h-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
