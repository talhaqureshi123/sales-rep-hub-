import { useState, useEffect, useRef } from 'react'
import { FaFileInvoice, FaSearch, FaCheckSquare, FaPlus, FaEdit, FaTrash, FaEye, FaQrcode, FaPaperPlane, FaDownload, FaWhatsapp, FaCloudUploadAlt, FaFileImport } from 'react-icons/fa'
import { useIsMobile } from '../../hooks/useIsMobile'
import Swal from 'sweetalert2'
import { getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation, sendQuotationEmail } from '../../services/adminservices/quotationService'
import { getCustomers } from '../../services/adminservices/customerService'
import { getProducts } from '../../services/adminservices/productService'
import { getUsers } from '../../services/adminservices/userService'
import { pushQuotationsToHubSpot } from '../../services/adminservices/hubspotService'
import QRCameraScanner from '../../components/QRCameraScanner'

const Quotes = () => {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedQuotes, setSelectedQuotes] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState(null)

  const statusOptions = [
    'All',
    'Draft',
    'Sent',
    'Approved',
    'Rejected'
  ]

  const [customers, setCustomers] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showQRCamera, setShowQRCamera] = useState(false)
  const [qrScanning, setQrScanning] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState(null)
  const [pushingQuotations, setPushingQuotations] = useState(false)
  const [importingQuotations, setImportingQuotations] = useState(false)
  const importFileInputRef = useRef(null)

  // Valid Until = 15 days from today by default
  const getDefaultValidUntil = () => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState({
    customer: '',
    salesman: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    validUntil: getDefaultValidUntil(),
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
    status: 'Draft',
    notes: '',
  })

  useEffect(() => {
    loadQuotes()
    loadCustomers()
    loadSalesmen()
    loadProducts()
  }, [selectedStatus])

  const loadSalesmen = async () => {
    try {
      const result = await getUsers({ role: 'salesman' })
      if (result.success && result.data) {
        setSalesmen(result.data)
      } else {
        setSalesmen([])
      }
    } catch (error) {
      console.error('Error loading salesmen:', error)
      setSalesmen([])
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadQuotes()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadQuotes = async () => {
    setLoading(true)
    try {
      const result = await getQuotations({
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        search: searchTerm || undefined,
      })
      if (result.success && result.data) {
        setQuotes(result.data)
      } else {
        console.error('Error loading quotes:', result.message)
        setQuotes([])
      }
    } catch (error) {
      console.error('Error loading quotes:', error)
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }

  // Client-side filtering for instant feedback (API also filters)
  const filterQuotes = () => {
    let filtered = [...quotes]

    // Search filter (client-side for instant feedback)
    if (searchTerm) {
      filtered = filtered.filter(quote =>
        quote.quotationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter is handled by API, but keep for consistency
    if (selectedStatus !== 'All') {
      filtered = filtered.filter(quote => quote.status === selectedStatus)
    }

    return filtered
  }

  const loadCustomers = async () => {
    try {
      const result = await getCustomers()
      if (result.success && result.data) {
        setCustomers(result.data.map((c, index) => ({
          id: c._id || c.id || index + 1,
          _id: c._id || c.id,
          name: c.firstName || c.name || '',
          email: c.email || '',
        })))
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const result = await getProducts()
      if (result.success && result.data) {
        // Filter out inactive products - only show active products
        const activeProducts = result.data
          .filter(p => p.isActive !== false) // Only include active products (default to true if not specified)
          .map(p => ({
            id: p._id || p.id,
            _id: p._id || p.id,
            name: p.name,
            code: p.productCode,
            price: p.price,
            productCode: p.productCode,
            category: p.category,
            isActive: p.isActive !== false,
          }))
        setProducts(activeProducts)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'customer') {
      const selectedCustomer = customers.find(c => c.id === value || c._id === value)
      setFormData({
        ...formData,
        customer: value,
        customerName: selectedCustomer?.name || '',
        customerEmail: selectedCustomer?.email || '',
        customerPhone: selectedCustomer?.phone || '',
      })
    } else {
      setFormData({
        ...formData,
        [name]: value,
      })
    }
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

  const handleProductSelect = (itemId, productId) => {
    const updatedItems = formData.lineItems.map((item) => {
      if (item.id === itemId) {
        if (!productId) {
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
          
          const finalProductId = product._id || product.id || productId
          
          return {
            ...item,
            product: finalProductId,
            productId: finalProductId,
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

  const handleQRScanClick = () => {
    if (!showCreateModal) {
      setShowCreateModal(true)
    }
    setShowQRCamera(true)
  }

  const handleQRCameraScan = async (scannedCode) => {
    setShowQRCamera(false)
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
            }
            
            handleAddFromQR(product)
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
          price: result.data.price,
          productCode: result.data.productCode,
        }
        
        handleAddFromQR(product)
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
    
    setShowCreateModal(true)
  }

  const generateQuotationNumber = () => {
    const prefix = 'QUO'
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    return `${prefix}${randomNum}`
  }

  const handleCreateQuote = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!formData.customer && !formData.customerName) {
      alert('Please select or enter a customer')
      return
    }

    // Validate line items
    const validItems = formData.lineItems.filter(item => {
      const hasProduct = item.product || item.productId
      const hasValidQuantity = item.quantity > 0
      return hasProduct && hasValidQuantity
    })
    
    if (validItems.length === 0) {
      alert('Please add at least one product to the quotation')
      return
    }

    setLoading(true)
    try {
      const selectedCustomer = customers.find((c) => c.id === formData.customer || c._id === formData.customer)
      
      const validLineItems = formData.lineItems
        .filter(item => {
          const hasProduct = !!(item.productId || item.product)
          const hasValidQuantity = parseFloat(item.quantity) > 0
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

      const quotationData = {
        customerName: selectedCustomer?.name || formData.customerName || '',
        customerEmail: selectedCustomer?.email || formData.customerEmail || '',
        customerPhone: selectedCustomer?.phone || formData.customerPhone || '',
        customerAddress: formData.customerAddress || '',
        validUntil: formData.validUntil || '',
        items: validLineItems,
        subtotal: formData.subtotal,
        tax: formData.tax,
        total: formData.total,
        notes: formData.notes || '',
        status: formData.status || 'Sent',
        salesman: formData.salesman || undefined,
      }

      const result = await createQuotation(quotationData)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Quotation Created!',
          text: 'Quotation created successfully.',
          confirmButtonColor: '#e9931c'
        })
        setShowCreateModal(false)
        resetForm()
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to create quotation',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error creating quote:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating quotation. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!formData.customer && !formData.customerName) {
      alert('Please select or enter a customer name')
      return
    }

    setLoading(true)
    try {
      const selectedCustomer = customers.find((c) => c.id === formData.customer || c._id === formData.customer)
      
      const quotationData = {
        customerName: selectedCustomer?.name || formData.customerName || '',
        customerEmail: selectedCustomer?.email || formData.customerEmail || '',
        customerPhone: selectedCustomer?.phone || formData.customerPhone || '',
        customerAddress: formData.customerAddress || '',
        validUntil: formData.validUntil || '',
        items: formData.lineItems
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
        notes: formData.notes || '',
        status: 'Draft',
        salesman: formData.salesman || undefined,
      }

      const result = await createQuotation(quotationData)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Draft Saved!',
          text: 'Quotation saved as draft.',
          confirmButtonColor: '#e9931c'
        })
        setShowCreateModal(false)
        resetForm()
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to save draft',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error saving draft. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditQuote = async (quoteId) => {
    try {
      const result = await getQuotation(quoteId)
      if (result.success && result.data) {
        const quote = result.data
        setEditingQuotation(quote)
        setSelectedQuote(quote)
        
        // Find customer
        const customer = customers.find(c => 
          (c.name || '').toLowerCase() === (quote.customerName || '').toLowerCase()
        )
        
        setFormData({
          customer: customer?.id || customer?._id || '',
          salesman: quote.salesman?._id || quote.salesman?.id || quote.salesman || '',
          customerName: quote.customerName || '',
          customerEmail: quote.customerEmail || '',
          customerPhone: quote.customerPhone || '',
          customerAddress: quote.customerAddress || '',
          validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '',
          lineItems: quote.items && quote.items.length > 0 
            ? quote.items.map((item, index) => ({
                id: index + 1,
                product: item.product?._id || item.productId || '',
                productId: item.product?._id || item.productId || '',
                productName: item.productName || item.name || '',
                quantity: item.quantity || 1,
                unitPrice: item.price || item.unitPrice || 0,
                discount: item.discount || 0,
                lineTotal: item.total || item.lineTotal || (item.quantity * (item.price || 0)),
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
          subtotal: quote.subtotal || 0,
          tax: quote.tax || 0,
          total: quote.total || 0,
          status: quote.status || 'Draft',
          notes: quote.notes || '',
        })
        setShowCreateModal(true)
      }
    } catch (error) {
      console.error('Error loading quote:', error)
      alert('Error loading quote details')
    }
  }

  const handleUpdateQuote = async (e) => {
    e.preventDefault()
    if (!editingQuotation) return

    // Validate line items
    const validItems = formData.lineItems.filter(item => {
      const hasProduct = item.product || item.productId
      const hasValidQuantity = item.quantity > 0
      return hasProduct && hasValidQuantity
    })
    
    if (validItems.length === 0) {
      alert('Please add at least one product to the quotation')
      return
    }

    setLoading(true)
    try {
      const selectedCustomer = customers.find((c) => c.id === formData.customer || c._id === formData.customer)
      
      const validLineItems = formData.lineItems
        .filter(item => {
          const hasProduct = !!(item.productId || item.product)
          const hasValidQuantity = parseFloat(item.quantity) > 0
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

      const quotationData = {
        customerName: selectedCustomer?.name || formData.customerName || '',
        customerEmail: selectedCustomer?.email || formData.customerEmail || '',
        customerPhone: selectedCustomer?.phone || formData.customerPhone || '',
        customerAddress: formData.customerAddress || '',
        validUntil: formData.validUntil || '',
        items: validLineItems,
        subtotal: formData.subtotal,
        tax: formData.tax,
        total: formData.total,
        notes: formData.notes || '',
        status: formData.status || 'Sent',
        salesman: formData.salesman || undefined,
      }

      const result = await updateQuotation(editingQuotation._id || editingQuotation.id, quotationData)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Quotation Updated!',
          text: 'Quotation updated successfully.',
          confirmButtonColor: '#e9931c'
        })
        setShowCreateModal(false)
        resetForm()
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Error updating quote',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error updating quote:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating quotation. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteQuote = async (quoteId) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete Quote?',
      text: 'Are you sure you want to delete this quote?',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280'
    })
    if (!confirm.isConfirmed) return

    setLoading(true)
    try {
      const result = await deleteQuotation(quoteId)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Quote Deleted!',
          text: 'Quote deleted successfully.',
          confirmButtonColor: '#e9931c'
        })
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Error deleting quote',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error deleting quote:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting quote',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  // Download quotation as text file
  const handleDownloadQuote = (quote) => {
    const lines = [
      `QUOTATION ${quote.quotationNumber || quote.quoteNumber || 'N/A'}`,
      '----------------------------------------',
      `Customer: ${quote.customerName || ''}`,
      `Email: ${quote.customerEmail || ''}`,
      `Phone: ${quote.customerPhone || quote.phone || ''}`,
      `Valid Until: ${quote.validUntil || ''}`,
      '----------------------------------------',
      'Items:',
      ...(quote.lineItems || []).map((item, i) =>
        `${i + 1}. ${item.productName || item.name || 'Item'} - Qty: ${item.quantity || 0} @ £${Number(item.unitPrice || 0).toFixed(2)} = £${Number(item.lineTotal || 0).toFixed(2)}`
      ),
      '----------------------------------------',
      `Subtotal: £${Number(quote.subtotal || 0).toFixed(2)}`,
      `Tax: £${Number(quote.tax || 0).toFixed(2)}`,
      `Total: £${Number(quote.total || 0).toFixed(2)}`,
      quote.notes ? `\nNotes: ${quote.notes}` : '',
    ].filter(Boolean)
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Quotation-${(quote.quotationNumber || quote.quoteNumber || 'quote').replace(/\s/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Push quotations to HubSpot
  const handlePushToHubSpot = async () => {
    setPushingQuotations(true)
    try {
      const result = await pushQuotationsToHubSpot(false, 0)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Pushed!',
          text: result.message || 'Quotations pushed to HubSpot successfully.',
          confirmButtonColor: '#e9931c'
        })
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push failed',
          text: result.message || 'Failed to push quotations to HubSpot.',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error pushing quotations:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing quotations. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingQuotations(false)
    }
  }

  // Parse CSV (customerName, customerEmail, notes) – simple comma split
  const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return []
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row = {}
      header.forEach((h, j) => { row[h] = values[j] ?? '' })
      rows.push(row)
    }
    return rows
  }

  const handleImportFile = async (e) => {
    const file = e.target?.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      Swal.fire({ icon: 'warning', title: 'Invalid file', text: 'Please select a CSV file.', confirmButtonColor: '#e9931c' })
      return
    }
    if (products.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No products', text: 'Add at least one product in the catalog before importing quotations.', confirmButtonColor: '#e9931c' })
      return
    }
    setImportingQuotations(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const nameKey = Object.keys(rows[0] || {}).find(k => /customer.*name|name/i.test(k)) || 'customername' in (rows[0] || {}) ? 'customername' : Object.keys(rows[0] || {})[0]
      const emailKey = Object.keys(rows[0] || {}).find(k => /email/i.test(k)) || 'customeremail'
      const notesKey = Object.keys(rows[0] || {}).find(k => /notes/i.test(k)) || 'notes'
      let created = 0
      const firstProduct = products[0]
      const unitPrice = Number(firstProduct?.price) || 0
      const validUntil = getDefaultValidUntil()
      for (const row of rows) {
        const customerName = (row[nameKey] || row.customername || row.customerName || '').trim()
        const customerEmail = (row[emailKey] || row.customeremail || row.customerEmail || '').trim()
        if (!customerName && !customerEmail) continue
        const quotationData = {
          customerName: customerName || 'Imported',
          customerEmail: customerEmail || '',
          validUntil,
          items: [{ productId: firstProduct._id || firstProduct.id, productName: firstProduct.name || '', quantity: 1, unitPrice, discount: 0, lineTotal: unitPrice }],
          subtotal: unitPrice,
          tax: unitPrice * 0.2,
          total: unitPrice * 1.2,
          notes: (row[notesKey] || row.notes || '').trim(),
          status: 'Draft'
        }
        const result = await createQuotation(quotationData)
        if (result.success) created++
      }
      setImportingQuotations(false)
      Swal.fire({
        icon: created > 0 ? 'success' : 'info',
        title: 'Import done',
        text: created > 0 ? `${created} quotation(s) created as draft.` : 'No rows imported. CSV should have customer name and email columns.',
        confirmButtonColor: '#e9931c'
      })
      loadQuotes()
    } catch (err) {
      console.error('Import error:', err)
      setImportingQuotations(false)
      Swal.fire({ icon: 'error', title: 'Import failed', text: err.message || 'Failed to import CSV.', confirmButtonColor: '#e9931c' })
    }
  }

  // Open WhatsApp with customer number and pre-filled message
  const handleSendQuoteWhatsApp = (quote) => {
    const phone = (quote.customerPhone || quote.phone || '').replace(/\D/g, '')
    if (!phone || phone.length < 10) {
      Swal.fire({
        icon: 'warning',
        title: 'Phone number missing',
        text: 'Customer phone number is required to send via WhatsApp. Please edit the quote and add customer phone.',
        confirmButtonColor: '#e9931c'
      })
      return
    }
    const num = phone.startsWith('0') ? '92' + phone.slice(1) : phone.length === 10 ? '92' + phone : phone
    const msg = `Hello, your quotation #${quote.quotationNumber || quote.quoteNumber || ''} is ready. Total: £${Number(quote.total || 0).toFixed(2)}. Please contact us for details.`
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const handleSendQuoteEmail = async (quote) => {
    if (!quote.customerEmail || !quote.customerEmail.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Email missing',
        text: 'Customer email is required to send quotation. Please edit the quote and add customer email.',
        confirmButtonColor: '#e9931c'
      })
      return
    }
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Send quotation?',
      text: `Send quotation #${quote.quotationNumber} to ${quote.customerEmail}?`,
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280'
    })
    if (!confirm.isConfirmed) return

    setLoading(true)
    try {
      const result = await sendQuotationEmail(quote._id || quote.id)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Sent!',
          text: 'Quotation sent to customer email successfully.',
          confirmButtonColor: '#e9931c'
        })
        loadQuotes()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to send quotation email.',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error sending quotation email:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error sending email. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewQuote = async (quoteId) => {
    try {
      const result = await getQuotation(quoteId)
      if (result.success && result.data) {
        // Show quote details in a modal or navigate to detail page
        alert(`Quote #${result.data.quotationNumber}\nCustomer: ${result.data.customerName}\nTotal: £${result.data.total}\nStatus: ${result.data.status}`)
      }
    } catch (error) {
      console.error('Error loading quote:', error)
      alert('Error loading quote details')
    }
  }

  const resetForm = () => {
    setFormData({
      customer: '',
      salesman: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      validUntil: getDefaultValidUntil(),
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
      status: 'Draft',
      notes: '',
    })
    setSelectedQuote(null)
    setEditingQuotation(null)
  }

  const handleSelectQuote = (quoteId) => {
    setSelectedQuotes(prev =>
      prev.includes(quoteId)
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    )
  }

  const handleSelectAll = () => {
    const filtered = filterQuotes()
    if (selectedQuotes.length === filtered.length) {
      setSelectedQuotes([])
    } else {
      setSelectedQuotes(filtered.map(q => q._id || q.id))
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800'
      case 'Sent':
        return 'bg-blue-100 text-blue-800'
      case 'Approved':
        return 'bg-green-100 text-green-800'
      case 'Rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredQuotes = filterQuotes()

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FaFileInvoice className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-600">Create and manage sales quotes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePushToHubSpot}
            disabled={pushingQuotations}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors text-sm"
            title="Push quotations to HubSpot"
          >
            {pushingQuotations ? (
              <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <FaCloudUploadAlt className="w-5 h-5" />
            )}
            <span>Push</span>
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importFileInputRef.current?.click()}
            disabled={importingQuotations}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-60 transition-colors text-sm"
            title="Import quotations from CSV"
          >
            {importingQuotations ? (
              <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <FaFileImport className="w-5 h-5" />
            )}
            <span>Import</span>
          </button>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors text-sm sm:text-base"
          >
            <FaPlus className="w-5 h-5" />
            <span>Create New Quote</span>
          </button>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FaCheckSquare className="w-4 h-4" />
            <span>Select</span>
          </button>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search quotes by quotation number, customer name, or email..."
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
      </div>

      {/* Quotes List or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quotes...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaFileInvoice className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No quotes found</h3>
          <p className="text-gray-600 mb-6">Create your first quote to get started.</p>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="px-6 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
          >
            Create New Quote
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuotes.map((quote) => (
            <div
              key={quote._id || quote.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedQuotes.includes(quote._id || quote.id)}
                    onChange={() => handleSelectQuote(quote._id || quote.id)}
                    className="w-5 h-5 text-[#e9931c] rounded focus:ring-[#e9931c]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">Quote #{quote.quotationNumber}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Customer</p>
                        <p className="font-medium text-gray-900">{quote.customerName}</p>
                        <p className="text-gray-600">{quote.customerEmail}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Created Date</p>
                        <p className="font-medium text-gray-900">
                          {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Amount</p>
                        <p className="font-bold text-lg text-[#e9931c]">
                          £{Number(quote.total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadQuote(quote)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download quotation"
                  >
                    <FaDownload className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleSendQuoteWhatsApp(quote)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Send to customer WhatsApp"
                  >
                    <FaWhatsapp className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleSendQuoteEmail(quote)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Send to customer email"
                  >
                    <FaPaperPlane className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleViewQuote(quote._id || quote.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View"
                  >
                    <FaEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEditQuote(quote._id || quote.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FaEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuote(quote._id || quote.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FaTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {quote.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {quote.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR Camera Scanner Modal */}
      {showQRCamera && (
        <QRCameraScanner
          onScanSuccess={handleQRCameraScan}
          onClose={() => {
            setShowQRCamera(false)
            if (!showCreateModal) {
              setShowCreateModal(true)
            }
          }}
        />
      )}

      {/* Create Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white w-full h-full max-w-full rounded-none min-h-[100dvh] max-h-[100dvh] sm:w-auto sm:h-auto sm:max-w-4xl sm:min-h-0 sm:max-h-[90vh] sm:rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-white border-b-2 border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-2xl">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingQuotation ? 'Edit Quotation' : 'Create New Quote'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {editingQuotation ? 'Update quotation details' : 'Fill in the quote details and send to customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body – scrollable so buttons stay visible at bottom */}
            <form onSubmit={editingQuotation ? handleUpdateQuote : handleCreateQuote} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Customer & Salesman Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <option value="">Search customers...</option>
                    {customers.map((customer) => (
                      <option key={customer.id || customer._id} value={customer.id || customer._id}>
                        {customer.name} {customer.email ? `(${customer.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salesman *
                  </label>
                  <select
                    name="salesman"
                    value={formData.salesman}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white"
                  >
                    <option value="">Select salesman...</option>
                    {salesmen.map((s) => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name || s.email} {s.email ? `(${s.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

              </div>
              {/* Modal Footer – always visible at bottom */}
              <div className="flex-shrink-0 flex flex-wrap gap-2 sm:gap-3 p-3 sm:p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-2xl sm:rounded-b-2xl pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-3 py-2 text-sm min-h-[36px] sm:px-4 sm:py-3 sm:min-h-[44px] sm:text-base bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
                  title="Save as Draft"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="px-3 py-2 text-sm min-h-[36px] sm:px-4 sm:py-3 sm:min-h-[44px] sm:text-base bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 min-w-0 px-3 py-2 text-sm min-h-[36px] sm:px-6 sm:py-3 sm:min-h-[44px] sm:text-base bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                  title={editingQuotation ? "Update Quote" : "Create Quote"}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="truncate">{editingQuotation ? 'Update Quote' : 'Create Quote'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Quotes
