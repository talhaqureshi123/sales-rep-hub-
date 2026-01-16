// Milestone Service - Handles milestone operations via backend API

const API_BASE_URL = '/api/salesman/milestones'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all milestones for current salesman
export const getMilestones = async (salesmanId = null) => {
  try {
    const token = getAuthToken()
    if (!token) {
      // Silent return - don't log error if user is not logged in
      return []
    }

    let url = API_BASE_URL
    if (salesmanId) {
      url += `?salesman=${salesmanId}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      console.log('Authentication failed. Token may be expired. Please login again.')
      // Clear invalid token
      localStorage.removeItem('token')
      return []
    }

    if (!response.ok) {
      console.error('Failed to fetch milestones:', response.status, response.statusText)
      return []
    }

    const data = await response.json()
    if (data.success && data.data) {
      // Transform backend data to frontend format
      return data.data.map((milestone) => ({
        id: milestone._id,
        name: milestone.name,
        address: milestone.address || '',
        latitude: milestone.latitude,
        longitude: milestone.longitude,
        radius: milestone.proximityDistance ? milestone.proximityDistance * 1000 : 100, // Convert km to meters
        priority: milestone.priority || 'Medium',
        status: milestone.status ? milestone.status.toLowerCase() : 'pending',
        assignedAt: milestone.createdAt,
        completedAt: milestone.completedAt,
        description: milestone.description,
        notes: milestone.notes,
      }))
    }
    return []
  } catch (error) {
    console.error('Error fetching milestones:', error)
    return []
  }
}

// Check proximity to all milestones
export const checkProximity = (userLat, userLon, milestones) => {
  const nearbyMilestones = []
  const PROXIMITY_DISTANCE_KM = 2 // 2km proximity distance
  const proximityDistanceMeters = PROXIMITY_DISTANCE_KM * 1000

  milestones.forEach((milestone) => {
    if (milestone.status === 'pending') {
      const distance = calculateDistance(
        userLat,
        userLon,
        milestone.latitude,
        milestone.longitude
      )

      const isNearby = isWithinRadius(
        userLat,
        userLon,
        milestone.latitude,
        milestone.longitude,
        milestone.radius
      )

      const isWithinProximity = distance <= proximityDistanceMeters

      if (isNearby) {
        nearbyMilestones.push({
          ...milestone,
          distance,
          isWithinRadius: true,
        })
      } else if (isWithinProximity) {
        nearbyMilestones.push({
          ...milestone,
          distance,
          isWithinRadius: false,
          isApproaching: true,
        })
      }
    }
  })

  return nearbyMilestones.sort((a, b) => a.distance - b.distance)
}

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c * 1000 // Distance in meters
}

// Check if point is within radius
const isWithinRadius = (lat1, lon1, lat2, lon2, radiusMeters) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2)
  return distance <= radiusMeters
}

// Mark milestone as complete
export const markMilestoneComplete = async (milestoneId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${milestoneId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error marking milestone complete:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get milestone by ID
export const getMilestoneById = async (milestoneId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return null
    }

    const response = await fetch(`${API_BASE_URL}/${milestoneId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    if (data.success && data.data) {
      const milestone = data.data
      return {
        id: milestone._id,
        name: milestone.name,
        address: milestone.address || '',
        latitude: milestone.latitude,
        longitude: milestone.longitude,
        radius: milestone.proximityDistance ? milestone.proximityDistance * 1000 : 100,
        priority: milestone.priority || 'Medium',
        status: milestone.status ? milestone.status.toLowerCase() : 'pending',
        assignedAt: milestone.createdAt,
        completedAt: milestone.completedAt,
        description: milestone.description,
        notes: milestone.notes,
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching milestone:', error)
    return null
  }
}

export default {
  getMilestones,
  checkProximity,
  markMilestoneComplete,
  getMilestoneById,
}
