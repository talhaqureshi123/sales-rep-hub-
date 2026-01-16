// Admin Product Video Service - Handles product video management via backend API

const API_BASE_URL = '/api/admin/product-videos'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all product videos
export const getProductVideos = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(API_BASE_URL, {
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

// Create product video
export const createProductVideo = async (videoData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(videoData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating product video:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update product video
export const updateProductVideo = async (videoId, videoData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${videoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(videoData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating product video:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete product video
export const deleteProductVideo = async (videoId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting product video:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getProductVideos,
  createProductVideo,
  updateProductVideo,
  deleteProductVideo,
}
