// Admin Tasks List – single fast API for Tasks page (follow-ups + visit targets, limited)

const API_BASE_URL = '/api/admin/tasks-list'

const getAuthToken = () => localStorage.getItem('token')

/**
 * Get tasks list (follow-ups + visit targets) in one request. Backend returns max 200 of each for fast load.
 * @param {Object} opts - { limit: number } optional
 */
export const getTasksList = async (opts = {}) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }
    const params = new URLSearchParams()
    if (opts.limit != null) params.append('limit', opts.limit)
    const url = params.toString() ? `${API_BASE_URL}?${params.toString()}` : API_BASE_URL

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      localStorage.clear()
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching tasks list:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}
