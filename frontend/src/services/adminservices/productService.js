// Admin Product Service - Handles product management via backend API

const API_BASE_URL = '/api/admin/products'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all products
export const getProducts = async () => {
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
    console.error('Error fetching products:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Create product
export const createProduct = async (productData) => {
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
      body: JSON.stringify(productData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating product:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update product
export const updateProduct = async (productId, productData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(productData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating product:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete product
export const deleteProduct = async (productId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${productId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting product:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Generate QR Code URL
export const generateQRCodeURL = (productCode) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${productCode}`
}

export default {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  generateQRCodeURL,
}

