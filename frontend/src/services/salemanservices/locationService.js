// Location Service - Handles geolocation tracking and distance calculations

// Proximity distance in kilometers (configurable)
export const PROXIMITY_DISTANCE_KM = 2 // Default: 2 kilometers

// Get current user location
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true, // Use GPS on mobile
        timeout: 15000, // Increased timeout for mobile
        maximumAge: 0, // Always get fresh location
      }
    )
  })
}

// Watch user position (for real-time tracking)
export const watchPosition = (callback, errorCallback) => {
  if (!navigator.geolocation) {
    if (errorCallback) {
      errorCallback(new Error('Geolocation is not supported'))
    }
    return null
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      })
    },
    (error) => {
      if (errorCallback) {
        errorCallback(error)
      }
    },
    {
      enableHighAccuracy: true, // Use GPS on mobile
      timeout: 15000, // Increased timeout for mobile
      maximumAge: 0, // Always get fresh location
    }
  )

  return watchId
}

// Stop watching position
export const clearWatch = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
}

// Calculate distance between two coordinates (Haversine formula)
// Returns distance in meters
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000 // Earth's radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // Distance in meters
  
  return distance
}

// Convert degrees to radians
const toRad = (degrees) => {
  return (degrees * Math.PI) / 180
}

// Check if user is within radius of a location
export const isWithinRadius = (userLat, userLon, targetLat, targetLon, radius) => {
  const distance = calculateDistance(userLat, userLon, targetLat, targetLon)
  return distance <= radius
}

// Format distance for display
export const formatDistance = (distanceInMeters) => {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`
  } else {
    return `${(distanceInMeters / 1000).toFixed(2)}km`
  }
}

// Save location to backend (for live tracking)
const API_BASE_URL = '/api/salesman/location'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Save current location to backend
export const saveLocation = async (latitude, longitude, accuracy = null) => {
  try {
    const token = getAuthToken()
    if (!token) {
      // Not logged in, don't send location
      return { success: false, message: 'Not authenticated' }
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error saving location:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getCurrentLocation,
  watchPosition,
  clearWatch,
  calculateDistance,
  isWithinRadius,
  formatDistance,
  saveLocation,
}

