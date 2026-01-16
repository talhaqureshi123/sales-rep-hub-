const API_BASE_URL = '/api';

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

/**
 * Get achievement stats for logged-in salesman
 * @returns {Promise<Object>} Achievement stats including GRPA
 */
export const getAchievementStats = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: 'Authentication token not found. Please login.',
      };
    }

    const response = await fetch(`${API_BASE_URL}/salesman/achievements`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to fetch achievement stats',
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    return {
      success: false,
      message: 'Network error or server is down.',
    };
  }
};

export default {
  getAchievementStats,
};

