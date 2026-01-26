import { useState, useEffect } from 'react'
import { 
  FaVideo, 
  FaSearch, 
  FaFilter, 
  FaPlay, 
  FaClock,
  FaTag,
  FaYoutube,
  FaLink,
  FaSpinner
} from 'react-icons/fa'
import { getProductVideos } from '../../services/salemanservices/productVideoService'
import Swal from 'sweetalert2'

const ProductVideos = () => {
  const [videos, setVideos] = useState([])
  const [filteredVideos, setFilteredVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [playingVideo, setPlayingVideo] = useState(null)

  const categories = [
    'All',
    'Pallet Wraps',
    'Tapes',
    'Till Rolls',
    'Mailing Bags',
    'Gloves',
    'Bin Bags',
    'Pizza Boxes',
    'Thermal Labels',
    'Other'
  ]

  useEffect(() => {
    loadVideos()
  }, [])

  useEffect(() => {
    filterVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, searchTerm, selectedCategory])

  const loadVideos = async () => {
    setLoading(true)
    try {
      const result = await getProductVideos()
      if (result.success && result.data) {
        // Backend already filters for active videos, but double-check
        const activeVideos = result.data.filter(video => video.isActive !== false)
        setVideos(activeVideos)
        setFilteredVideos(activeVideos)
        
        if (activeVideos.length === 0) {
          Swal.fire({
            icon: 'info',
            title: 'No Videos Available',
            text: 'No product videos are currently available. Please check back later.',
            confirmButtonColor: '#e9931c',
            timer: 3000,
            timerProgressBar: true
          })
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Videos',
          text: result.message || 'Unable to load product videos. Please try again later.',
          confirmButtonColor: '#e9931c'
        })
        setVideos([])
        setFilteredVideos([])
      }
    } catch (error) {
      console.error('Error loading videos:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while loading videos. Please try again.',
        confirmButtonColor: '#e9931c'
      })
      setVideos([])
      setFilteredVideos([])
    } finally {
      setLoading(false)
    }
  }

  const filterVideos = () => {
    let filtered = [...videos]

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(video =>
        video.title?.toLowerCase().includes(searchLower) ||
        video.description?.toLowerCase().includes(searchLower) ||
        video.category?.toLowerCase().includes(searchLower)
      )
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(video => video.category === selectedCategory)
    }

    setFilteredVideos(filtered)
  }

  // Convert YouTube/Vimeo URL to embed URL
  const getEmbedUrl = (url) => {
    if (!url) return ''
    
    // YouTube URL patterns
    let videoId = null
    
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=)([^&?\s]+)/)
    if (watchMatch) {
      videoId = watchMatch[1]
    }
    
    const embedMatch = url.match(/(?:youtube\.com\/embed\/)([^&?\s]+)/)
    if (embedMatch) {
      videoId = embedMatch[1]
    }
    
    const vMatch = url.match(/(?:youtube\.com\/v\/)([^&?\s]+)/)
    if (vMatch) {
      videoId = vMatch[1]
    }
    
    const shortMatch = url.match(/(?:youtu\.be\/)([^&?\s]+)/)
    if (shortMatch) {
      videoId = shortMatch[1]
    }
    
    if (videoId) {
      videoId = videoId.split('&')[0].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    
    // Vimeo URL patterns
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(?:.*\/)?(\d+)/)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    // Direct video URL
    if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      return url
    }
    
    // If already an embed URL
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
      return url
    }
    
    return url
  }

  const handlePlayVideo = (video) => {
    if (!video.videoUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'Video URL Missing',
        text: 'This video does not have a valid URL.',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    const embedUrl = getEmbedUrl(video.videoUrl)
    if (!embedUrl || embedUrl === video.videoUrl) {
      // Check if it's a valid URL
      try {
        new URL(video.videoUrl)
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'Invalid Video URL',
          text: 'This video has an invalid URL format.',
          confirmButtonColor: '#e9931c'
        })
        return
      }
    }

    setPlayingVideo(video)
    setShowVideoPlayer(true)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-[#e9931c] bg-opacity-10 rounded-lg">
            <FaVideo className="w-8 h-8 text-[#e9931c]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Videos</h1>
            <p className="text-gray-600">Watch product demonstration videos</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Category Filters */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search videos by title..."
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
      </div>

      {/* Video Count */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <FaVideo className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Videos Grid or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <FaSpinner className="w-12 h-12 text-[#e9931c] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading videos...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <div className="p-6 bg-gray-50 rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center">
            <FaVideo className="w-16 h-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No videos found</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {searchTerm || selectedCategory !== 'All' 
              ? 'Try adjusting your filters to see more videos.'
              : 'No product videos available at the moment.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video) => (
            <div
              key={video._id || video.id}
              className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-xl hover:border-[#e9931c] transition-all duration-300 group"
            >
              {/* Video Thumbnail */}
              <div 
                className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer overflow-hidden"
                onClick={() => handlePlayVideo(video)}
              >
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextElementSibling.style.display = 'flex'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <FaVideo className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No Thumbnail</p>
                    </div>
                  </div>
                )}
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <div className="bg-white bg-opacity-90 rounded-full p-4 transform scale-0 group-hover:scale-100 transition-transform">
                    <FaPlay className="w-8 h-8 text-[#e9931c]" />
                  </div>
                </div>

                {/* Video Type Badge */}
                {video.videoUrl && (
                  <div className="absolute top-2 left-2">
                    {video.videoUrl.includes('youtube.com') || video.videoUrl.includes('youtu.be') ? (
                      <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full flex items-center gap-1">
                        <FaYoutube className="w-3 h-3" />
                        YouTube
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full flex items-center gap-1">
                        <FaLink className="w-3 h-3" />
                        Direct
                      </span>
                    )}
                  </div>
                )}

                {/* Duration Badge */}
                {video.duration && (
                  <div className="absolute bottom-2 right-2">
                    <span className="px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded-full flex items-center gap-1">
                      <FaClock className="w-3 h-3" />
                      {video.duration}
                    </span>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-[#e9931c] transition-colors">
                  {video.title}
                </h3>
                
                {/* Category Badge */}
                {video.category && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#e9931c] bg-opacity-10 text-[#e9931c] text-xs font-semibold rounded-full">
                      <FaTag className="w-3 h-3" />
                      {video.category}
                    </span>
                  </div>
                )}

                {/* Description */}
                {video.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{video.description}</p>
                )}

                {/* Play Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlayVideo(video)
                  }}
                  className="w-full px-3 py-2 bg-[#e9931c] text-white rounded-lg text-sm font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                >
                  <FaPlay className="w-3 h-3" />
                  <span>Play Video</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && playingVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{playingVideo.title}</h3>
                {playingVideo.category && (
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded mt-1">
                    {playingVideo.category}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowVideoPlayer(false)
                  setPlayingVideo(null)
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
                aria-label="Close video player"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              {(() => {
                const embedUrl = getEmbedUrl(playingVideo.videoUrl)
                const isDirectVideo = playingVideo.videoUrl?.match(/\.(mp4|webm|ogg)(\?.*)?$/i)
                
                if (isDirectVideo) {
                  return (
                    <video
                      controls
                      className="w-full h-full"
                      src={playingVideo.videoUrl}
                      onError={(e) => {
                        console.error('Video load error:', e)
                        Swal.fire({
                          icon: 'error',
                          title: 'Video Load Error',
                          text: 'Unable to load this video. Please check the video URL or try again later.',
                          confirmButtonColor: '#e9931c'
                        })
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )
                } else {
                  return (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={playingVideo.title}
                      onLoad={() => {
                        // Iframe loaded successfully
                        console.log('Video iframe loaded')
                      }}
                    />
                  )
                }
              })()}
            </div>
            
            {/* Video Description */}
            {playingVideo.description && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                <p className="text-sm text-gray-600">{playingVideo.description}</p>
              </div>
            )}
            
            {/* Video Info */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {playingVideo.duration && (
                <span>Duration: {playingVideo.duration}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductVideos
