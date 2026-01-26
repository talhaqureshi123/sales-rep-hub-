import { useState, useEffect } from 'react'
import ProductSelector from '../../universalcomponents/ProductSelector'
import QRCameraScanner from '../../components/QRCameraScanner'
import { getScannedProducts } from '../../services/salemanservices/productService'
import { getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation } from '../../services/salemanservices/quotationService'
import { getMyCustomers } from '../../services/salemanservices/customerService'
import { FaQrcode, FaEye, FaEdit, FaTrash } from 'react-icons/fa'

const Quotation = () => {
  const [quotations, setQuotations] = useState([])
  const [editingQuotation, setEditingQuotation] = useState(null)
  const [viewingQuotation, setViewingQuotation] = useState(null)
  const [showViewModal, setShowViewModal] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [showQRCamera, setShowQRCamera] = useState(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [formData, setFormData] = useState({
    customer: '',
    customerName: '',
    customerAddress: '',
    validUntil: '',
    lineItems: [
      {
        id: 1,
        product: '',
        productId: '',
        productName: '',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        lineTotal: 0,
      },
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
  })

  // Listen for open quotation modal events
  useEffect(() => {
    const handleOpenQuotationModal = (event) => {
      if (event.detail && event.detail.visitTarget) {
        const visitTarget = event.detail.visitTarget
        // Set visit target data
        localStorage.setItem('quotationVisitTarget', JSON.stringify({
          id: visitTarget._id || visitTarget.id,
          name: visitTarget.name,
          address: visitTarget.address,
          city: visitTarget.city,
          state: visitTarget.state,
          pincode: visitTarget.pincode,
        }))
        localStorage.setItem('openQuotationModal', 'true')
        // Open modal
        setShowCreateModal(true)
      }
    }

    window.addEventListener('openQuotationModal', handleOpenQuotationModal)
    return () => window.removeEventListener('openQuotationModal', handleOpenQuotationModal)
  }, [])

  // Check for visit target or milestone data on component mount
  useEffect(() => {
    // Check for visit target data (priority)
    const visitTargetData = localStorage.getItem('quotationVisitTarget')
    const shouldOpenModal = localStorage.getItem('openQuotationModal') === 'true'
    
    if (visitTargetData && shouldOpenModal) {
      try {
        const visitTarget = JSON.parse(visitTargetData)
        // Auto-open create modal and pre-fill customer data
        setShowCreateModal(true)
        
        // Find customer by name or create new entry
        setCustomers(prev => {
          const existingCustomer = prev.find(c => 
            c.name.toLowerCase() === visitTarget.name?.toLowerCase()
          )
          
          if (existingCustomer) {
            setFormData(prevForm => ({
              ...prevForm,
              customer: (existingCustomer.id || existingCustomer._id).toString(),
              customerName: visitTarget.name,
              customerAddress: `${visitTarget.address || ''}, ${visitTarget.city || ''}, ${visitTarget.state || ''} ${visitTarget.pincode || ''}`.trim(),
            }))
            return prev
          } else {
            // Add visit target as new customer option (only if not already in list)
            const maxId = prev.length > 0 ? Math.max(...prev.map(c => c.id || 0)) : 0
            const newCustomerId = maxId + 1
            const newCustomer = {
              id: newCustomerId,
              name: visitTarget.name,
              email: '',
            }
            setFormData(prevForm => ({
              ...prevForm,
              customer: newCustomerId.toString(),
              customerName: visitTarget.name,
              customerAddress: `${visitTarget.address || ''}, ${visitTarget.city || ''}, ${visitTarget.state || ''} ${visitTarget.pincode || ''}`.trim(),
            }))
            return [...prev, newCustomer]
          }
        })
        
        // Clear visit target data after using it
        localStorage.removeItem('quotationVisitTarget')
        localStorage.removeItem('openQuotationModal')
      } catch (error) {
        console.error('Error parsing visit target data:', error)
        localStorage.removeItem('quotationVisitTarget')
        localStorage.removeItem('openQuotationModal')
      }
    }
    
    // Check for milestone data (backward compatibility)
    const milestoneData = localStorage.getItem('quotationMilestone')
    if (milestoneData && !visitTargetData) {
      try {
        const milestone = JSON.parse(milestoneData)
        // Auto-open create modal and pre-fill customer data
        setShowCreateModal(true)
        
        // Find customer by name or create new entry
        setCustomers(prev => {
          const existingCustomer = prev.find(c => 
            c.name.toLowerCase() === milestone.customerName?.toLowerCase()
          )
          
          if (existingCustomer) {
            setFormData(prevForm => ({
              ...prevForm,
              customer: (existingCustomer.id || existingCustomer._id).toString(),
              customerName: milestone.customerName,
              customerAddress: milestone.customerAddress,
            }))
            return prev
          } else {
            // Add milestone as new customer option (only if not already in list)
            const maxId = prev.length > 0 ? Math.max(...prev.map(c => c.id || 0)) : 0
            const newCustomerId = maxId + 1
            const newCustomer = {
              id: newCustomerId,
              name: milestone.customerName || milestone.milestoneName,
              email: '',
            }
            setFormData(prevForm => ({
              ...prevForm,
              customer: newCustomerId.toString(),
              customerName: milestone.customerName || milestone.milestoneName,
              customerAddress: milestone.customerAddress || milestone.milestoneAddress,
            }))
            return [...prev, newCustomer]
          }
        })
        
        // Clear milestone data after using it
        localStorage.removeItem('quotationMilestone')
      } catch (error) {
        console.error('Error parsing milestone data:', error)
      }
    }
  }, [])

  const [customers, setCustomers] = useState([])

  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)

  // Load products, quotations, and customers from backend on mount
  useEffect(() => {
    loadProducts()
    loadQuotations()
    loadCustomers()
  }, [])

  // Load customers from backend (assigned to this salesman)
  const loadCustomers = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        console.warn('No authentication token found. Please login.')
        setCustomers([])
        return
      }

      const result = await getMyCustomers()
      if (result.success && result.data) {
        // Transform backend customer data to frontend format
        const transformedCustomers = result.data.map((customer, index) => ({
          id: index + 1, // Frontend ID for compatibility
          _id: customer._id, // Backend ID
          name: customer.firstName || customer.name || 'Customer',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
        }))
        setCustomers(transformedCustomers)
      } else {
        console.error('Failed to load customers:', result.message)
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    }
  }

  // Load quotations from backend
  const loadQuotations = async () => {
    try {
      // Check if token exists
      const token = localStorage.getItem('token')
      if (!token) {
        console.warn('No authentication token found. Please login.')
        setQuotations([])
        return
      }

      const result = await getQuotations()
      if (result.success && result.data) {
        setQuotations(result.data)
      } else {
        console.error('Failed to load quotations:', result.message)
        if (result.message && result.message.includes('Session expired')) {
          // Will be redirected by service
          return
        }
        setQuotations([])
      }
    } catch (error) {
      console.error('Error loading quotations:', error)
      setQuotations([])
    }
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      // Check if token exists
      const token = localStorage.getItem('token')
      if (!token) {
        console.warn('No authentication token found. Please login.')
        setProducts([])
        setProductsLoading(false)
        return
      }

      const { getProducts } = await import('../../services/salemanservices/productService')
      const result = await getProducts()
      if (result.success && result.data) {
        // Filter out inactive products - only show active products
        // Transform backend data to frontend format
        const transformedProducts = result.data
          .filter(p => p.isActive !== false) // Only include active products (default to true if not specified)
          .map(p => ({
            id: p._id,
            _id: p._id, // Add _id for compatibility
            name: p.name,
            code: p.productCode,
            price: p.price,
            productCode: p.productCode,
            category: p.category,
            qrCode: p.qrCode,
            isActive: p.isActive !== false, // Store isActive status
          }))
        setProducts(transformedProducts)
      } else {
        console.error('Failed to load products:', result.message)
        if (result.message && result.message.includes('Session expired')) {
          // Will be redirected by service
          return
        }
        setProducts([])
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    // If customer dropdown changed, auto-fill customer details
    if (name === 'customer' && value) {
      const selectedCustomer = customers.find((c) => 
        (c.id || c._id)?.toString() === value.toString()
      )
      
      if (selectedCustomer) {
        setFormData({
          ...formData,
          customer: value,
          customerName: selectedCustomer.name || '',
          customerAddress: selectedCustomer.address || '',
        })
        return
      }
    }
    
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleLineItemChange = (itemId, field, value) => {
    const updatedItems = formData.lineItems.map((item) => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value }
        
        // Calculate line total
        if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
          const qty = field === 'quantity' ? parseFloat(value) || 0 : updatedItem.quantity
          const price = field === 'unitPrice' ? parseFloat(value) || 0 : updatedItem.unitPrice
          const discount = field === 'discount' ? parseFloat(value) || 0 : updatedItem.discount
          
          const subtotal = qty * price
          const discountAmount = (subtotal * discount) / 100
          updatedItem.lineTotal = subtotal - discountAmount
        }
        
        return updatedItem
      }
      return item
    })

    // Calculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
    const tax = subtotal * 0.20 // 20% tax
    const total = subtotal + tax

    setFormData({
      ...formData,
      lineItems: updatedItems,
      subtotal,
      tax,
      total,
    })
  }

  const handleAddLineItem = () => {
    const newItem = {
      id: Date.now(),
      product: '',
      productId: '',
      productName: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      lineTotal: 0,
    }
    setFormData({
      ...formData,
      lineItems: [...formData.lineItems, newItem],
    })
  }

  const handleRemoveLineItem = (itemId) => {
    if (formData.lineItems.length > 1) {
      const updatedItems = formData.lineItems.filter((item) => item.id !== itemId)
      const subtotal = updatedItems.reduce((sum, item) => sum + item.lineTotal, 0)
      const tax = subtotal * 0.20
      const total = subtotal + tax

      setFormData({
        ...formData,
        lineItems: updatedItems,
        subtotal,
        tax,
        total,
      })
    }
  }

  const handleProductSelect = (itemId, productId) => {
    const updatedItems = formData.lineItems.map((item) => {
      if (item.id === itemId) {
        if (!productId) {
          // Clear product if empty selection
          return {
            ...item,
            product: '',
            productId: '',
            productName: '',
            unitPrice: 0,
            lineTotal: 0,
          }
        }
        
        const product = products.find((p) => {
          const pId = p._id || p.id
          return pId === productId || String(pId) === String(productId)
        })
        
        if (product) {
          const qty = item.quantity || 1
          const price = product.price || 0
          const discount = item.discount || 0
          const subtotal = qty * price
          const discountAmount = (subtotal * discount) / 100
          const lineTotal = subtotal - discountAmount
          
          // Always use _id if available, otherwise use id
          const finalProductId = product._id || product.id || productId
          
          return {
            ...item,
            product: finalProductId, // Store productId for dropdown
            productId: finalProductId, // Ensure we use the correct ID format
            productName: product.name,
            unitPrice: price,
            productCode: product.code || product.productCode || '',
            lineTotal: lineTotal,
          }
        }
      }
      return item
    })

    // Calculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
    const tax = subtotal * 0.20 // 20% tax
    const total = subtotal + tax

    setFormData({
      ...formData,
      lineItems: updatedItems,
      subtotal,
      tax,
      total,
    })
  }

  // QR Scanner Functions
  const handleQRScanClick = () => {
    // Ensure quotation modal stays open when opening QR camera
    if (!showCreateModal) {
      setShowCreateModal(true)
    }
    setShowQRCamera(true)
  }

  const handleQRCameraScan = async (scannedCode) => {
    // Close camera but keep quotation modal open
    setShowQRCamera(false)
    // Ensure quotation modal is still open
    setShowCreateModal(true)
    await handleQRScan(scannedCode)
  }

  const handleQRScan = async (code) => {
    if (!code) return
    
    setQrScanning(true)
    
    try {
      let productCode = code
      
      // Try to parse JSON if QR code contains JSON data
      try {
        const parsedData = JSON.parse(code)
        if (parsedData.productCode) {
          productCode = parsedData.productCode
          // If JSON contains full product data, use it directly
          if (parsedData.name && parsedData.price) {
            const product = {
              id: parsedData.productCode,
              _id: parsedData.productId || parsedData._id,
              name: parsedData.name,
              description: parsedData.description || '',
              price: parsedData.price,
              category: parsedData.category || '',
              stock: parsedData.stock || 0,
              productCode: parsedData.productCode,
              image: parsedData.image || '',
              keyFeatures: parsedData.keyFeatures || [],
            }
            
            handleAddFromQR(product)
            
            const successMsg = document.createElement('div')
            successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
            successMsg.textContent = `✓ Product "${product.name}" added successfully!`
            document.body.appendChild(successMsg)
            setTimeout(() => {
              successMsg.remove()
            }, 3000)
            setQrScanning(false)
            return
          }
        }
      } catch (e) {
        // Not JSON, use code as is
        productCode = code
      }
      
      // Fetch product from API using productCode
      const { getProductByCode } = await import('../../services/salemanservices/productService')
      const result = await getProductByCode(productCode)
      
      if (result.success && result.data) {
        const product = {
          id: result.data.productCode,
          _id: result.data._id || result.data.id,
          name: result.data.name,
          description: result.data.description || '',
          price: result.data.price,
          category: result.data.category,
          stock: result.data.stock || 0,
          productCode: result.data.productCode,
        }
        
        // Automatically add to quotation
        handleAddFromQR(product)
        
        // Show success message
        const successMsg = document.createElement('div')
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
        successMsg.textContent = `✓ Product "${product.name}" added successfully!`
        document.body.appendChild(successMsg)
        setTimeout(() => {
          successMsg.remove()
        }, 3000)
      } else {
        alert(result.message || 'Product not found')
      }
    } catch (error) {
      console.error('Error scanning QR:', error)
      alert('Error scanning product')
    } finally {
      setQrScanning(false)
    }
  }

  const handleAddFromQR = (product) => {
    // Add new line item with scanned product data
    // Always prefer _id over id for MongoDB compatibility
    const finalProductId = product._id || product.id || ''
    const newItem = {
      id: Date.now(),
      product: finalProductId,
      productId: finalProductId,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price,
      discount: 0,
      lineTotal: product.price,
    }
    
    const updatedItems = [...formData.lineItems, newItem]
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0)
    const tax = subtotal * 0.20
    const total = subtotal + tax

    setFormData({
      ...formData,
      lineItems: updatedItems,
      subtotal,
      tax,
      total,
    })
    
    setShowProductSelector(false)
    // Ensure quotation modal stays open after adding product from QR
    setShowCreateModal(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      customer: '',
      customerName: '',
      customerAddress: '',
      validUntil: '',
      lineItems: [
        {
          id: 1,
          product: '',
          productId: '',
          productName: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          lineTotal: 0,
        },
      ],
      subtotal: 0,
      tax: 0,
      total: 0,
    })
    setEditingQuotation(null)
  }

  // Handle save as draft
  const handleSaveDraft = async () => {
    // Validate customer (optional for draft)
    if (!formData.customer && !formData.customerName) {
      alert('Please select or enter a customer name')
      return
    }

    // Get customer details - support both id (frontend) and _id (backend)
    const selectedCustomer = customers.find((c) => 
      c.id === parseInt(formData.customer) || 
      c._id === formData.customer ||
      c.id?.toString() === formData.customer?.toString()
    )
    
    // Prepare quotation data for backend
    const quotationData = {
      customerName: selectedCustomer?.name || formData.customerName || '',
      customerEmail: selectedCustomer?.email || '',
      customerPhone: '',
      customerAddress: formData.customerAddress || '',
      validUntil: formData.validUntil || '',
      lineItems: formData.lineItems
        .filter(item => item.product || item.productId)
        .map(item => ({
          productId: item.productId || item.product,
          productName: item.productName || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: item.lineTotal,
        })),
      subtotal: formData.subtotal,
      tax: formData.tax,
      total: formData.total,
      notes: '',
      status: 'Draft',
    }

    try {
      let result
      if (editingQuotation) {
        result = await updateQuotation(editingQuotation.id, quotationData)
      } else {
        result = await createQuotation(quotationData)
      }
      
      if (result.success) {
        alert(editingQuotation ? 'Quotation draft updated successfully!' : 'Quotation saved as draft!')
        setShowCreateModal(false)
        resetForm()
        loadQuotations()
      } else {
        alert(result.message || 'Failed to save draft')
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Error saving draft. Please try again.')
    }
  }

  // Handle view quotation
  const handleViewQuotation = async (quotation) => {
    try {
      const result = await getQuotation(quotation.id || quotation._id)
      if (result.success && result.data) {
        setViewingQuotation(result.data)
        setShowViewModal(true)
      } else {
        alert(result.message || 'Failed to load quotation details')
      }
    } catch (error) {
      console.error('Error loading quotation:', error)
      alert('Error loading quotation details')
    }
  }

  // Handle edit quotation
  const handleEditQuotation = async (quotation) => {
    // Check if quotation belongs to current user (salesman can only edit their own quotations)
    // Backend already filters, but add extra check for security
    const currentUserId = localStorage.getItem('userId')
    const salesmanId = quotation.salesman?._id || quotation.salesman?.id || quotation.salesman
    
    // If salesman field exists and doesn't match current user, prevent edit
    if (salesmanId && salesmanId !== currentUserId && salesmanId.toString() !== currentUserId) {
      alert('You can only edit your own quotations. Admin quotations cannot be edited by salesmen.')
      return
    }

    // Load quotation data into form
    setEditingQuotation(quotation)
    setFormData({
      customer: '',
      customerName: quotation.customerName || '',
      customerAddress: '',
      validUntil: quotation.validUntil || '',
      lineItems: quotation.items && quotation.items.length > 0 
        ? quotation.items.map((item, index) => ({
            id: index + 1,
            product: item.productId || item.product?._id || '',
            productId: item.productId || item.product?._id || '',
            productName: item.productName || item.name || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || item.price || 0,
            discount: item.discount || 0,
            lineTotal: item.lineTotal || item.total || (item.quantity * (item.unitPrice || item.price || 0)),
          }))
        : [
            {
              id: 1,
              product: '',
              productId: '',
              productName: '',
              quantity: 1,
              unitPrice: 0,
              discount: 0,
              lineTotal: 0,
            },
          ],
      subtotal: quotation.subtotal || 0,
      tax: quotation.tax || 0,
      total: quotation.total || 0,
    })
    setShowCreateModal(true)
  }

  // Handle delete quotation
  const handleDeleteQuotation = async (quotation) => {
    // Check if quotation belongs to current user (salesman can only delete their own quotations)
    // Backend already filters, but add extra check for security
    const currentUserId = localStorage.getItem('userId')
    const salesmanId = quotation.salesman?._id || quotation.salesman?.id || quotation.salesman
    
    // If salesman field exists and doesn't match current user, prevent delete
    if (salesmanId && salesmanId !== currentUserId && salesmanId.toString() !== currentUserId) {
      alert('You can only delete your own quotations. Admin quotations cannot be deleted by salesmen.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this quotation?')) {
      return
    }

    try {
      const result = await deleteQuotation(quotation.id || quotation._id)
      if (result.success) {
        alert('Quotation deleted successfully!')
        loadQuotations()
      } else {
        alert(result.message || 'Failed to delete quotation')
      }
    } catch (error) {
      console.error('Error deleting quotation:', error)
      alert('Error deleting quotation')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.customer && !formData.customerName) {
      alert('Please select or enter a customer')
      return
    }

    // Validate line items - check if at least one item has a product selected
    const validItems = formData.lineItems.filter(item => {
      const hasProduct = item.product || item.productId
      const hasValidQuantity = item.quantity > 0
      return hasProduct && hasValidQuantity
    })
    
    if (validItems.length === 0) {
      // Check if there are items but none have products selected
      const itemsWithNoProduct = formData.lineItems.filter(item => !item.product && !item.productId)
      if (itemsWithNoProduct.length > 0) {
        alert('At least one item with a selected product is required. Please select a product for at least one line item.')
        return
      }
      alert('Please add at least one product to the quotation')
      return
    }

    // Get customer details - support both id (frontend) and _id (backend)
    const selectedCustomer = customers.find((c) => 
      c.id === parseInt(formData.customer) || 
      c._id === formData.customer ||
      c.id?.toString() === formData.customer?.toString()
    )
    
    // Prepare quotation data for backend
    // Filter and map line items to ensure valid products
    const validLineItems = formData.lineItems
      .filter(item => {
        const hasProduct = !!(item.productId || item.product)
        const hasValidQuantity = parseFloat(item.quantity) > 0
        if (!hasProduct) {
          console.warn('Line item missing product:', item)
        }
        if (!hasValidQuantity) {
          console.warn('Line item has invalid quantity:', item)
        }
        return hasProduct && hasValidQuantity
      })
      .map(item => ({
        productId: item.productId || item.product,
        productName: item.productName || '',
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
        discount: parseFloat(item.discount) || 0,
        lineTotal: parseFloat(item.lineTotal) || 0,
      }))

    console.log('Form lineItems:', formData.lineItems)
    console.log('Valid lineItems for submission:', validLineItems)

    if (validLineItems.length === 0) {
      alert('Please add at least one item with a selected product and quantity greater than 0')
      return
    }

    const quotationData = {
      customerName: selectedCustomer?.name || formData.customerName || '',
      customerEmail: selectedCustomer?.email || '',
      customerPhone: '',
      customerAddress: formData.customerAddress || '',
      validUntil: formData.validUntil || '',
      lineItems: validLineItems,
      subtotal: formData.subtotal,
      tax: formData.tax,
      total: formData.total,
      notes: '',
      status: 'Sent',
    }

    try {
      let result
      if (editingQuotation) {
        result = await updateQuotation(editingQuotation.id, quotationData)
      } else {
        result = await createQuotation(quotationData)
      }
      
      if (result.success) {
        alert(editingQuotation ? 'Quotation updated successfully!' : 'Quotation created successfully!')
        setShowCreateModal(false)
        resetForm()
        loadQuotations()
      } else {
        alert(result.message || 'Failed to create quotation')
      }
    } catch (error) {
      console.error('Error creating quotation:', error)
      alert('Error creating quotation. Please try again.')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800'
      case 'Sent':
        return 'bg-blue-100 text-blue-800'
      case 'Accepted':
        return 'bg-green-100 text-green-800'
      case 'Rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Quotations</h2>
            <p className="text-sm md:text-base text-gray-600 mt-1">Manage your quotations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
            title="Create New Quote"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Quote</span>
          </button>
        </div>

        {/* Quotations List */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6">
          {quotations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600">No quotations found. Create your first quotation!</p>
            </div>
          ) : (
            <>
              {/* Mobile/Tablet Card View */}
              <div className="block md:hidden space-y-4">
                {quotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 text-lg mb-1">{quote.quoteNumber}</h3>
                        <p className="text-sm text-gray-600">{quote.customerName}</p>
                        <p className="text-xs text-gray-500">{quote.customerEmail}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 text-xs sm:text-sm">
                      <div>
                        <p className="text-gray-600 text-[10px] sm:text-xs">Valid Until</p>
                        <p className="font-medium text-gray-800 text-xs sm:text-sm">{quote.validUntil}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-[10px] sm:text-xs">Created</p>
                        <p className="font-medium text-gray-800 text-xs sm:text-sm">{quote.createdAt}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-[10px] sm:text-xs text-gray-600">Total Amount</p>
                        <p className="text-lg sm:text-xl font-bold text-[#e9931c]">£{quote.total.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewQuotation(quote)}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="View"
                        >
                          <FaEye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditQuotation(quote)}
                          className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          title="Edit"
                        >
                          <FaEdit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuotation(quote)}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <FaTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full min-w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Quote Number</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Customer</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Valid Until</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Total</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Created</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((quote) => (
                      <tr key={quote.id} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-800">{quote.quoteNumber}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-800">{quote.customerName}</div>
                          <div className="text-sm text-gray-500">{quote.customerEmail}</div>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{quote.validUntil}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>
                            {quote.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-[#e9931c]">£{quote.total.toLocaleString()}</div>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{quote.createdAt}</td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewQuotation(quote)}
                              className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
                              title="View"
                            >
                              <FaEye className="w-5 h-5 text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleEditQuotation(quote)}
                              className="p-2 rounded-lg hover:bg-green-50 transition-colors"
                              title="Edit"
                            >
                              <FaEdit className="w-5 h-5 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuotation(quote)}
                              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FaTrash className="w-5 h-5 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      {/* Product Selector Modal */}
      {showProductSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <ProductSelector onSelectProduct={handleAddFromQR} onClose={() => setShowProductSelector(false)} />
          </div>
        </div>
      )}

      {/* QR Camera Scanner Modal */}
      {showQRCamera && (
        <QRCameraScanner
          onScanSuccess={handleQRCameraScan}
          onClose={() => {
            setShowQRCamera(false)
            // Ensure quotation modal stays open after closing camera
            if (!showCreateModal) {
              setShowCreateModal(true)
            }
          }}
        />
      )}

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                  {editingQuotation ? 'Edit Quotation' : 'Create New Quote'}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {editingQuotation ? 'Update quotation details' : 'Fill in the quote details and send to customer'}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Customer Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    name="customer"
                    value={formData.customer}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white"
                  >
                    <option value="">Select customer...</option>
                    {customers.length === 0 ? (
                      <option value="" disabled>No customers available. Customers will appear after allocation.</option>
                    ) : (
                      customers.map((customer) => (
                        <option key={customer.id || customer._id} value={customer.id || customer._id}>
                          {customer.name} {customer.email ? `(${customer.email})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    name="validUntil"
                    value={formData.validUntil}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Line Items *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleQRScanClick}
                      className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                      title="Scan QR Code with Camera"
                      disabled={qrScanning}
                    >
                      <FaQrcode className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-3 py-1 bg-[#e9931c] text-white rounded-lg text-sm font-semibold hover:bg-[#d8820a] transition-colors flex items-center gap-1"
                      title="Add New Line Item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Item
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {formData.lineItems.map((item, index) => (
                    <div key={item.id} className="border-2 border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Product *
                          </label>
                          <select
                            value={item.productId || item.product || ''}
                            onChange={(e) => {
                              const selectedValue = e.target.value
                              handleProductSelect(item.id, selectedValue)
                            }}
                            required
                            className={`w-full px-3 py-2 border-2 rounded-lg focus:outline-none bg-white text-sm ${
                              item.productId || item.product
                                ? 'border-gray-200 focus:border-[#e9931c]'
                                : 'border-orange-300 focus:border-orange-500'
                            }`}
                          >
                            <option value="">Select Product</option>
                            {productsLoading ? (
                              <option value="">Loading products...</option>
                            ) : products.length === 0 ? (
                              <option value="" disabled>No products available</option>
                            ) : (
                              products.map((product) => {
                                // Always prefer _id over id for MongoDB compatibility
                                const productValue = product._id || product.id
                                return (
                                  <option 
                                    key={productValue} 
                                    value={productValue}
                                  >
                                    {product.name} - £{product.price}
                                  </option>
                                )
                              })
                            )}
                          </select>
                          {!item.product && !item.productId && (
                            <p className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Please select a product
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Unit Price (£)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(item.id, 'unitPrice', e.target.value)}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Discount %
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount}
                              onChange={(e) => handleLineItemChange(item.id, 'discount', e.target.value)}
                              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white text-sm"
                            />
                            {formData.lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(item.id)}
                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-right">
                        <span className="text-sm font-semibold text-gray-700">
                          Line Total: £{item.lineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Section */}
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold">£{formData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Tax (20%):</span>
                    <span className="font-semibold">£{formData.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-800">Total:</span>
                    <span className="font-bold" style={{ color: '#e9931c' }}>
                      £{formData.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-500 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                  title="Save as Draft"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingQuotation(null)
                    resetForm()
                  }}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-200 text-gray-700 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                  title="Cancel"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#e9931c] text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                  title={editingQuotation ? "Update Quote" : "Create Quote"}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{editingQuotation ? 'Update Quote' : 'Create Quote'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Quotation Modal */}
      {showViewModal && viewingQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Quotation Details</h3>
                <p className="text-sm text-gray-600 mt-1">Quote #{viewingQuotation.quoteNumber || viewingQuotation.quotationNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false)
                  setViewingQuotation(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="font-semibold text-gray-800">{viewingQuotation.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer Email</p>
                  <p className="font-semibold text-gray-800">{viewingQuotation.customerEmail || 'N/A'}</p>
                </div>
                {viewingQuotation.customerPhone && (
                  <div>
                    <p className="text-sm text-gray-500">Customer Phone</p>
                    <p className="font-semibold text-gray-800">{viewingQuotation.customerPhone}</p>
                  </div>
                )}
                {viewingQuotation.validUntil && (
                  <div>
                    <p className="text-sm text-gray-500">Valid Until</p>
                    <p className="font-semibold text-gray-800">{viewingQuotation.validUntil}</p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Product</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Quantity</th>
                        <th className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-700">Discount</th>
                        <th className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingQuotation.items && viewingQuotation.items.length > 0 ? (
                        viewingQuotation.items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-800">
                              {item.productName || item.name || 'N/A'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-800">
                              {item.quantity}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-sm text-gray-800">
                              £{item.unitPrice || item.price || 0}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-sm text-gray-800">
                              {item.discount || 0}%
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-800">
                              £{item.lineTotal || item.total || 0}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="border border-gray-300 px-4 py-4 text-center text-gray-500">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-semibold">£{viewingQuotation.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  {viewingQuotation.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Tax:</span>
                      <span className="font-semibold">£{viewingQuotation.tax.toFixed(2)}</span>
                    </div>
                  )}
                  {viewingQuotation.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Discount:</span>
                      <span className="font-semibold">£{viewingQuotation.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-800">Total:</span>
                    <span className="font-bold" style={{ color: '#e9931c' }}>
                      £{viewingQuotation.total?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(viewingQuotation.status)}`}>
                    {viewingQuotation.status}
                  </span>
                </div>
                {viewingQuotation.createdAt && (
                  <div>
                    <p className="text-sm text-gray-500">Created Date</p>
                    <p className="font-semibold text-gray-800">{viewingQuotation.createdAt}</p>
                  </div>
                )}
              </div>

              {viewingQuotation.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {viewingQuotation.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowViewModal(false)
                  setViewingQuotation(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Quotation

