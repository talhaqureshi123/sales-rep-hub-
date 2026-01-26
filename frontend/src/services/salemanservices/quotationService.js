// Quotation Service - Handles quotation operations via backend API

const API_BASE_URL = '/api/salesman/quotations'

// Get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token')
}

// Get all quotations for current salesman
export const getQuotations = async () => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, data: [], message: 'Authentication token not found.' }
    }

    const response = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, data: [], message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    if (data.success && data.data) {
      // Transform backend data to frontend format
      return {
        success: true,
        data: data.data.map((quote) => ({
          id: quote._id,
          quoteNumber: quote.quotationNumber,
          customerName: quote.customerName,
          customerEmail: quote.customerEmail,
          validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '',
          status: quote.status,
          total: quote.total,
          subtotal: quote.subtotal,
          tax: quote.tax,
          discount: quote.discount,
          notes: quote.notes,
          createdAt: quote.createdAt ? new Date(quote.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          items: quote.items || [],
          salesman: quote.salesman, // Include salesman info for permission checks
        })),
      }
    }
    return { success: false, data: [], message: data.message || 'Failed to fetch quotations' }
  } catch (error) {
    console.error('Error fetching quotations:', error)
    return { success: false, data: [], message: 'Network error or server is down.' }
  }
}

// Create quotation
export const createQuotation = async (quotationData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    // Transform frontend data to backend format
    // Filter items that have a valid product (productId or product) and quantity > 0
    const items = quotationData.lineItems
      .filter(item => {
        const hasProduct = !!(item.productId || item.product)
        const hasValidQuantity = parseFloat(item.quantity) > 0
        return hasProduct && hasValidQuantity
      })
      .map(item => {
        // Ensure we have a valid productId (prefer productId over product)
        const productId = item.productId || item.product
        if (!productId) {
          console.warn('Item missing productId:', item)
          return null // Skip items without product
        }
        
        const quantity = parseFloat(item.quantity)
        if (!quantity || quantity <= 0) {
          console.warn('Item has invalid quantity:', item)
          return null
        }
        
        return {
          productId: productId, // Backend expects productId as MongoDB ObjectId
          quantity: quantity,
          price: parseFloat(item.unitPrice) || 0,
        }
      })
      .filter(item => item !== null) // Remove any null items

    // Debug logging
    console.log('Quotation lineItems:', quotationData.lineItems)
    console.log('Filtered items for backend:', items)
    
    if (items.length === 0) {
      console.error('No valid items found after filtering. Original lineItems:', quotationData.lineItems)
      return {
        success: false,
        message: 'Please add at least one item with a valid product and quantity',
      }
    }

    const backendData = {
      customerName: quotationData.customerName,
      customerEmail: quotationData.customerEmail,
      customerPhone: quotationData.customerPhone || '',
      customerAddress: quotationData.customerAddress || '',
      items: items,
      tax: quotationData.tax || 0,
      discount: quotationData.discount || 0,
      notes: quotationData.notes || '',
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(backendData),
    })

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error creating quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Update quotation
export const updateQuotation = async (quotationId, quotationData) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(quotationData),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Get single quotation
export const getQuotation = async (quotationId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    if (data.success && data.data) {
      return {
        success: true,
        data: {
          id: data.data._id,
          quoteNumber: data.data.quotationNumber,
          customerName: data.data.customerName,
          customerEmail: data.data.customerEmail,
          customerPhone: data.data.customerPhone,
          customerAddress: data.data.customerAddress,
          validUntil: data.data.validUntil ? new Date(data.data.validUntil).toISOString().split('T')[0] : '',
          status: data.data.status,
          total: data.data.total,
          subtotal: data.data.subtotal,
          tax: data.data.tax,
          discount: data.data.discount,
          notes: data.data.notes,
          createdAt: data.data.createdAt ? new Date(data.data.createdAt).toISOString().split('T')[0] : '',
          items: data.data.items || [],
          salesman: data.data.salesman,
        },
      }
    }
    return { success: false, message: data.message || 'Failed to fetch quotation' }
  } catch (error) {
    console.error('Error fetching quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

// Delete quotation
export const deleteQuotation = async (quotationId) => {
  try {
    const token = getAuthToken()
    if (!token) {
      return { success: false, message: 'Authentication token not found.' }
    }

    const response = await fetch(`${API_BASE_URL}/${quotationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    // Handle 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      window.location.href = '/'
      return { success: false, message: 'Session expired. Please login again.' }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return { success: false, message: 'Network error or server is down.' }
  }
}

export default {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
}

