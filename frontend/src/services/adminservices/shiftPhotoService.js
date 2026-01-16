const API_BASE_URL = '/api/admin/shift-photos'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all shift photos
export const getShiftPhotos = async (filters = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const queryParams = new URLSearchParams()
    if (filters.salesman) queryParams.append('salesman', filters.salesman)
    if (filters.photoType) queryParams.append('photoType', filters.photoType)
    if (filters.date) queryParams.append('date', filters.date)
    if (filters.search) queryParams.append('search', filters.search)

    const url = queryParams.toString() ? `${API_BASE_URL}?${queryParams.toString()}` : API_BASE_URL

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
    console.error('Error fetching shift photos:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single shift photo
export const getShiftPhoto = async (photoId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${photoId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching shift photo:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete shift photo
export const deleteShiftPhoto = async (photoId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${photoId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting shift photo:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
