/**
 * HubSpot Frontend Service
 * For any frontend HubSpot operations (if needed)
 * Main integration is in backend
 */

const API_BASE_URL = '/api'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Check HubSpot connection status (if backend exposes this endpoint)
export const checkHubSpotConnection = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // This endpoint would need to be created in backend if needed
    const response = await fetch(`${API_BASE_URL}/hubspot/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error checking HubSpot connection:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  checkHubSpotConnection,
}

