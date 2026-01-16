const API_BASE_URL = '/api/admin/locations'

const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get latest location for all salesmen (live tracking)
export const getLatestSalesmenLocations = async (options = {}) => {
  try {
    const token = getAuthToken()

    const params = new URLSearchParams()
    if (options.activeWithinMinutes) {
      params.append('activeWithinMinutes', String(options.activeWithinMinutes))
    }

    const url = params.toString()
      ? `${API_BASE_URL}/latest?${params.toString()}`
      : `${API_BASE_URL}/latest`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get latest salesman locations')
    }

    return data
  } catch (error) {
    console.error('Error getting latest salesman locations:', error)
    throw error
  }
}

export default {
  getLatestSalesmenLocations,
}

