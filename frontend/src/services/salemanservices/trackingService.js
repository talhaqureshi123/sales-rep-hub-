// Tracking Service - Handles tracking API calls

const API_BASE_URL = '/api/salesman/tracking'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token') || ''
}

// Start tracking session
export const startTracking = async (startingKilometers, speedometerImage, latitude, longitude, visitedAreaImage = null) => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        startingKilometers: parseFloat(startingKilometers),
        speedometerImage,
        visitedAreaImage: visitedAreaImage || null,
        latitude: latitude || null,
        longitude: longitude || null,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to start tracking')
    }

    return data
  } catch (error) {
    console.error('Error starting tracking:', error)
    throw error
  }
}

// Stop tracking session
export const stopTracking = async (
  trackingId,
  endingKilometers,
  endingMeterImage = null,
  visitedAreaImage = null,
  latitude = null,
  longitude = null
) => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}/stop/${trackingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        endingKilometers: endingKilometers ? parseFloat(endingKilometers) : null,
        endingMeterImage: endingMeterImage || null,
        visitedAreaImage: visitedAreaImage || null,
        latitude: latitude || null,
        longitude: longitude || null,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to stop tracking')
    }

    return data
  } catch (error) {
    console.error('Error stopping tracking:', error)
    throw error
  }
}

// Get active tracking session
export const getActiveTracking = async () => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 404) {
        return null // No active tracking
      }
      throw new Error(data.message || 'Failed to get active tracking')
    }

    return data.data
  } catch (error) {
    console.error('Error getting active tracking:', error)
    return null
  }
}

// Get all tracking sessions
export const getAllTracking = async () => {
  try {
    const token = getAuthToken()
    
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get tracking sessions')
    }

    return data.data
  } catch (error) {
    console.error('Error getting tracking sessions:', error)
    throw error
  }
}

export default {
  startTracking,
  stopTracking,
  getActiveTracking,
  getAllTracking,
}

