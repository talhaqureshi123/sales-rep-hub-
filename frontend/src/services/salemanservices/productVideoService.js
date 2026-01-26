// Salesman Product Video Service - Read-only access to product videos

const API_BASE_URL = '/api/salesman/product-videos'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all active product videos for salesman
export const getProductVideos = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.category && filters.category !== 'All') {
      queryParams.append('category', filters.category)
    }
    if (filters.search) {
      queryParams.append('search', filters.search)
    }

    const url = queryParams.toString() 
      ? `${API_BASE_URL}?${queryParams.toString()}`
      : API_BASE_URL

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching product videos:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single product video
export const getProductVideo = async (videoId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${videoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching product video:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getProductVideos,
  getProductVideo,
}
