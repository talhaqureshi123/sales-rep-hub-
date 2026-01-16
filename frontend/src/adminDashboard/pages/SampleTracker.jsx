import { useState, useEffect } from 'react'
import { FaFlask, FaSearch, FaEdit, FaTrash, FaEye, FaCheckCircle, FaClock, FaBox, FaPlus } from 'react-icons/fa'
import { getSamples, getSample, createSample, updateSample, deleteSample } from '../../services/adminservices/sampleService'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers } from '../../services/adminservices/customerService'
import { getProducts } from '../../services/adminservices/productService'

const SampleTracker = () => {
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [salesmen, setSalesmen] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  const statusOptions = [
    'All',
    'Pending',
    'Received',
    'Converted'
  ]

  const [formData, setFormData] = useState({
    status: 'Pending',
    customerFeedback: '',
    notes: '',
  })

  const [createFormData, setCreateFormData] = useState({
    salesman: '',
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    product: '',
    productName: '',
    productCode: '',
    quantity: 1,
    visitTarget: '',
    visitDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
  })

  useEffect(() => {
    loadSamples()
    loadSalesmen()
    loadCustomers()
    loadProducts()
  }, [selectedStatus])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadSamples()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadSalesmen = async () => {
    try {
      const result = await getUsers({ role: 'salesman' })
      if (result.success && result.data) {
        setSalesmen(result.data)
      }
    } catch (error) {
      console.error('Error loading salesmen:', error)
    }
  }

  const loadCustomers = async () => {
    try {
      const result = await getCustomers()
      if (result.success && result.data) {
        setCustomers(result.data)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const result = await getProducts()
      if (result.success && result.data) {
        setProducts(result.data)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadSamples = async () => {
    setLoading(true)
    try {
      const result = await getSamples({
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        search: searchTerm || undefined,
      })
      if (result.success && result.data) {
        setSamples(result.data)
      } else {
        console.error('Error loading samples:', result.message)
        setSamples([])
      }
    } catch (error) {
      console.error('Error loading samples:', error)
      setSamples([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleCreateInputChange = (e) => {
    const { name, value } = e.target
    setCreateFormData({
      ...createFormData,
      [name]: value,
    })

    // Auto-fill customer details when customer is selected
    if (name === 'customer' && value) {
      const selectedCustomer = customers.find(c => c._id === value)
      if (selectedCustomer) {
        setCreateFormData(prev => ({
          ...prev,
          customerName: selectedCustomer.name || selectedCustomer.firstName || '',
          customerEmail: selectedCustomer.email || '',
          customerPhone: selectedCustomer.phone || '',
        }))
      }
    }

    // Auto-fill product details when product is selected
    if (name === 'product' && value) {
      const selectedProduct = products.find(p => p._id === value)
      if (selectedProduct) {
        setCreateFormData(prev => ({
          ...prev,
          productName: selectedProduct.name || '',
          productCode: selectedProduct.productCode || '',
        }))
      }
    }
  }

  const handleCreateSample = async (e) => {
    e.preventDefault()
    if (!createFormData.salesman || !createFormData.customerName || !createFormData.productName) {
      alert('Please fill in all required fields (Salesman, Customer Name, Product Name)')
      return
    }

    setLoading(true)
    try {
      const result = await createSample(createFormData)
      if (result.success) {
        alert('Sample created successfully!')
        setShowCreateModal(false)
        resetCreateForm()
        loadSamples()
      } else {
        alert(result.message || 'Error creating sample')
      }
    } catch (error) {
      console.error('Error creating sample:', error)
      alert('Error creating sample')
    } finally {
      setLoading(false)
    }
  }

  const resetCreateForm = () => {
    setCreateFormData({
      salesman: '',
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      product: '',
      productName: '',
      productCode: '',
      quantity: 1,
      visitTarget: '',
      visitDate: new Date().toISOString().split('T')[0],
      expectedDate: '',
      notes: '',
    })
  }

  const handleEditSample = async (sampleId) => {
    try {
      const result = await getSample(sampleId)
      if (result.success && result.data) {
        setSelectedSample(result.data)
        setFormData({
          status: result.data.status || 'Pending',
          customerFeedback: result.data.customerFeedback || '',
          notes: result.data.notes || '',
        })
        setShowEditModal(true)
      }
    } catch (error) {
      console.error('Error loading sample:', error)
      alert('Error loading sample details')
    }
  }

  const handleUpdateSample = async (e) => {
    e.preventDefault()
    if (!selectedSample) return

    setLoading(true)
    try {
      const updateData = {
        status: formData.status,
        customerFeedback: formData.customerFeedback,
        notes: formData.notes,
      }

      if (formData.status === 'Received' && selectedSample.status !== 'Received') {
        updateData.receivedDate = new Date().toISOString()
      }
      if (formData.status === 'Converted' && selectedSample.status !== 'Converted') {
        updateData.convertedDate = new Date().toISOString()
      }

      const result = await updateSample(selectedSample._id, updateData)
      if (result.success) {
        alert('Sample updated successfully!')
        setShowEditModal(false)
        resetForm()
        loadSamples()
      } else {
        alert(result.message || 'Error updating sample')
      }
    } catch (error) {
      console.error('Error updating sample:', error)
      alert('Error updating sample')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSample = async (sampleId) => {
    if (!window.confirm('Are you sure you want to delete this sample?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteSample(sampleId)
      if (result.success) {
        alert('Sample deleted successfully!')
        loadSamples()
      } else {
        alert(result.message || 'Error deleting sample')
      }
    } catch (error) {
      console.error('Error deleting sample:', error)
      alert('Error deleting sample')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSample = async (sampleId) => {
    try {
      const result = await getSample(sampleId)
      if (result.success && result.data) {
        const sample = result.data
        alert(
          `Sample #${sample.sampleNumber}\n` +
          `Customer: ${sample.customerName}\n` +
          `Product: ${sample.productName}\n` +
          `Status: ${sample.status}\n` +
          `Visit Date: ${sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'N/A'}\n` +
          (sample.customerFeedback ? `Feedback: ${sample.customerFeedback}` : '')
        )
      }
    } catch (error) {
      console.error('Error loading sample:', error)
      alert('Error loading sample details')
    }
  }

  const resetForm = () => {
    setFormData({
      status: 'Pending',
      customerFeedback: '',
      notes: '',
    })
    setSelectedSample(null)
  }

  const getStatusColor = (sample) => {
    // Check if sample is overdue
    const isOverdue = checkIfOverdue(sample)
    if (isOverdue) {
      return 'bg-red-100 text-red-800'
    }
    
    switch (sample.status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'Received':
        return 'bg-blue-100 text-blue-800'
      case 'Converted':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const checkIfOverdue = (sample) => {
    if (!sample.expectedDate && !sample.receivedDate) {
      // If no expected date, check if visitDate is more than 7 days old and status is still Pending
      if (sample.status === 'Pending' && sample.visitDate) {
        const visitDate = new Date(sample.visitDate)
        const daysSinceVisit = (new Date() - visitDate) / (1000 * 60 * 60 * 24)
        return daysSinceVisit > 7
      }
      return false
    }
    
    const expectedDate = sample.expectedDate ? new Date(sample.expectedDate) : (sample.receivedDate ? new Date(sample.receivedDate) : null)
    if (!expectedDate) return false
    
    // If status is still Pending and expected date has passed
    if (sample.status === 'Pending' && expectedDate < new Date()) {
      return true
    }
    
    return false
  }

  const getDisplayStatus = (sample) => {
    if (checkIfOverdue(sample)) {
      return 'Overdue'
    }
    return sample.status
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending':
        return <FaClock className="w-4 h-4" />
      case 'Received':
        return <FaBox className="w-4 h-4" />
      case 'Converted':
        return <FaCheckCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const filteredSamples = samples

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FaFlask className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sample Tracker</h1>
            <p className="text-gray-600">Track samples and customer feedback.</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
        >
          <FaPlus className="w-4 h-4" />
          Create New Sample
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
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

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search samples by sample number, customer name, product name, or product code..."
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
      </div>

      {/* Samples List or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading samples...</p>
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaFlask className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No samples found</h3>
          <p className="text-gray-600">Samples will appear here when you log visits with samples.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSamples.map((sample) => {
            const isOverdue = checkIfOverdue(sample)
            const displayStatus = getDisplayStatus(sample)
            const givenDate = sample.visitDate ? new Date(sample.visitDate) : null
            const expectedDate = sample.expectedDate ? new Date(sample.expectedDate) : (sample.receivedDate ? new Date(sample.receivedDate) : null)
            
            return (
              <div
                key={sample._id || sample.id}
                className="bg-white border-l-4 border-red-500 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-5">
                  {/* Customer Name as Heading */}
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {sample.customerName}
                  </h3>
                  
                  {/* Product Name */}
                  <p className="text-sm text-gray-700 mb-3 font-medium">
                    {sample.productName}
                  </p>
                  
                  {/* Status Badge */}
                  <div className="mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(sample)}`}>
                      {displayStatus}
                    </span>
                  </div>
                  
                  {/* Quantity */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="text-sm font-semibold text-gray-900">{sample.quantity || 1}</p>
                  </div>
                  
                  {/* Given Date */}
                  {givenDate && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500">Given</p>
                      <p className="text-sm font-medium text-gray-900">
                        {givenDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  
                  {/* Expected Date */}
                  {expectedDate && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500">Expected</p>
                      <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                        {expectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteSample(sample._id || sample.id)}
                    className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
                  >
                    Delete Sample
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Sample Modal */}
      {showEditModal && selectedSample && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Edit Sample</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateSample} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sample Number</label>
                <input
                  type="text"
                  value={selectedSample.sampleNumber}
                  disabled
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                <input
                  type="text"
                  value={selectedSample.customerName}
                  disabled
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                <input
                  type="text"
                  value={selectedSample.productName}
                  disabled
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  {statusOptions.filter(s => s !== 'All').map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Feedback</label>
                <textarea
                  name="customerFeedback"
                  value={formData.customerFeedback}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter customer feedback"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter any notes about the sample"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    resetForm()
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sample Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Create New Sample</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetCreateForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateSample} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salesman *</label>
                  <select
                    name="salesman"
                    value={createFormData.salesman}
                    onChange={handleCreateInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select Salesman</option>
                    {salesmen.map((salesman) => (
                      <option key={salesman._id} value={salesman._id}>
                        {salesman.name || salesman.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                  <select
                    name="customer"
                    value={createFormData.customer}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select Customer (Optional)</option>
                    {customers.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    name="customerName"
                    value={createFormData.customerName}
                    onChange={handleCreateInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={createFormData.customerEmail}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
                  <input
                    type="text"
                    name="customerPhone"
                    value={createFormData.customerPhone}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                  <select
                    name="product"
                    value={createFormData.product}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select Product (Optional)</option>
                    {products.filter(p => p.isActive).map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name} ({product.productCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                  <input
                    type="text"
                    name="productName"
                    value={createFormData.productName}
                    onChange={handleCreateInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter product name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Code</label>
                  <input
                    type="text"
                    name="productCode"
                    value={createFormData.productCode}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter product code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={createFormData.quantity}
                    onChange={handleCreateInputChange}
                    min="1"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visit Date (Given)</label>
                  <input
                    type="date"
                    name="visitDate"
                    value={createFormData.visitDate}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Date</label>
                  <input
                    type="date"
                    name="expectedDate"
                    value={createFormData.expectedDate}
                    onChange={handleCreateInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={createFormData.notes}
                  onChange={handleCreateInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter any notes about the sample"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetCreateForm()
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SampleTracker
