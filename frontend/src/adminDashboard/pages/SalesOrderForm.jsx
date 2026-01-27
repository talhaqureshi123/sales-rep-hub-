import { useState, useEffect, useRef } from 'react'
import { FaShoppingCart, FaPlus, FaTrash, FaSave, FaTimes, FaSpinner } from 'react-icons/fa'
import { getSalesOrder, createSalesOrder, updateSalesOrder } from '../../services/adminservices/salesOrderService'
import Swal from 'sweetalert2'

const SalesOrderForm = ({ orderId = null, onClose = null, initialData = null }) => {
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [salesPersons, setSalesPersons] = useState([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState({})
  const [productSearch, setProductSearch] = useState({})
  const signatureCanvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const orderSourceOptions = [
    'Website',
    'Phone',
    'Email',
    'Walk-in',
    'Sales Rep',
    'Referral',
    'Other'
  ]

  const paymentMethodOptions = [
    'Cash',
    'Credit Card',
    'Debit Card',
    'Bank Transfer',
    'Cheque',
    'Credit Terms',
    'Other'
  ]

  const unitOptions = ['Rolls', 'Boxes', 'Pieces', 'Packs', 'Units', 'Kg', 'Liters']

  const [formData, setFormData] = useState({
    // Section A: Order Information
    soNumber: '',
    orderDate: new Date().toISOString().split('T')[0],
    salesPerson: '',
    salesPersonEmail: '',
    poNumber: '',
    orderSource: '',

    // Section B: Customer Details
    customer: '',
    customerName: '',
    contactPerson: '',
    phoneNumber: '',
    emailAddress: '',
    billingAddress: '',
    deliveryAddress: '',

    // Section C: Product Line Items
    items: [{
      productCode: '',
      productName: '',
      productId: '',
      spec: '',
      unitPrice: 0,
      quantity: 1,
      unit: 'Rolls',
      lineTotal: 0,
    }],

    // Section D: Order Totals
    subtotal: 0,
    discount: 0,
    deliveryCharges: 0,
    vat: 0,
    grandTotal: 0,

    // Section E: Payment Information
    paymentMethod: '',
    amountPaid: 0,
    paymentReceived: false,
    balanceRemaining: 0,

    // Section F: Status & Workflow
    orderStatus: 'Draft',
    invoiceNumber: '',
    trackingNumber: '',
    expectedDispatchDate: '',
    actualDispatchDate: '',
    orderNotes: '',

    // Section G: Internal Flags
    sendToAdmin: false,
    stockDeducted: false,
    sendToWarehouse: false,
    creditLimitCheck: false,

    // Customer Signature
    customerSignature: '',
    
    // Internal tracking
    _previousStatus: 'Draft',
  })

  useEffect(() => {
    loadInitialData()
    if (orderId) {
      loadOrder(orderId)
    } else {
      // Set current user as sales person - pre-fill all user info
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const currentUserRole = localStorage.getItem('userRole') || 'admin'
      const userId = localStorage.getItem('userId') || user._id || user.id || ''
      const userEmail = localStorage.getItem('userEmail') || user.email || ''
      const userName = localStorage.getItem('userName') || user.name || user.firstName || ''
      
      // Always set sales person if salesman role, otherwise set if userId available
      if ((currentUserRole === 'salesman' && userId) || (userId || userEmail)) {
        setFormData(prev => ({
          ...prev,
          salesPersonEmail: userEmail,
          salesPerson: userId,
          // Pre-fill user info if available
          contactPerson: userName || prev.contactPerson,
          phoneNumber: user.phone || prev.phoneNumber,
          emailAddress: userEmail || prev.emailAddress,
        }))
      }
      
      // Pre-fill data from visit target (achievement click)
      // Note: Customer selection will happen in useEffect after customers are loaded
      const visitTargetData = localStorage.getItem('salesOrderVisitTarget')
      const isFromAchievement = localStorage.getItem('salesOrderFromAchievement') === 'true'
      if (visitTargetData) {
        try {
          const data = JSON.parse(visitTargetData)
          setFormData(prev => ({
            ...prev,
            customerName: data.customerName || prev.customerName,
            emailAddress: data.customerEmail || prev.emailAddress,
            phoneNumber: data.customerPhone || prev.phoneNumber,
            deliveryAddress: data.deliveryAddress || prev.deliveryAddress,
            contactPerson: data.customerName || prev.contactPerson,
            billingAddress: data.deliveryAddress || prev.billingAddress,
            // If from achievement, set sendToAdmin to true by default and status to Pending
            sendToAdmin: isFromAchievement ? true : prev.sendToAdmin,
            orderStatus: isFromAchievement ? 'Pending' : prev.orderStatus,
          }))
          // Don't remove localStorage yet - we'll use it in useEffect to auto-select customer
        } catch (e) {
          console.error('Error parsing visit target data:', e)
        }
      } else if (isFromAchievement) {
        // Even if no visit target data, set sendToAdmin if from achievement
        setFormData(prev => ({
          ...prev,
          sendToAdmin: true,
          orderStatus: 'Pending',
        }))
      }
      
      // Pre-fill from initialData prop if provided
      if (initialData) {
        setFormData(prev => ({
          ...prev,
          customerName: initialData.customerName || prev.customerName,
          emailAddress: initialData.customerEmail || prev.emailAddress,
          phoneNumber: initialData.customerPhone || prev.phoneNumber,
          deliveryAddress: initialData.deliveryAddress || prev.deliveryAddress,
        }))
      }
    }
  }, [orderId, initialData])

  // Auto-select customer from visit target data (from Sales Tracking)
  useEffect(() => {
    const visitTargetData = localStorage.getItem('salesOrderVisitTarget')
    if (visitTargetData && customers.length > 0 && !formData.customer) {
      try {
        const data = JSON.parse(visitTargetData)
        const customerName = (data.customerName || '').trim().toLowerCase()
        const customerEmail = (data.customerEmail || '').trim().toLowerCase()
        
        // Find matching customer by name or email
        const matchingCustomer = customers.find(c => {
          const cName = ((c.name || c.firstName || '') + ' ' + (c.contactPerson || '')).trim().toLowerCase()
          const cEmail = (c.email || '').trim().toLowerCase()
          
          return (customerName && (cName.includes(customerName) || customerName.includes(cName))) ||
                 (customerEmail && cEmail === customerEmail) ||
                 (customerName && cName === customerName)
        })
        
        if (matchingCustomer) {
          setFormData(prev => ({
            ...prev,
            customer: matchingCustomer._id || matchingCustomer.id,
            customerName: matchingCustomer.firstName || matchingCustomer.name || data.customerName || prev.customerName,
            contactPerson: matchingCustomer.contactPerson || data.customerName || prev.contactPerson,
            phoneNumber: matchingCustomer.phone || data.customerPhone || prev.phoneNumber,
            emailAddress: matchingCustomer.email || data.customerEmail || prev.emailAddress,
            billingAddress: matchingCustomer.address || data.deliveryAddress || prev.billingAddress,
            deliveryAddress: matchingCustomer.address || data.deliveryAddress || prev.deliveryAddress,
          }))
          setCustomerSearch(matchingCustomer.firstName || matchingCustomer.name || data.customerName || '')
          console.log('✅ Auto-selected customer from Sales Tracking:', matchingCustomer.firstName || matchingCustomer.name)
        } else {
          console.log('⚠️ Could not find matching customer for:', data.customerName || data.customerEmail)
        }
        
        // Clean up localStorage after use
        localStorage.removeItem('salesOrderVisitTarget')
        localStorage.removeItem('salesOrderFromAchievement')
      } catch (e) {
        console.error('Error auto-selecting customer from visit target:', e)
        localStorage.removeItem('salesOrderVisitTarget')
        localStorage.removeItem('salesOrderFromAchievement')
      }
    }
  }, [customers, formData.customer])

  // Set current user as sales person when salesPersons list loads (for salesman)
  useEffect(() => {
    const currentUserRole = localStorage.getItem('userRole') || 'admin'
    if (currentUserRole === 'salesman') {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const userId = localStorage.getItem('userId') || user._id || user.id || ''
      const userEmail = localStorage.getItem('userEmail') || user.email || ''
      const userName = localStorage.getItem('userName') || user.name || user.firstName || ''
      
      if (userId && !formData.salesPerson) {
        // Find current user in salespersons list
        const currentUser = salesPersons.find(p => {
          const pId = (p._id || p.id || '').toString()
          return pId === userId.toString()
        })
        
        if (currentUser) {
          setFormData(prev => ({
            ...prev,
            salesPerson: currentUser._id || currentUser.id || userId,
            salesPersonEmail: currentUser.email || userEmail || prev.salesPersonEmail,
          }))
        } else if (userId) {
          // If user not in list, add them and set
          const newSalesPerson = {
            _id: userId,
            id: userId,
            name: userName,
            email: userEmail,
            role: 'salesman'
          }
          setSalesPersons([newSalesPerson, ...salesPersons])
          setFormData(prev => ({
            ...prev,
            salesPerson: userId,
            salesPersonEmail: userEmail || prev.salesPersonEmail,
          }))
        }
      }
    }
  }, [salesPersons, formData.salesPerson])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowCustomerDropdown(false)
        setShowProductDropdown({})
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    calculateTotals()
  }, [formData.items, formData.discount, formData.deliveryCharges])

  const loadInitialData = async () => {
    try {
      setInitialLoading(true)
      
      // Get current user role to determine which services to use
      const currentUserRole = localStorage.getItem('userRole') || 'admin'
      
      // Dynamically import services based on user role
      let getCustomers, getProducts, getUsers
      
      if (currentUserRole === 'salesman') {
        // Use salesman services
        const customerService = await import('../../services/salemanservices/customerService')
        const productService = await import('../../services/salemanservices/productService')
        getCustomers = customerService.getMyCustomers // Use getMyCustomers for salesman
        getProducts = productService.getProducts
        // For salesman, create current user object for salesPersons list
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const userId = localStorage.getItem('userId') || user._id || user.id || ''
        const userEmail = localStorage.getItem('userEmail') || user.email || ''
        const userName = localStorage.getItem('userName') || user.name || user.firstName || ''
        getUsers = async () => ({ 
          success: true, 
          data: userId ? [{
            _id: userId,
            id: userId,
            name: userName,
            email: userEmail,
            role: 'salesman'
          }] : []
        })
      } else {
        // Use admin services
        const customerService = await import('../../services/adminservices/customerService')
        const productService = await import('../../services/adminservices/productService')
        const userService = await import('../../services/adminservices/userService')
        getCustomers = customerService.getCustomers
        getProducts = productService.getProducts
        getUsers = () => userService.getUsers({ role: 'salesman' })
      }
      
      const [customersResult, productsResult, usersResult] = await Promise.all([
        getCustomers(),
        getProducts(),
        getUsers(),
      ])

      if (customersResult.success) {
        setCustomers(customersResult.data || [])
        console.log(`✅ Loaded ${customersResult.data?.length || 0} customers`)
      } else {
        console.error('Failed to load customers:', customersResult.message)
        Swal.fire({
          icon: 'warning',
          title: 'Customers Load Failed',
          text: customersResult.message || 'Could not load customers',
          confirmButtonColor: '#e9931c'
        })
      }

      if (productsResult.success) {
        setProducts(productsResult.data || [])
        console.log(`✅ Loaded ${productsResult.data?.length || 0} products`)
      } else {
        console.error('Failed to load products:', productsResult.message)
        Swal.fire({
          icon: 'warning',
          title: 'Products Load Failed',
          text: productsResult.message || 'Could not load products',
          confirmButtonColor: '#e9931c'
        })
      }

      if (usersResult.success) {
        let salesPersonsList = usersResult.data || []
        const currentUserRole = localStorage.getItem('userRole') || 'admin'
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const userId = localStorage.getItem('userId') || user._id || user.id || ''
        const userEmail = localStorage.getItem('userEmail') || user.email || ''
        const userName = localStorage.getItem('userName') || user.name || user.firstName || ''
        
        // For salesman, ensure current user is in the list
        if (currentUserRole === 'salesman' && userId) {
          const currentUserExists = salesPersonsList.some(p => {
            const pId = (p._id || p.id || '').toString()
            return pId === userId.toString()
          })
          
          // If current user not in list, add them
          if (!currentUserExists) {
            salesPersonsList = [{
              _id: userId,
              id: userId,
              name: userName,
              email: userEmail,
              role: 'salesman'
            }, ...salesPersonsList]
          }
          
          // Set current user as selected
          setFormData(prev => ({
            ...prev,
            salesPerson: userId,
            salesPersonEmail: userEmail || prev.salesPersonEmail,
          }))
        }
        
        setSalesPersons(salesPersonsList)
        console.log(`✅ Loaded ${salesPersonsList.length} salespersons`)
      } else {
        console.error('Failed to load salespersons:', usersResult.message)
        
        // If salesman and salespersons failed to load, still set current user and add to list
        const currentUserRole = localStorage.getItem('userRole') || 'admin'
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        const userId = localStorage.getItem('userId') || user._id || user.id || ''
        const userEmail = localStorage.getItem('userEmail') || user.email || ''
        const userName = localStorage.getItem('userName') || user.name || user.firstName || ''
        
        if (currentUserRole === 'salesman' && userId) {
          // Add current user to salesPersons list even if load failed
          setSalesPersons([{
            _id: userId,
            id: userId,
            name: userName,
            email: userEmail,
            role: 'salesman'
          }])
          
          setFormData(prev => ({
            ...prev,
            salesPerson: userId,
            salesPersonEmail: userEmail || prev.salesPersonEmail,
          }))
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading form data. Please refresh the page.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setInitialLoading(false)
    }
  }

  const loadOrder = async (id) => {
    setLoading(true)
    try {
      const result = await getSalesOrder(id)
      if (result.success && result.data) {
        const order = result.data
        const previousStatus = formData.orderStatus || order.orderStatus || 'Draft'
        
        setFormData(prev => ({
          ...order,
          orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          expectedDispatchDate: order.expectedDispatchDate ? new Date(order.expectedDispatchDate).toISOString().split('T')[0] : '',
          actualDispatchDate: order.actualDispatchDate ? new Date(order.actualDispatchDate).toISOString().split('T')[0] : '',
          _previousStatus: previousStatus
        }))
        if (order.customerSignature) {
          setTimeout(() => {
            loadSignatureToCanvas(order.customerSignature)
          }, 100)
        }
      }
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const lineTotal = (item.unitPrice || 0) * (item.quantity || 0)
      return sum + lineTotal
    }, 0)

    const vatRate = 20 // 20%
    const vat = (subtotal - (formData.discount || 0) + (formData.deliveryCharges || 0)) * (vatRate / 100)
    const grandTotal = subtotal - (formData.discount || 0) + (formData.deliveryCharges || 0) + vat
    const balanceRemaining = grandTotal - (formData.amountPaid || 0)

    setFormData(prev => ({
      ...prev,
      subtotal,
      vat,
      grandTotal,
      balanceRemaining,
    }))
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleCustomerSelect = (customer) => {
    setFormData(prev => ({
      ...prev,
      customer: customer._id || customer.id,
      customerName: customer.firstName || customer.name || '',
      contactPerson: customer.contactPerson || '',
      phoneNumber: customer.phone || '',
      emailAddress: customer.email || '',
      billingAddress: customer.address || '',
      deliveryAddress: customer.address || '',
    }))
    setShowCustomerDropdown(false)
    setCustomerSearch('')
  }

  const handleProductSelect = (product, itemIndex) => {
    const updatedItems = [...formData.items]
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      productId: product._id || product.id,
      productCode: product.productCode || product.code || '',
      productName: product.name || '',
      unitPrice: product.price || product.unitPrice || 0,
      spec: product.keyFeatures?.[0] || product.spec || product.description || '',
    }
    updatedItems[itemIndex].lineTotal = (updatedItems[itemIndex].unitPrice || 0) * (updatedItems[itemIndex].quantity || 0)
    setFormData(prev => ({ ...prev, items: updatedItems }))
    setShowProductDropdown(prev => ({ ...prev, [itemIndex]: false }))
    setProductSearch(prev => ({ ...prev, [itemIndex]: '' }))
  }

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: field === 'quantity' || field === 'unitPrice' ? parseFloat(value) || 0 : value,
    }
    updatedItems[index].lineTotal = (updatedItems[index].unitPrice || 0) * (updatedItems[index].quantity || 0)
    setFormData(prev => ({ ...prev, items: updatedItems }))
  }

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        productCode: '',
        productName: '',
        productId: '',
        spec: '',
        unitPrice: 0,
        quantity: 1,
        unit: 'Rolls',
        lineTotal: 0,
      }],
    }))
  }

  const removeItemRow = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }))
    }
  }

  // Signature handling
  const startDrawing = (e) => {
    setIsDrawing(true)
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    saveSignature()
  }

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current
    if (canvas) {
      const signature = canvas.toDataURL('image/png')
      setFormData(prev => ({ ...prev, customerSignature: signature }))
    }
  }

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setFormData(prev => ({ ...prev, customerSignature: '' }))
    }
  }

  const loadSignatureToCanvas = (signatureData) => {
    const canvas = signatureCanvasRef.current
    if (canvas && signatureData) {
      const ctx = canvas.getContext('2d')
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
      }
      img.src = signatureData
    }
  }

  const handleSubmit = async (e, saveAsDraft = false) => {
    e.preventDefault()
    
    // Validation
    if (!formData.customer || !formData.customerName) {
      Swal.fire({
        icon: 'warning',
        title: 'Customer Required',
        text: 'Please select a customer',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    if (!formData.items || formData.items.length === 0 || !formData.items.some(item => item.productId && item.productName)) {
      Swal.fire({
        icon: 'warning',
        title: 'Products Required',
        text: 'Please add at least one product to the order',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    if (!formData.salesPerson) {
      Swal.fire({
        icon: 'warning',
        title: 'Sales Person Required',
        text: 'Please select a sales person',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    setLoading(true)

    try {
      const orderData = {
        ...formData,
        orderStatus: saveAsDraft ? 'Draft' : formData.orderStatus,
        orderDate: new Date(formData.orderDate),
        expectedDispatchDate: formData.expectedDispatchDate ? new Date(formData.expectedDispatchDate) : null,
        actualDispatchDate: formData.actualDispatchDate ? new Date(formData.actualDispatchDate) : null,
        // Ensure items have required fields
        items: formData.items.map(item => ({
          ...item,
          productId: item.productId || null,
          productCode: item.productCode || '',
          productName: item.productName || '',
          unitPrice: item.unitPrice || 0,
          quantity: item.quantity || 1,
          lineTotal: (item.unitPrice || 0) * (item.quantity || 1),
        }))
      }

      let result
      if (orderId) {
        result = await updateSalesOrder(orderId, orderData)
      } else {
        result = await createSalesOrder(orderData)
      }

      if (result.success) {
        // Check if order was submitted for approval (sendToAdmin = true)
        const isFromAchievement = localStorage.getItem('salesOrderFromAchievement') === 'true'
        
        // Check if admin is approving an order (status changed from Pending/Draft to Confirmed)
        const previousStatus = formData._previousStatus || formData.orderStatus
        const isAdminApproval = orderId && 
                                orderData.orderStatus === 'Confirmed' && 
                                (previousStatus === 'Pending' || previousStatus === 'Draft')
        
        if (orderData.sendToAdmin && isFromAchievement) {
          Swal.fire({
            icon: 'success',
            title: 'Order Submitted!',
            text: 'Your order has been submitted for admin approval. Once approved, it will appear in your Sales Targets.',
            confirmButtonColor: '#e9931c'
          }).then(() => {
            localStorage.removeItem('salesOrderFromAchievement')
            // Navigate to Sales Targets
            const event = new CustomEvent('navigateToTab', { detail: 'sales-targets' })
            window.dispatchEvent(event)
          })
        } else if (isAdminApproval) {
          // Admin approved the order - store flag for salesman to see
          localStorage.setItem('orderApprovedRedirect', 'true')
          localStorage.setItem('approvedOrderId', orderId)
          
          Swal.fire({
            icon: 'success',
            title: 'Order Approved!',
            text: 'Order has been approved and confirmed. Salesman will be notified.',
            confirmButtonColor: '#e9931c'
          })
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: orderId ? 'Order updated successfully!' : 'Order created successfully!',
            confirmButtonColor: '#e9931c'
          })
        }
        
        if (onClose) onClose()
        else if (!isFromAchievement) window.location.reload()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to save order',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error saving order:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error saving order. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(c => {
    const searchTerm = customerSearch.toLowerCase()
    const name = (c.firstName || c.name || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm)
  })

  const getFilteredProducts = (itemIndex) => {
    const searchTerm = (productSearch[itemIndex] || '').toLowerCase()
    if (!searchTerm) return products.slice(0, 10) // Show first 10 if no search
    
    return products.filter(p => {
      const name = (p.name || '').toLowerCase()
      const code = (p.productCode || '').toLowerCase()
      const description = (p.description || '').toLowerCase()
      return name.includes(searchTerm) || code.includes(searchTerm) || description.includes(searchTerm)
    }).slice(0, 20) // Limit to 20 results
  }

  if (initialLoading) {
    return (
      <div className="w-full bg-white rounded-lg shadow-lg p-12">
        <div className="flex flex-col items-center justify-center">
          <FaSpinner className="w-12 h-12 text-[#e9931c] animate-spin mb-4" />
          <p className="text-gray-600 text-lg">Loading form data...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching products, customers, and salespersons</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-6 border-b bg-white">
        <h1 className="text-3xl font-bold text-gray-900">Sales Order Form</h1>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className="p-6">

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-8">
        {/* Section A: Order Information */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section A: Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SO Number</label>
              <input
                type="text"
                name="soNumber"
                value={formData.soNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Auto-generated"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Date</label>
              <input
                type="date"
                name="orderDate"
                value={formData.orderDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sales Person <span className="text-red-500">*</span></label>
              <select
                name="salesPerson"
                value={formData.salesPerson}
                onChange={(e) => {
                  const selectedPerson = salesPersons.find(p => (p._id || p.id) === e.target.value)
                  setFormData(prev => ({
                    ...prev,
                    salesPerson: e.target.value,
                    salesPersonEmail: selectedPerson?.email || prev.salesPersonEmail
                  }))
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                required
              >
                <option value="">Select sales person</option>
                {salesPersons.map(person => (
                  <option key={person._id || person.id} value={person._id || person.id}>
                    {person.name} ({person.email})
                  </option>
                ))}
              </select>
              {formData.salesPersonEmail && (
                <p className="text-xs text-gray-500 mt-1">Email: {formData.salesPersonEmail}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PO Number (Optional)</label>
              <input
                type="text"
                name="poNumber"
                value={formData.poNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="e.g., PO-2025-001"
              />
              <p className="text-xs text-gray-500 mt-1">Customer's purchase order number.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Source <span className="text-red-500">*</span></label>
              <select
                name="orderSource"
                value={formData.orderSource}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              >
                <option value="">Select order source</option>
                {orderSourceOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section B: Customer Details */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section B: Customer Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={customerSearch || formData.customerName}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(true)
                }}
                onFocus={() => {
                  setShowCustomerDropdown(true)
                  if (!customerSearch && formData.customerName) {
                    setCustomerSearch(formData.customerName)
                  }
                }}
                onBlur={() => {
                  // Delay hiding dropdown to allow click
                  setTimeout(() => {
                    setShowCustomerDropdown(false)
                  }, 200)
                }}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder={initialLoading ? "Loading customers..." : "Search customers by name, email, or phone..."}
                required
                disabled={initialLoading}
              />
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(customer => (
                      <div
                        key={customer._id || customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                      >
                        <p className="font-medium text-gray-800">{customer.firstName || customer.name}</p>
                        <p className="text-sm text-gray-600">
                          {customer.email && `Email: ${customer.email}`}
                          {customer.phone && ` | Phone: ${customer.phone}`}
                        </p>
                        {customer.address && (
                          <p className="text-xs text-gray-500 mt-1">{customer.address}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-gray-500">
                      <p>No customers found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                name="emailAddress"
                value={formData.emailAddress}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Billing Address</label>
              <textarea
                name="billingAddress"
                value={formData.billingAddress}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
              <textarea
                name="deliveryAddress"
                value={formData.deliveryAddress}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
          </div>
        </div>

        {/* Section C: Product Line Items */}
        <div className="border-b pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Section C: Product Line Items</h2>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-2 px-4 py-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors"
            >
              <FaPlus className="w-4 h-4" />
              <span>Add Row</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Product Code</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Product Name <span className="text-red-500">*</span></th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Spec/Micron</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unit Price (£)</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Quantity</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unit</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Line Total</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.productCode}
                        onChange={(e) => handleItemChange(index, 'productCode', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c]"
                        placeholder="Code"
                      />
                    </td>
                    <td className="px-4 py-2 relative dropdown-container">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => {
                          const value = e.target.value
                          handleItemChange(index, 'productName', value)
                          setProductSearch(prev => ({ ...prev, [index]: value }))
                          setShowProductDropdown(prev => ({ ...prev, [index]: true }))
                        }}
                        onFocus={() => {
                          setShowProductDropdown(prev => ({ ...prev, [index]: true }))
                          if (!productSearch[index]) {
                            setProductSearch(prev => ({ ...prev, [index]: item.productName }))
                          }
                        }}
                        onBlur={() => {
                          // Delay hiding dropdown to allow click
                          setTimeout(() => {
                            setShowProductDropdown(prev => ({ ...prev, [index]: false }))
                          }, 200)
                        }}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c]"
                        placeholder={initialLoading ? "Loading products..." : "Search products by name or code..."}
                        required
                        disabled={initialLoading}
                      />
                      {showProductDropdown[index] && !initialLoading && (
                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredProducts(index).length > 0 ? (
                            getFilteredProducts(index).map(product => (
                              <div
                                key={product._id || product.id}
                                onClick={() => {
                                  handleProductSelect(product, index)
                                  setShowProductDropdown(prev => ({ ...prev, [index]: false }))
                                  setProductSearch(prev => ({ ...prev, [index]: '' }))
                                }}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                              >
                                <p className="font-medium text-gray-800">{product.name}</p>
                                <p className="text-sm text-gray-600">
                                  Code: {product.productCode || 'N/A'} | Price: £{product.price || 0}
                                  {product.category && ` | Category: ${product.category}`}
                                </p>
                                {product.description && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">{product.description}</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-center text-gray-500">
                              <p>No products found</p>
                              <p className="text-xs mt-1">Try a different search term</p>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.spec}
                        onChange={(e) => handleItemChange(index, 'spec', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c]"
                        placeholder="Spec/Micron"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c]"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c]"
                        min="1"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.unit || 'Rolls'}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-[#e9931c] min-w-[100px]"
                        style={{ minWidth: '100px', textOverflow: 'ellipsis' }}
                      >
                        {unitOptions.map(unit => (
                          <option key={unit} value={unit} title={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-semibold">£{item.lineTotal.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-2">
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right">
            <p className="text-lg font-semibold">Line Total: £{formData.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Section D: Order Totals */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section D: Order Totals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subtotal</label>
              <input
                type="text"
                value={`£${formData.subtotal.toFixed(2)}`}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount (£)</label>
              <input
                type="number"
                name="discount"
                value={formData.discount}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Charges (£)</label>
              <input
                type="number"
                name="deliveryCharges"
                value={formData.deliveryCharges}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">VAT (20%)</label>
              <input
                type="text"
                value={`£${formData.vat.toFixed(2)}`}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50"
                readOnly
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Grand Total</label>
              <input
                type="text"
                value={`£${formData.grandTotal.toFixed(2)}`}
                className="w-full px-4 py-2 border-2 border-[#e9931c] rounded-lg bg-orange-50 text-2xl font-bold text-[#e9931c]"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Section E: Payment Information */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section E: Payment Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              >
                <option value="">Select payment method</option>
                {paymentMethodOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount Paid (£)</label>
              <input
                type="number"
                name="amountPaid"
                value={formData.amountPaid}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="paymentReceived"
                  checked={formData.paymentReceived}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
                />
                <span className="text-sm text-gray-700">Payment Received</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Balance Remaining</label>
              <input
                type="text"
                value={`£${formData.balanceRemaining.toFixed(2)}`}
                className="w-full px-4 py-2 border-2 border-green-200 rounded-lg bg-green-50 text-green-700 font-semibold"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Section F: Status & Workflow */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section F: Status & Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Status <span className="text-red-500">*</span></label>
              <select
                name="orderStatus"
                value={formData.orderStatus}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                required
              >
                <option value="Draft">Draft - Order being created</option>
                <option value="Pending">Pending - Awaiting confirmation</option>
                <option value="Confirmed">Confirmed - Order approved</option>
                <option value="Processing">Processing - Being prepared</option>
                <option value="Dispatched">Dispatched - Shipped to customer</option>
                <option value="Delivered">Delivered - Customer received</option>
                <option value="Cancelled">Cancelled - Order cancelled</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.orderStatus === 'Draft' && 'Order is being created, not yet submitted'}
                {formData.orderStatus === 'Pending' && 'Order submitted, waiting for approval'}
                {formData.orderStatus === 'Confirmed' && 'Order approved, sent to warehouse'}
                {formData.orderStatus === 'Processing' && 'Order being prepared and packed'}
                {formData.orderStatus === 'Dispatched' && 'Order shipped, add tracking number'}
                {formData.orderStatus === 'Delivered' && 'Order delivered to customer'}
                {formData.orderStatus === 'Cancelled' && 'Order has been cancelled'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number</label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-gray-50"
                placeholder="Auto-generated when status changes from Draft"
                readOnly={formData.orderStatus !== 'Draft'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.orderStatus === 'Draft' 
                  ? 'Will be auto-generated when status changes from Draft'
                  : 'Invoice number (auto-generated)'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tracking Number</label>
              <input
                type="text"
                name="trackingNumber"
                value={formData.trackingNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Add tracking number when order is dispatched"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required when status is "Dispatched" or "Delivered"
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Dispatch Date</label>
              <input
                type="date"
                name="expectedDispatchDate"
                value={formData.expectedDispatchDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Actual Dispatch Date</label>
              <input
                type="date"
                name="actualDispatchDate"
                value={formData.actualDispatchDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Notes</label>
              <textarea
                name="orderNotes"
                value={formData.orderNotes}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Additional notes about the order..."
              />
            </div>
          </div>
        </div>

        {/* Section G: Internal Flags */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Section G: Internal Flags</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sendToAdmin"
                checked={formData.sendToAdmin}
                onChange={handleInputChange}
                className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
              />
              <span className="text-sm text-gray-700">Send to Admin</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="stockDeducted"
                checked={formData.stockDeducted}
                onChange={handleInputChange}
                className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
              />
              <span className="text-sm text-gray-700">Stock Deducted</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="sendToWarehouse"
                checked={formData.sendToWarehouse}
                onChange={handleInputChange}
                className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
              />
              <span className="text-sm text-gray-700">Send to Warehouse</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="creditLimitCheck"
                checked={formData.creditLimitCheck}
                onChange={handleInputChange}
                className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
              />
              <span className="text-sm text-gray-700">Credit Limit Check</span>
            </label>
          </div>
        </div>

        {/* Customer Signature */}
        <div className="border-b pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Customer Signature</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Signature</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <canvas
                ref={signatureCanvasRef}
                width={600}
                height={200}
                className="border border-gray-300 rounded bg-white cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={clearSignature}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Clear Signature
              </button>
              <button
                type="button"
                onClick={saveSignature}
                className="px-4 py-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors"
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FaSave className="w-4 h-4" />
                  <span>Submit Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}

export default SalesOrderForm
