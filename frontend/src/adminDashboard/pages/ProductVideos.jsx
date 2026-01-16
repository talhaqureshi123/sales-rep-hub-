import { useState, useEffect } from 'react'
import { 
  FaVideo, 
  FaSearch, 
  FaFilter, 
  FaPlay, 
  FaUpload, 
  FaTrash, 
  FaEdit, 
  FaClock,
  FaTag,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
  FaYoutube,
  FaLink
} from 'react-icons/fa'
import { getProductVideos, createProductVideo, updateProductVideo, deleteProductVideo } from '../../services/adminservices/productVideoService'

const ProductVideos = () => {
  const [videos, setVideos] = useState([])
  const [filteredVideos, setFilteredVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState(null)
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

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    videoUrl: '',
    thumbnailUrl: '',
    duration: '',
    isActive: true,
  })
  const [editingVideo, setEditingVideo] = useState(null)

  useEffect(() => {
    loadVideos()
  }, [])

  useEffect(() => {
    if (videos.length > 0 || searchTerm || selectedCategory !== 'All') {
      filterVideos()
    } else {
      setFilteredVideos(videos)
    }
  }, [videos, searchTerm, selectedCategory])

  const loadVideos = async () => {
    setLoading(true)
    try {
      const result = await getProductVideos()
      if (result.success && result.data) {
        setVideos(result.data)
        // Initialize filtered videos
        setFilteredVideos(result.data)
      } else {
        console.error('Failed to load videos:', result.message)
        setVideos([])
        setFilteredVideos([])
      }
    } catch (error) {
      console.error('Error loading videos:', error)
      setVideos([])
      setFilteredVideos([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  const handleUploadVideo = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const videoData = {
        title: formData.title,
        category: formData.category,
        videoUrl: formData.videoUrl,
        thumbnailUrl: formData.thumbnailUrl || '',
        description: formData.description || '',
        duration: formData.duration || '',
        isActive: formData.isActive,
      }

      let result
      if (editingVideo) {
        result = await updateProductVideo(editingVideo._id || editingVideo.id, videoData)
      } else {
        result = await createProductVideo(videoData)
      }

      if (result.success) {
        alert(editingVideo ? 'Video updated successfully!' : 'Video uploaded successfully!')
        setShowUploadModal(false)
        resetForm()
        loadVideos()
      } else {
        alert(result.message || 'Failed to save video')
      }
    } catch (error) {
      console.error('Error saving video:', error)
      alert('Error saving video')
    } finally {
      setLoading(false)
    }
  }

  const handleEditVideo = (video) => {
    setEditingVideo(video)
    setFormData({
      title: video.title || '',
      category: video.category || '',
      videoUrl: video.videoUrl || '',
      thumbnailUrl: video.thumbnailUrl || '',
      description: video.description || '',
      duration: video.duration || '',
      isActive: video.isActive !== undefined ? video.isActive : true,
    })
    setShowUploadModal(true)
  }

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteProductVideo(videoId)
      if (result.success) {
        alert('Video deleted successfully!')
        loadVideos()
      } else {
        alert(result.message || 'Failed to delete video')
      }
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Error deleting video')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      videoUrl: '',
      thumbnailUrl: '',
      duration: '',
      isActive: true,
    })
    setEditingVideo(null)
    setSelectedVideo(null)
  }

  const filterVideos = () => {
    let filtered = [...videos]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(video =>
        video.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.category?.toLowerCase().includes(searchTerm.toLowerCase())
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
    
    // YouTube URL patterns - handles multiple formats
    // youtube.com/watch?v=VIDEO_ID
    // youtube.com/embed/VIDEO_ID
    // youtube.com/v/VIDEO_ID
    // youtu.be/VIDEO_ID
    // youtube.com/watch?v=VIDEO_ID&other=params
    let videoId = null
    
    // Pattern 1: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=)([^&?\s]+)/)
    if (watchMatch) {
      videoId = watchMatch[1]
    }
    
    // Pattern 2: youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/(?:youtube\.com\/embed\/)([^&?\s]+)/)
    if (embedMatch) {
      videoId = embedMatch[1]
    }
    
    // Pattern 3: youtube.com/v/VIDEO_ID
    const vMatch = url.match(/(?:youtube\.com\/v\/)([^&?\s]+)/)
    if (vMatch) {
      videoId = vMatch[1]
    }
    
    // Pattern 4: youtu.be/VIDEO_ID
    const shortMatch = url.match(/(?:youtu\.be\/)([^&?\s]+)/)
    if (shortMatch) {
      videoId = shortMatch[1]
    }
    
    if (videoId) {
      // Clean video ID (remove any extra parameters)
      videoId = videoId.split('&')[0].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    
    // Vimeo URL patterns
    // vimeo.com/VIDEO_ID
    // vimeo.com/channels/CHANNEL/VIDEO_ID
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(?:.*\/)?(\d+)/)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    // Direct video URL (mp4, webm, ogg)
    if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      return url
    }
    
    // If already an embed URL, return as is
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
      return url
    }
    
    return url
  }

  const handlePlayVideo = (video) => {
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
            <p className="text-gray-600">Manage product demonstration videos</p>
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

      {/* Action Button and Video Count */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <FaVideo className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
            </span>
          </div>
          {filteredVideos.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FaCheckCircle className="w-4 h-4 text-green-500" />
              <span>{filteredVideos.filter(v => v.isActive).length} Active</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-lg hover:shadow-xl"
        >
          <FaUpload className="w-5 h-5" />
          <span>Upload Video</span>
        </button>
      </div>

      {/* Videos Grid or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
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
              : 'Start by uploading your first product demonstration video.'}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-8 py-4 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-lg hover:shadow-xl mx-auto"
          >
            <FaUpload className="w-5 h-5" />
            <span>Upload Your First Video</span>
          </button>
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

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {video.isActive ? (
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                      <FaEye className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full flex items-center gap-1">
                      <FaEyeSlash className="w-3 h-3" />
                      Inactive
                    </span>
                  )}
                </div>

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

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePlayVideo(video)
                    }}
                    className="flex-1 px-3 py-2 bg-[#e9931c] text-white rounded-lg text-sm font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                  >
                    <FaPlay className="w-3 h-3" />
                    <span>Play</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditVideo(video)
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                    title="Edit Video"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteVideo(video._id || video.id)
                    }}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                    title="Delete Video"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Video Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Upload Video</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUploadVideo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="e.g., Pallet Wrap Application Guide"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  <option value="">Select category...</option>
                  {categories.filter(c => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  name="videoUrl"
                  value={formData.videoUrl}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="YouTube, Vimeo, or direct video URL"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports YouTube, Vimeo, and direct video links (.mp4, .webm, .ogg)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thumbnail URL (Optional)
                </label>
                <input
                  type="url"
                  name="thumbnailUrl"
                  value={formData.thumbnailUrl}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="https://example.com/thumbnail.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Describe what this video demonstrates..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (MM:SS)</label>
                <input
                  type="text"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="e.g., 2:30"
                  pattern="[0-9]+:[0-5][0-9]"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
                  />
                  <span className="text-sm text-gray-700">Active (visible to sales reps)</span>
                </label>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    resetForm()
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
                >
                  {editingVideo ? 'Update Video' : 'Upload Video'}
                </button>
              </div>
            </form>
          </div>
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
                className="text-gray-500 hover:text-gray-700 transition-colors"
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
                  // Direct video file
                  return (
                    <video
                      controls
                      className="w-full h-full"
                      src={playingVideo.videoUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )
                } else {
                  // YouTube or Vimeo embed
                  return (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={playingVideo.title}
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
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                playingVideo.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {playingVideo.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductVideos
