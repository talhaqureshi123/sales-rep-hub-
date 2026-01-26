import { useState, useEffect, useRef } from 'react'
import { 
  FaUpload, 
  FaFileInvoice, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock,
  FaPlus,
  FaTrash,
  FaEdit,
  FaSpinner,
  FaImage,
  FaFile,
  FaSearch,
  FaTasks,
  FaFlask,
  FaVideo,
  FaPlay,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt
} from 'react-icons/fa'
import { 
  getMySalesSubmissions, 
  createSalesSubmission, 
  updateSalesSubmission,
  deleteSalesSubmission,
  getMySalesSubmissionStats
} from '../../services/salemanservices/salesSubmissionService'
import { getMyCustomers } from '../../services/salemanservices/customerService'
import { createFollowUp } from '../../services/salemanservices/followUpService'
import { createSample } from '../../services/salemanservices/sampleService'
import { getMyProducts } from '../../services/salemanservices/productService'
import { getProductVideos } from '../../services/adminservices/productVideoService'
import Swal from 'sweetalert2'

const SalesSubmissions = () => {
  const [activeTab, setActiveTab] = useState('sales') // 'sales', 'tasks', 'samples'
  const [loading, setLoading] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [productVideos, setProductVideos] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerView, setShowCustomerView] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSubmission, setEditingSubmission] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [playingVideo, setPlayingVideo] = useState(null)
  const fileInputRef = useRef(null)

  const [salesFormData, setSalesFormData] = useState({
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    location: '', // Location field from visit target
    salesDate: new Date().toISOString().split('T')[0],
    salesAmount: 0,
    salesDescription: '',
    documents: []
  })

  const [taskFormData, setTaskFormData] = useState({
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    type: 'Call',
    priority: 'Medium',
    dueDate: '',
    dueTime: '09:00',
    description: '',
    notes: ''
  })

  const [sampleFormData, setSampleFormData] = useState({
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    product: '',
    productName: '',
    productCode: '',
    quantity: 1,
    visitDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: ''
  })

  const TASK_TYPES = ['Call', 'Email', 'Visit', 'Follow-up', 'Meeting', 'Other']
  const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

  const [filters, setFilters] = useState({
    status: 'All'
  })

  useEffect(() => {
    if (activeTab === 'sales') {
      loadSubmissions()
      loadStats()
      loadProductVideos()
    }
    loadCustomers()
    if (activeTab === 'samples') {
      loadProducts()
    }
  }, [filters, activeTab])

  // Check for visit target data on mount and when activeTab changes to 'sales'
  useEffect(() => {
    // Check for visit target data from SalesTracking (when Achievement button is clicked)
    const visitTargetData = localStorage.getItem('salesUploadVisitTarget')
    const shouldOpenForm = localStorage.getItem('openSalesUploadForm') === 'true'
    
    if (visitTargetData && shouldOpenForm && activeTab === 'sales' && customers.length > 0) {
      try {
        const visitTarget = JSON.parse(visitTargetData)
        
        // Try to find matching customer from loaded customers
        const matchingCustomer = customers.find(c => {
          const customerName = c.firstName || c.name || ''
          const visitName = visitTarget.customerName || visitTarget.name || ''
          return customerName.toLowerCase().trim() === visitName.toLowerCase().trim()
        })
        
        // Build location from visit target (address, city, state, pincode)
        const location = `${visitTarget.address || ''}, ${visitTarget.city || ''}, ${visitTarget.state || ''} ${visitTarget.pincode || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
        
        if (matchingCustomer) {
          // Auto-fill with matching customer
          handleCustomerSelect(matchingCustomer)
          // Also set location from visit target (not from customer)
          setSalesFormData(prev => ({
            ...prev,
            location: location
          }))
        } else {
          // Auto-fill with visit target data directly
          setSalesFormData(prev => ({
            ...prev,
            customerName: visitTarget.customerName || visitTarget.name || '',
            customerEmail: '', // Visit target doesn't have email
            customerPhone: '', // Visit target doesn't have phone
            location: location, // Location from visit target
            // Note: customer field will be empty if no match found
          }))
          setCustomerSearch(visitTarget.customerName || visitTarget.name || '')
        }
        
        // Ensure sales tab is active and open the form
        if (activeTab !== 'sales') {
          setActiveTab('sales')
        }
        setShowForm(true)
        
        // Clear the flags
        localStorage.removeItem('salesUploadVisitTarget')
        localStorage.removeItem('openSalesUploadForm')
      } catch (error) {
        console.error('Error parsing visit target data:', error)
        localStorage.removeItem('salesUploadVisitTarget')
        localStorage.removeItem('openSalesUploadForm')
      }
    }
  }, [activeTab, customers])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const filterParams = {}
      if (filters.status !== 'All') filterParams.status = filters.status

      const result = await getMySalesSubmissions(filterParams)
      if (result.success && result.data) {
        setSubmissions(result.data || [])
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getMySalesSubmissionStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadCustomers = async () => {
    try {
      const result = await getMyCustomers()
      if (result.success && result.data) {
        setCustomers(result.data || [])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const loadProducts = async () => {
    try {
      // For now, products will be entered manually
      // TODO: Add product service if needed
      setProducts([])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadProductVideos = async () => {
    try {
      const result = await getProductVideos()
      if (result.success && result.data) {
        setProductVideos(result.data || [])
      }
    } catch (error) {
      console.error('Error loading product videos:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const finalValue = type === 'checkbox' ? checked : value
    if (activeTab === 'sales') {
      setSalesFormData(prev => ({ ...prev, [name]: finalValue }))
    } else if (activeTab === 'tasks') {
      setTaskFormData(prev => ({ ...prev, [name]: finalValue }))
    } else if (activeTab === 'samples') {
      setSampleFormData(prev => ({ ...prev, [name]: finalValue }))
    }
  }

  const handleCustomerSelect = (customer) => {
    const customerData = {
      customer: customer._id || customer.id,
      customerName: customer.firstName || customer.name || '',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
    }
    if (activeTab === 'sales') {
      setSalesFormData(prev => ({ ...prev, ...customerData }))
    } else if (activeTab === 'tasks') {
      setTaskFormData(prev => ({ ...prev, ...customerData }))
    } else if (activeTab === 'samples') {
      setSampleFormData(prev => ({ ...prev, ...customerData }))
    }
    setSelectedCustomer(customer)
    setShowCustomerView(true)
    setShowCustomerDropdown(false)
    setCustomerSearch('')
  }

  const getEmbedUrl = (url) => {
    if (!url) return ''
    
    // YouTube URL patterns
    let videoId = null
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=)([^&?\s]+)/)
    if (watchMatch) {
      videoId = watchMatch[1]
    }
    
    const embedMatch = url.match(/(?:youtube\.com\/embed\/)([^&?\s]+)/)
    if (embedMatch) {
      videoId = embedMatch[1]
    }
    
    const shortMatch = url.match(/(?:youtu\.be\/)([^&?\s]+)/)
    if (shortMatch) {
      videoId = shortMatch[1]
    }
    
    if (videoId) {
      videoId = videoId.split('&')[0].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    
    // Vimeo
    const vimeoMatch = url.match(/(?:vimeo\.com\/)(?:.*\/)?(\d+)/)
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
    
    // Direct video
    if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      return url
    }
    
    if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
      return url
    }
    
    return url
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    const newDocuments = files.map(file => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      return new Promise((resolve) => {
        reader.onloadend = () => {
          resolve({
            fileName: file.name,
            fileUrl: reader.result,
            fileType: file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'document',
            uploadedAt: new Date().toISOString()
          })
        }
      })
    })

    Promise.all(newDocuments).then(docs => {
      setSalesFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...docs]
      }))
    })
  }

  const removeDocument = (index) => {
    setSalesFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (activeTab === 'sales') {
      if (!salesFormData.customerName || !salesFormData.salesDate || !salesFormData.salesAmount || !salesFormData.location) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please fill all required fields (Customer Name, Location, Sales Date, Sales Amount)',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      if (salesFormData.salesAmount <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Invalid Amount',
          text: 'Sales amount must be greater than 0',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      setLoading(true)
      try {
        let result
        if (editingSubmission) {
          result = await updateSalesSubmission(editingSubmission._id, salesFormData)
        } else {
          result = await createSalesSubmission(salesFormData)
        }

        if (result.success) {
          // Show achievement message with sales amount
          const salesAmount = salesFormData.salesAmount || 0
          Swal.fire({
            icon: 'success',
            title: '🎉 Sales Submitted Successfully!',
            html: `
              <div class="text-center">
                <p class="text-lg mb-3">Sales Amount: <strong>₹${salesAmount.toLocaleString()}</strong></p>
                <p class="text-sm text-gray-600 mb-2">Waiting for admin approval.</p>
                <p class="text-sm text-gray-600">Once approved, this will be added to your sales target!</p>
              </div>
            `,
            confirmButtonColor: '#e9931c',
            confirmButtonText: 'Great!'
          })
          resetForm()
          loadSubmissions()
          loadStats()
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: result.message || 'Failed to save submission',
            confirmButtonColor: '#e9931c'
          })
        }
      } catch (error) {
        console.error('Error saving submission:', error)
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error saving submission. Please try again.',
          confirmButtonColor: '#e9931c'
        })
      } finally {
        setLoading(false)
      }
    } else if (activeTab === 'tasks') {
      if (!taskFormData.customerName || !taskFormData.dueDate || !taskFormData.description) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please fill all required fields',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      setLoading(true)
      try {
        const result = await createFollowUp(taskFormData)
        if (result.success) {
          Swal.fire({
            icon: 'success',
            title: 'Task Created!',
            text: 'Task created successfully!',
            confirmButtonColor: '#e9931c'
          })
          resetForm()
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: result.message || 'Failed to create task',
            confirmButtonColor: '#e9931c'
          })
        }
      } catch (error) {
        console.error('Error creating task:', error)
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error creating task. Please try again.',
          confirmButtonColor: '#e9931c'
        })
      } finally {
        setLoading(false)
      }
    } else if (activeTab === 'samples') {
      if (!sampleFormData.customerName || !sampleFormData.productName) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please fill all required fields',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      setLoading(true)
      try {
        const result = await createSample(sampleFormData)
        if (result.success) {
          Swal.fire({
            icon: 'success',
            title: 'Sample Uploaded!',
            text: 'Sample uploaded successfully!',
            confirmButtonColor: '#e9931c'
          })
          resetForm()
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: result.message || 'Failed to upload sample',
            confirmButtonColor: '#e9931c'
          })
        }
      } catch (error) {
        console.error('Error uploading sample:', error)
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error uploading sample. Please try again.',
          confirmButtonColor: '#e9931c'
        })
      } finally {
        setLoading(false)
      }
    }
  }


  const handleEdit = (submission) => {
    if (submission.approvalStatus !== 'Pending') {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Edit',
        text: 'Only pending submissions can be edited',
        confirmButtonColor: '#e9931c'
      })
      return
    }
    setEditingSubmission(submission)
    setSalesFormData({
      customer: submission.customer?._id || submission.customer || '',
      customerName: submission.customerName || '',
      customerEmail: submission.customerEmail || '',
      customerPhone: submission.customerPhone || '',
      location: submission.location || '',
      salesDate: submission.salesDate ? new Date(submission.salesDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      salesAmount: submission.salesAmount || 0,
      salesDescription: submission.salesDescription || '',
      documents: submission.documents || []
    })
    setShowForm(true)
  }

  const handleDelete = async (submission) => {
    if (submission.approvalStatus !== 'Pending') {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Delete',
        text: 'Only pending submissions can be deleted',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Submission?',
      text: 'Are you sure you want to delete this sales submission?',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it'
    })

    if (result.isConfirmed) {
      try {
        const deleteResult = await deleteSalesSubmission(submission._id)
        if (deleteResult.success) {
          Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Sales submission deleted successfully',
            confirmButtonColor: '#e9931c'
          })
          loadSubmissions()
          loadStats()
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: deleteResult.message || 'Failed to delete submission',
            confirmButtonColor: '#e9931c'
          })
        }
      } catch (error) {
        console.error('Error deleting submission:', error)
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error deleting submission. Please try again.',
          confirmButtonColor: '#e9931c'
        })
      }
    }
  }

  const resetForm = () => {
    setSalesFormData({
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      location: '',
      salesDate: new Date().toISOString().split('T')[0],
      salesAmount: 0,
      salesDescription: '',
      documents: []
    })
    setTaskFormData({
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      type: 'Call',
      priority: 'Medium',
      dueDate: '',
      dueTime: '09:00',
      description: '',
      notes: ''
    })
    setSampleFormData({
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      product: '',
      productName: '',
      productCode: '',
      quantity: 1,
      visitDate: new Date().toISOString().split('T')[0],
      expectedDate: '',
      notes: ''
    })
    setEditingSubmission(null)
    setShowForm(false)
    setCustomerSearch('')
    setSelectedCustomer(null)
    setShowCustomerView(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved':
        return <FaCheckCircle className="w-5 h-5 text-green-600" />
      case 'Rejected':
        return <FaTimesCircle className="w-5 h-5 text-red-600" />
      default:
        return <FaClock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  const filteredCustomers = customers.filter(c => {
    const searchTerm = customerSearch.toLowerCase()
    const name = (c.firstName || c.name || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm)
  })

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 text-[#e9931c] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sales submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
            <FaUpload className="w-5 h-5 sm:w-6 sm:h-6 text-[#e9931c]" />
            Uploads
          </h2>
          <p className="text-sm sm:text-base text-gray-600">Upload sales, tasks, or samples for admin approval</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#e9931c] text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-[#d8820a] transition-colors w-full sm:w-auto justify-center"
        >
          <FaPlus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{showForm ? 'Cancel' : `Upload ${activeTab === 'sales' ? 'Sales' : activeTab === 'tasks' ? 'Task' : 'Sample'}`}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => {
              setActiveTab('sales')
              setShowForm(false)
            }}
            className={`flex-1 min-w-[120px] sm:min-w-0 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-colors flex items-center justify-center gap-2 flex-shrink-0 ${
              activeTab === 'sales'
                ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-50'
            }`}
          >
            <FaFileInvoice className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">Sales Upload</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('tasks')
              setShowForm(false)
            }}
            className={`flex-1 min-w-[120px] sm:min-w-0 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-colors flex items-center justify-center gap-2 flex-shrink-0 ${
              activeTab === 'tasks'
                ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-50'
            }`}
          >
            <FaTasks className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">Task Upload</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('samples')
              setShowForm(false)
              if (products.length === 0) {
                loadProducts()
              }
            }}
            className={`flex-1 min-w-[120px] sm:min-w-0 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-colors flex items-center justify-center gap-2 flex-shrink-0 ${
              activeTab === 'samples'
                ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-50'
            }`}
          >
            <FaFlask className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">Sample Track Upload</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards - Only for Sales */}
      {activeTab === 'sales' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-5 border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Total Submissions</p>
              <FaFileInvoice className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">{stats.total || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">All time</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 sm:p-5 border border-yellow-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Pending</p>
              <FaClock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-700">{stats.pending || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Awaiting approval</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 sm:p-5 border border-green-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Approved</p>
              <FaCheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-700">{stats.approved || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Approved sales</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 sm:p-5 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Total Amount</p>
              <FaFileInvoice className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-700">£{stats.approvedAmount?.toLocaleString() || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Approved sales</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {showForm && (
        <div className="bg-white rounded-lg p-4 sm:p-6 border-2 border-gray-200 shadow-lg">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
            {activeTab === 'sales' && (editingSubmission ? 'Edit Sales Submission' : 'Upload New Sales')}
            {activeTab === 'tasks' && 'Create New Task'}
            {activeTab === 'samples' && 'Upload Sample Track'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Common Customer Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerSearch || (activeTab === 'sales' ? salesFormData.customerName : activeTab === 'tasks' ? taskFormData.customerName : sampleFormData.customerName)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(true)
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Search customers..."
                required
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.map(customer => (
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location Field - Only for Sales Tab */}
            {activeTab === 'sales' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={salesFormData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter location (address, city, state, pincode)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Location from visit target (auto-filled from Achievement button)
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Email
                </label>
                <input
                  type="email"
                  name="customerEmail"
                  value={activeTab === 'sales' ? salesFormData.customerEmail : activeTab === 'tasks' ? taskFormData.customerEmail : sampleFormData.customerEmail}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  name="customerPhone"
                  value={activeTab === 'sales' ? salesFormData.customerPhone : activeTab === 'tasks' ? taskFormData.customerPhone : sampleFormData.customerPhone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                />
              </div>
            </div>

            {/* Sales Form Fields */}
            {activeTab === 'sales' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sales Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="salesDate"
                      value={salesFormData.salesDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sales Amount (£) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="salesAmount"
                      value={salesFormData.salesAmount}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Description
                  </label>
                  <textarea
                    name="salesDescription"
                    value={salesFormData.salesDescription}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Describe the sale..."
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Documents/Proof
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload invoices, receipts, or any proof of sale (Images, PDF, Documents)
                  </p>
                </div>

                {/* Uploaded Documents Preview */}
                {salesFormData.documents.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {salesFormData.documents.map((doc, index) => (
                      <div key={index} className="relative border-2 border-gray-200 rounded-lg p-2">
                        {doc.fileType === 'image' ? (
                          <img 
                            src={doc.fileUrl} 
                            alt={doc.fileName}
                            className="w-full h-32 object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                            <FaFile className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <p className="text-xs text-gray-600 mt-1 truncate">{doc.fileName}</p>
                        <button
                          type="button"
                          onClick={() => removeDocument(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <FaTrash className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Task Form Fields */}
            {activeTab === 'tasks' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="type"
                      value={taskFormData.type}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      required
                    >
                      {TASK_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="priority"
                      value={taskFormData.priority}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      required
                    >
                      {PRIORITIES.map(priority => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      value={taskFormData.dueDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Time
                    </label>
                    <input
                      type="time"
                      name="dueTime"
                      value={taskFormData.dueTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={taskFormData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="e.g., Follow up with customer for quote"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={taskFormData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Add any additional notes..."
                  />
                </div>
              </>
            )}

            {/* Sample Form Fields */}
            {activeTab === 'samples' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="productName"
                      value={sampleFormData.productName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Code
                    </label>
                    <input
                      type="text"
                      name="productCode"
                      value={sampleFormData.productCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      placeholder="Enter product code"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={sampleFormData.quantity}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visit Date
                    </label>
                    <input
                      type="date"
                      name="visitDate"
                      value={sampleFormData.visitDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expected Date
                    </label>
                    <input
                      type="date"
                      name="expectedDate"
                      value={sampleFormData.expectedDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={sampleFormData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Add any additional notes about the sample..."
                  />
                </div>
              </>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 sm:px-6 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm sm:text-base font-semibold hover:bg-gray-400 transition-colors w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 sm:px-6 py-2 bg-[#e9931c] text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FaUpload className="w-4 h-4" />
                    <span>
                      {activeTab === 'sales' && (editingSubmission ? 'Update Submission' : 'Submit for Approval')}
                      {activeTab === 'tasks' && 'Create Task'}
                      {activeTab === 'samples' && 'Upload Sample'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search - Only for Sales */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search submission number, customer name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c] w-full sm:w-auto"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {/* Table - Only for Sales */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {loading && submissions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="w-8 h-8 text-[#e9931c] animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <FaFileInvoice className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No sales submissions found</p>
              <p className="text-sm text-gray-500 mt-2">
                {filters.status !== 'All'
                  ? 'Try adjusting your filter'
                  : 'Upload your first sales submission to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      STATUS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      SUBMISSION NUMBER
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      CUSTOMER
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      SALES DATE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      AMOUNT
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      DOCUMENTS
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submissions.map((submission) => (
                    <tr 
                      key={submission._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(submission.approvalStatus)}`}>
                          {getStatusIcon(submission.approvalStatus)}
                          {submission.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-blue-600">
                          {submission.submissionNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <button
                            onClick={() => {
                              const customer = customers.find(c => 
                                (c._id || c.id) === submission.customer ||
                                (c.firstName || c.name) === submission.customerName
                              )
                              if (customer) {
                                setSelectedCustomer(customer)
                                setShowCustomerView(true)
                              }
                            }}
                            className="text-left hover:text-[#e9931c] transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-900">{submission.customerName}</p>
                            {submission.customerEmail && (
                              <p className="text-xs text-gray-500">{submission.customerEmail}</p>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">
                          {new Date(submission.salesDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-[#e9931c]">
                          £{submission.salesAmount?.toLocaleString() || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {submission.documents && submission.documents.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {submission.documents[0].fileType === 'image' ? (
                              <FaImage className="w-4 h-4 text-blue-600" />
                            ) : (
                              <FaFile className="w-4 h-4 text-gray-600" />
                            )}
                            <span className="text-xs text-gray-600">{submission.documents.length}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {submission.approvalStatus === 'Pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(submission)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(submission)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {submission.approvalStatus !== 'Pending' && (
                          <span className="text-xs text-gray-500">
                            {submission.approvalStatus === 'Approved' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Placeholder for Tasks and Samples tabs */}
      {(activeTab === 'tasks' || activeTab === 'samples') && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-600">
            {activeTab === 'tasks' 
              ? 'Use the "Upload Task" button above to create a new task. Tasks will be sent for admin approval.'
              : 'Use the "Upload Sample" button above to upload a sample track. Samples will be tracked for feedback.'}
          </p>
        </div>
      )}

      {/* Customer View Modal */}
      {showCustomerView && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <FaUser className="w-5 h-5 text-[#e9931c]" />
                Customer Details
              </h3>
              <button
                onClick={() => {
                  setShowCustomerView(false)
                  setSelectedCustomer(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <p className="text-gray-900 font-semibold">{selectedCustomer.firstName || selectedCustomer.name || 'N/A'}</p>
                </div>
                {selectedCustomer.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <FaEnvelope className="w-3 h-3" />
                      Email
                    </label>
                    <p className="text-gray-900">{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <FaPhone className="w-3 h-3" />
                      Phone
                    </label>
                    <p className="text-gray-900">{selectedCustomer.phone}</p>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <FaMapMarkerAlt className="w-3 h-3" />
                      Address
                    </label>
                    <p className="text-gray-900">{selectedCustomer.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Videos Section - Only for Sales Tab */}
      {activeTab === 'sales' && productVideos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FaVideo className="w-5 h-5 sm:w-6 sm:h-6 text-[#e9931c]" />
            Product Videos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productVideos.filter(v => v.isActive).slice(0, 6).map((video) => (
              <div
                key={video._id || video.id}
                className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-[#e9931c] transition-colors cursor-pointer"
                onClick={() => setPlayingVideo(video)}
              >
                <div className="relative aspect-video bg-gray-100">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FaVideo className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                    <FaPlay className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-semibold text-gray-800 text-sm mb-1">{video.title}</h4>
                  {video.category && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {video.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">{playingVideo.title}</h3>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              {(() => {
                const embedUrl = getEmbedUrl(playingVideo.videoUrl)
                const isDirectVideo = playingVideo.videoUrl?.match(/\.(mp4|webm|ogg)(\?.*)?$/i)
                
                if (isDirectVideo) {
                  return (
                    <video
                      controls
                      className="w-full h-full"
                      src={playingVideo.videoUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )
                } else {
                  return (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={playingVideo.title}
                    />
                  )
                }
              })()}
            </div>
            {playingVideo.description && (
              <p className="text-sm text-gray-600">{playingVideo.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesSubmissions
