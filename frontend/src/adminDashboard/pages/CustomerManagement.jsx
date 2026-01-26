import { useState, useEffect } from 'react'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomersBySalesman, getCustomerDetails } from '../../services/adminservices/customerService'
import { getUsers } from '../../services/adminservices/userService'
import { getHubSpotCustomers, importHubSpotCustomersToDb, pushCustomersToHubSpot } from '../../services/adminservices/hubspotService'
import { FaUsers, FaSearch, FaFilter, FaTh, FaMapMarkerAlt, FaWhatsapp, FaEnvelope, FaCloudDownloadAlt, FaDatabase, FaTasks, FaFlask, FaShoppingCart, FaBuilding, FaPhone, FaUser, FaTimes, FaCalendarAlt, FaClock, FaCheckCircle, FaExclamationTriangle, FaRoute, FaFileAlt, FaSpinner, FaInfoCircle, FaLink, FaChevronLeft, FaChevronRight, FaArrowUp, FaEdit, FaTrash } from 'react-icons/fa'
import Swal from 'sweetalert2'

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [hubspotImporting, setHubspotImporting] = useState(false)
  const [hubspotPushing, setHubspotPushing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [filterSalesman, setFilterSalesman] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'map'
  const [userRole, setUserRole] = useState(null) // Current user role
  // Customer Detail Modal State
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerDetailData, setCustomerDetailData] = useState(null)
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false)
  const [customerDetailTab, setCustomerDetailTab] = useState('overview') // 'overview', 'tasks', 'visits', 'samples', 'quotations', 'orders'
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  // My Contacts Only (HubSpot) - Always true for import
  const [myContactsOnly] = useState(true)

  const [formData, setFormData] = useState({
    firstName: '',
    contactPerson: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    orderPotential: '',
    monthlySpend: 0,
    status: 'Not Visited',
    notes: '',
    competitorInfo: '',
    view: 'admin_salesman', // View access: 'admin', 'salesman', 'admin_salesman'
  })

  const statusOptions = [
    { value: 'All', label: 'All' },
    { value: 'Not Visited', label: 'Not Visited' },
    { value: 'Visited', label: 'Visited' },
    { value: 'Follow-up Needed', label: 'Follow-up Needed' },
    { value: 'Qualified Lead', label: 'Qualified Lead' },
    { value: 'Not Interested', label: 'Not Interested' },
  ]

  // Load data on mount
  useEffect(() => {
    // Get current user role
    const role = localStorage.getItem('userRole')
    setUserRole(role)
    loadCustomers()
    loadSalesmen()
  }, [])

  // Reload when filters change
  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadCustomers()
  }, [filterSalesman, filterStatus, searchTerm])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterSalesman) params.salesman = filterSalesman
      if (filterStatus && filterStatus !== 'All') params.status = filterStatus
      if (searchTerm) params.search = searchTerm

      const result = await getCustomers(params)
      if (result.success && result.data) {
        setCustomers(result.data)
      } else {
        console.error('Failed to load customers:', result.message)
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

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


  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const customerData = {
        firstName: formData.firstName,
        name: formData.firstName, // Keep name for backward compatibility
        contactPerson: formData.contactPerson,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        postcode: formData.postcode,
        orderPotential: formData.orderPotential,
        monthlySpend: formData.monthlySpend || 0,
        status: formData.status,
        notes: formData.notes,
        competitorInfo: formData.competitorInfo,
        assignedSalesman: formData.assignedSalesman || null,
        view: formData.view || 'admin_salesman',
      }

      const result = await createCustomer(customerData)
      
      if (result.success) {
        setShowAddForm(false)
        resetForm()
        await loadCustomers()
        Swal.fire({
          icon: 'success',
          title: 'Customer Added!',
          text: 'Customer added successfully!',
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to create customer',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating customer',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditCustomer = (customer) => {
    // HubSpot-imported customers can be edited (they're in DB now)
    setEditingCustomer(customer)
    setFormData({
      firstName: customer.firstName || customer.name || '',
      contactPerson: customer.contactPerson || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      postcode: customer.postcode || customer.pincode || '',
      orderPotential: customer.orderPotential || '',
      monthlySpend: customer.monthlySpend || 0,
      status: customer.status || 'Not Visited',
      notes: customer.notes || '',
      competitorInfo: customer.competitorInfo || '',
      view: customer.view || 'admin_salesman',
    })
    setShowAddForm(true)
  }

  const handleUpdateCustomer = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const customerData = {
        firstName: formData.firstName,
        name: formData.firstName, // Keep name for backward compatibility
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        postcode: formData.postcode,
        orderPotential: formData.orderPotential,
        monthlySpend: formData.monthlySpend || 0,
        status: formData.status,
        notes: formData.notes,
        competitorInfo: formData.competitorInfo,
        assignedSalesman: formData.assignedSalesman || null,
        view: formData.view || 'admin_salesman',
      }

      const result = await updateCustomer(editingCustomer._id, customerData)
      
      if (result.success) {
        setShowAddForm(false)
        resetForm()
        await loadCustomers()
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Customer updated successfully!',
          confirmButtonColor: '#e9931c',
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to update customer',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Error updating customer')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCustomer = async (id) => {
    if (String(id || '').startsWith('hubspot:')) {
      Swal.fire({
        icon: 'info',
        title: 'Cannot Delete',
        text: 'HubSpot contact cannot be deleted from here. Switch to DB Customers to delete local customers.',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    const confirmResult = await Swal.fire({
      icon: 'warning',
      title: 'Delete Customer?',
      text: 'Are you sure you want to delete this customer? This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })

    if (!confirmResult.isConfirmed) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteCustomer(id)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Customer Deleted!',
          text: 'Customer deleted successfully!',
          confirmButtonColor: '#e9931c'
        })
        loadCustomers()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to delete customer',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting customer',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  // Load customer details with all related data
  const loadCustomerDetails = async (customerId) => {
    setLoadingCustomerDetails(true)
    try {
      const result = await getCustomerDetails(customerId)
      if (result.success && result.data) {
        setCustomerDetailData(result.data)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Failed to load customer details',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error loading customer details:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading customer details',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoadingCustomerDetails(false)
    }
  }

  // Handle customer click - open detail modal
  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer)
    setShowCustomerDetailModal(true)
    setCustomerDetailTab('overview')
    loadCustomerDetails(customer._id)
  }

  const handleImportHubSpotContacts = async () => {
    setHubspotImporting(true)
    try {
      // Always import "My Contacts Only" (myContactsOnly is always true)
      const result = await importHubSpotCustomersToDb(true)
      if (result?.success) {
        const meta = result?.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          html: `
            <div style="text-align: left;">
              <p><strong>Imported from HubSpot (My Contacts Only):</strong> ${meta.fetchedFromHubSpot || 0}</p>
              <p><strong>Created:</strong> ${meta.created || 0}</p>
              <p><strong>Updated:</strong> ${meta.updated || 0}</p>
              <p><strong>Skipped (no email):</strong> ${meta.skipped || 0}</p>
              <p class="text-blue-600 font-semibold mt-2">✓ Only MY contacts imported</p>
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
        await loadCustomers()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: result?.message || 'Failed to import HubSpot contacts',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error('Error importing HubSpot contacts:', e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error importing HubSpot contacts',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setHubspotImporting(false)
    }
  }

  // Push single customer to HubSpot
  const handlePushSingleCustomer = async (customer, e) => {
    if (e) {
      e.stopPropagation()
    }

    if (!customer.email) {
      Swal.fire({
        icon: 'warning',
        title: 'Email Required',
        text: 'Customer must have an email address to push to HubSpot',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    setHubspotPushing(true)
    try {
      // Always push with myContactsOnly=true (assign to current user)
      const result = await pushCustomersToHubSpot(false, 0, true, [customer._id])
      
      if (result?.success && result?.data?.synced > 0) {
        Swal.fire({
          icon: 'success',
          title: 'Pushed to HubSpot!',
          text: `${customer.name || customer.firstName} has been pushed to HubSpot and assigned to your contacts.`,
          confirmButtonColor: '#e9931c'
        })
        // Reload to refresh customer list
        await loadCustomers()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push Failed',
          text: result?.message || 'Failed to push customer to HubSpot',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error('Error pushing customer to HubSpot:', e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing customer to HubSpot',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setHubspotPushing(false)
    }
  }

  const getSalesmanInfo = (salesmanId) => {
    return salesmen.find(s => s._id === salesmanId || s.id === salesmanId)
  }

  const resetForm = () => {
    setEditingCustomer(null)
    setFormData({
      firstName: '',
      contactPerson: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      postcode: '',
      orderPotential: '',
      monthlySpend: 0,
      status: 'Not Visited',
      notes: '',
      competitorInfo: '',
      view: 'admin_salesman',
    })
    setShowAddForm(false)
    setLoading(false)
  }


  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
      case 'Visited':
      case 'Qualified Lead':
        return 'bg-green-100 text-green-800'
      case 'Not Visited':
        return 'bg-yellow-100 text-yellow-800'
      case 'Follow-up Needed':
        return 'bg-blue-100 text-blue-800'
      case 'Not Interested':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getWhatsAppHref = (phone) => {
    if (!phone) return null
    const digits = String(phone).replace(/\D/g, '')
    if (!digits) return null
    return `https://wa.me/${digits}`
  }

  const getEmailHref = (email, customerName = '') => {
    if (!email) return null
    const to = String(email).trim()
    if (!to) return null
    const subject = encodeURIComponent(`Regarding ${customerName || 'your order'}`)
    const body = encodeURIComponent(`Hi ${customerName || ''},\n\n`)
    return `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>

        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
          {/* Import HubSpot Contacts Button */}
          <button
            onClick={handleImportHubSpotContacts}
            disabled={hubspotImporting || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Import My Contacts from HubSpot"
          >
            {hubspotImporting ? (
              <>
                <FaSpinner className="w-4 h-4 animate-spin" />
                <span className="whitespace-nowrap">Importing...</span>
              </>
            ) : (
              <>
                <FaCloudDownloadAlt className="w-4 h-4" />
                <span className="whitespace-nowrap">Import My Contacts</span>
              </>
            )}
          </button>

          {/* Add Customer Button */}
          <button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-[#e9931c] text-white rounded-xl font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Add Customer"
          >
            <span className="text-lg leading-none">+</span>
            <span className="whitespace-nowrap">Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <FaFilter className="text-gray-500" />
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === option.value
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterSalesman}
              onChange={(e) => setFilterSalesman(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
            >
              <option value="">All Potential</option>
              {salesmen.map((salesman) => (
                <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                  {salesman.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-gray-200 text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FaTh className="w-4 h-4 inline mr-2" />
            Grid View
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'map'
                ? 'bg-gray-200 text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FaMapMarkerAlt className="w-4 h-4 inline mr-2" />
            Map View
          </button>
        </div>
      </div>

      {/* Add/Edit Customer Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter contact person name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="e.g., LE4 0JP, SW1A 1AA"
                />
                <p className="mt-1 text-xs text-gray-500">UK postcode for accurate directions</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Potential</label>
                <select
                  name="orderPotential"
                  value={formData.orderPotential}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select potential</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Very High">Very High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Spend (£)</label>
                <input
                  type="number"
                  name="monthlySpend"
                  value={formData.monthlySpend}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="Not Visited">Not Visited</option>
                  <option value="Visited">Visited</option>
                  <option value="Follow-up Needed">Follow-up Needed</option>
                  <option value="Qualified Lead">Qualified Lead</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter any notes about the customer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Competitor Info</label>
                <textarea
                  name="competitorInfo"
                  value={formData.competitorInfo}
                  onChange={handleInputChange}
                  rows="3"
                  disabled={loading}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Competitor prices, delivery schedules, weak points....."
                />
              </div>

              {/* View Access Dropdown - Only for Admin or Salesman */}
              {(userRole === 'admin' || userRole === 'salesman') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">View Access *</label>
                  <select
                    name="view"
                    value={formData.view}
                    onChange={handleInputChange}
                    disabled={loading}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="admin_salesman">Admin and Salesman</option>
                    <option value="admin">Admin Only</option>
                    <option value="salesman">Salesman Only</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Select who can view this customer</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customers List */}
      {loading && customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex justify-center mb-4">
            <FaUsers className="w-24 h-24 text-gray-300" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No customers found</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first customer.</p>
          <button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            className="px-6 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
          >
            + Add Customer
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          {/* Pagination Info and Controls */}
          <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-800">
                  {customers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                </span> to <span className="font-semibold text-gray-800">
                  {Math.min(currentPage * itemsPerPage, customers.length)}
                </span> of <span className="font-semibold text-gray-800">{customers.length}</span> customers
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Items per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c] text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((customer) => {
            // Note: assignedSalesman field was removed from Customer model
            // Salesmen are now linked through Tasks/FollowUps, not directly to customers
            // Check if customer has assignedSalesman in raw data (legacy data)
            const salesmanId = customer.assignedSalesman?._id || customer.assignedSalesman
            const salesman = salesmanId ? getSalesmanInfo(salesmanId) : null
            return (
              <div
                key={customer._id}
                className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={(e) => {
                  // Don't trigger if clicking on action buttons or links
                  if (e.target.closest('button') || e.target.closest('a')) {
                    return
                  }
                  handleCustomerClick(customer)
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg hover:text-[#e9931c] transition-colors">{customer.name || customer.firstName}</h3>
                    {customer.company && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <FaBuilding className="w-3 h-3" />
                        {customer.company}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Show "Push" button for app-created customers, "Imported" badge for HubSpot-imported customers */}
                    {customer?.source !== 'hubspot' ? (
                      <button
                        onClick={(e) => handlePushSingleCustomer(customer, e)}
                        disabled={hubspotPushing || !customer.email}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e9931c] text-white rounded-lg text-sm font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Push to HubSpot"
                      >
                        {hubspotPushing ? (
                          <FaSpinner className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <FaArrowUp className="w-3 h-3" />
                            Push
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                        Imported
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {customer.email && (
                    <p className="text-gray-600">
                      <span className="font-medium">Email:</span> {customer.email}
                    </p>
                  )}
                  {customer.phone && (
                    <p className="text-gray-600">
                      <span className="font-medium">Phone:</span> {customer.phone}
                    </p>
                  )}
                  {(customer.email || customer.phone) && (
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={getWhatsAppHref(customer.phone) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!getWhatsAppHref(customer.phone)) e.preventDefault()
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                          getWhatsAppHref(customer.phone)
                            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                        title="Send WhatsApp"
                      >
                        <FaWhatsapp />
                        WhatsApp
                      </a>
                      <a
                        href={getEmailHref(customer.email, customer.name) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!getEmailHref(customer.email, customer.name)) e.preventDefault()
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                          getEmailHref(customer.email, customer.name)
                            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                        title="Send Email"
                      >
                        <FaEnvelope />
                        Email
                      </a>
                    </div>
                  )}
                  {customer.address && (
                    <p className="text-gray-600">
                      <span className="font-medium">Address:</span> {customer.address}
                    </p>
                  )}
                  {salesman ? (
                    <p className="text-gray-600">
                      <span className="font-medium">Salesman:</span> {salesman.name || salesman.email || 'Unknown'}
                    </p>
                  ) : (
                    // Note: assignedSalesman field was removed - salesmen are linked through tasks/visits
                    <p className="text-gray-500 text-xs italic">
                      Salesman assigned through tasks/visits
                    </p>
                  )}
                  <div className="pt-2 flex items-center justify-between">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditCustomer(customer)
                        }}
                        className="p-2 text-[#e9931c] hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit Customer"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCustomer(customer._id)
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Customer"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </div>

          {/* Pagination Controls */}
          {customers.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-2 mt-6 bg-white p-4 rounded-lg border border-gray-200">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FaChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.ceil(customers.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first page, last page, current page, and pages around current
                    const totalPages = Math.ceil(customers.length / itemsPerPage)
                    return (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    )
                  })
                  .map((page, index, array) => {
                    // Add ellipsis if there's a gap
                    const showEllipsisBefore = index > 0 && page - array[index - 1] > 1
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsisBefore && (
                          <span className="px-2 text-gray-500">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                            currentPage === page
                              ? 'bg-[#e9931c] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    )
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(customers.length / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(customers.length / itemsPerPage)}
                className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <FaChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 text-center">
          <FaMapMarkerAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Map view coming soon...</p>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerDetailModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-slideUp my-auto">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <FaUser className="w-6 h-6 text-[#e9931c]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedCustomer.name || selectedCustomer.firstName || 'Customer'}</h3>
                    {selectedCustomer.email && (
                      <p className="text-sm text-orange-100 mt-0.5 flex items-center gap-1">
                        <FaEnvelope className="w-3 h-3" />
                        {selectedCustomer.email}
                      </p>
                    )}
                    {selectedCustomer.phone && (
                      <p className="text-xs text-orange-200 mt-0.5 flex items-center gap-1">
                        <FaPhone className="w-3 h-3" />
                        {selectedCustomer.phone}
                      </p>
                    )}
                    {selectedCustomer.company && (
                      <p className="text-xs text-orange-200 mt-0.5 flex items-center gap-1">
                        <FaBuilding className="w-3 h-3" />
                        {selectedCustomer.company}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCustomerDetailModal(false)
                    setSelectedCustomer(null)
                    setCustomerDetailData(null)
                    setCustomerDetailTab('overview')
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0 overflow-x-auto">
              <button
                onClick={() => setCustomerDetailTab('overview')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'overview'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaInfoCircle className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setCustomerDetailTab('tasks')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'tasks'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaTasks className="w-4 h-4" />
                Tasks ({customerDetailData?.counts?.tasks || 0})
              </button>
              <button
                onClick={() => setCustomerDetailTab('visits')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'visits'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaMapMarkerAlt className="w-4 h-4" />
                Visits ({customerDetailData?.counts?.visits || 0})
              </button>
              <button
                onClick={() => setCustomerDetailTab('samples')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'samples'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaFlask className="w-4 h-4" />
                Samples ({customerDetailData?.counts?.samples || 0})
              </button>
              <button
                onClick={() => setCustomerDetailTab('quotations')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'quotations'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaFileAlt className="w-4 h-4" />
                Quotations ({customerDetailData?.counts?.quotations || 0})
              </button>
              <button
                onClick={() => setCustomerDetailTab('orders')}
                className={`px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  customerDetailTab === 'orders'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaShoppingCart className="w-4 h-4" />
                Orders ({customerDetailData?.counts?.orders || 0})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingCustomerDetails ? (
                <div className="flex items-center justify-center py-12">
                  <FaSpinner className="w-8 h-8 text-[#e9931c] animate-spin mr-3" />
                  <p className="text-gray-600">Loading customer details...</p>
                </div>
              ) : customerDetailData ? (
                <>
                  {/* Overview Tab */}
                  {customerDetailTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Customer Information */}
                      <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <FaUser className="w-4 h-4 text-[#e9931c]" />
                          Customer Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 font-medium mb-1">Name</p>
                            <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer?.name || customerDetailData.customer?.firstName || 'N/A'}</p>
                          </div>
                          {customerDetailData.customer?.contactPerson && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1">Contact Person</p>
                              <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer.contactPerson}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.email && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                                <FaEnvelope className="w-3 h-3" />
                                Email
                              </p>
                              <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer.email}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.phone && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                                <FaPhone className="w-3 h-3" />
                                Phone
                              </p>
                              <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer.phone}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.company && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                                <FaBuilding className="w-3 h-3" />
                                Company
                              </p>
                              <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer.company}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.status && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(customerDetailData.customer.status)}`}>
                                {customerDetailData.customer.status}
                              </span>
                            </div>
                          )}
                          {customerDetailData.customer?.orderPotential && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1">Order Potential</p>
                              <p className="text-sm font-semibold text-gray-800">{customerDetailData.customer.orderPotential}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.monthlySpend !== undefined && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1">Monthly Spend</p>
                              <p className="text-sm font-semibold text-gray-800">₹{customerDetailData.customer.monthlySpend?.toLocaleString() || 0}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.address && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                                <FaMapMarkerAlt className="w-3 h-3" />
                                Address
                              </p>
                              <p className="text-sm text-gray-800">
                                {customerDetailData.customer.address}
                                {customerDetailData.customer.city && `, ${customerDetailData.customer.city}`}
                                {customerDetailData.customer.state && `, ${customerDetailData.customer.state}`}
                                {customerDetailData.customer.pincode && ` - ${customerDetailData.customer.pincode}`}
                                {customerDetailData.customer.postcode && ` - ${customerDetailData.customer.postcode}`}
                              </p>
                            </div>
                          )}
                          {customerDetailData.customer?.notes && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{customerDetailData.customer.notes}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.competitorInfo && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-gray-500 font-medium mb-1">Competitor Info</p>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{customerDetailData.customer.competitorInfo}</p>
                            </div>
                          )}
                          {customerDetailData.customer?.createdBy && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1">Created By</p>
                              <p className="text-sm font-semibold text-gray-800">
                                {customerDetailData.customer.createdBy?.name || 'N/A'}
                                {customerDetailData.customer.createdBy?.role && (
                                  <span className="ml-2 text-xs text-gray-500">({customerDetailData.customer.createdBy.role})</span>
                                )}
                              </p>
                            </div>
                          )}
                          {customerDetailData.customer?.createdAt && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                                <FaCalendarAlt className="w-3 h-3" />
                                Created At
                              </p>
                              <p className="text-sm font-semibold text-gray-800">
                                {new Date(customerDetailData.customer.createdAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FaTasks className="w-5 h-5 text-blue-600" />
                            <p className="text-xs font-medium text-blue-600">Tasks</p>
                          </div>
                          <p className="text-2xl font-bold text-blue-800">{customerDetailData.counts?.tasks || 0}</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FaMapMarkerAlt className="w-5 h-5 text-green-600" />
                            <p className="text-xs font-medium text-green-600">Visits</p>
                          </div>
                          <p className="text-2xl font-bold text-green-800">{customerDetailData.counts?.visits || 0}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FaFlask className="w-5 h-5 text-purple-600" />
                            <p className="text-xs font-medium text-purple-600">Samples</p>
                          </div>
                          <p className="text-2xl font-bold text-purple-800">{customerDetailData.counts?.samples || 0}</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FaFileAlt className="w-5 h-5 text-orange-600" />
                            <p className="text-xs font-medium text-orange-600">Quotations</p>
                          </div>
                          <p className="text-2xl font-bold text-orange-800">{customerDetailData.counts?.quotations || 0}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                          <div className="flex items-center gap-2 mb-2">
                            <FaShoppingCart className="w-5 h-5 text-indigo-600" />
                            <p className="text-xs font-medium text-indigo-600">Orders</p>
                          </div>
                          <p className="text-2xl font-bold text-indigo-800">{customerDetailData.counts?.orders || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tasks Tab */}
                  {customerDetailTab === 'tasks' && (
                    <div className="space-y-3">
                      {(!customerDetailData.relatedData?.tasks || customerDetailData.relatedData.tasks.length === 0) ? (
                        <div className="text-center py-12">
                          <FaTasks className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No tasks found for this customer</p>
                        </div>
                      ) : (
                        customerDetailData.relatedData.tasks.map((task) => (
                          <div key={task._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#e9931c] transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">{task.description || task.customerName || 'Task'}</p>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    task.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                    task.status === 'Today' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {task.status}
                                  </span>
                                  {task.type && (
                                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                      {task.type}
                                    </span>
                                  )}
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      task.priority === 'High' || task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {task.priority}
                                    </span>
                                  )}
                                </div>
                                {task.followUpNumber && (
                                  <p className="text-xs text-gray-500 mb-1">Follow-up #: {task.followUpNumber}</p>
                                )}
                                {task.notes && (
                                  <p className="text-sm text-gray-600 mb-2">{task.notes}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <FaClock className="w-3 h-3" />
                                      Due: {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {task.salesman && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="w-3 h-3" />
                                      {task.salesman.name}
                                    </span>
                                  )}
                                  {task.hubspotTaskId && (
                                    <span className="flex items-center gap-1 text-blue-600">
                                      <FaLink className="w-3 h-3" />
                                      HubSpot
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Visits Tab */}
                  {customerDetailTab === 'visits' && (
                    <div className="space-y-3">
                      {(!customerDetailData.relatedData?.visits || customerDetailData.relatedData.visits.length === 0) ? (
                        <div className="text-center py-12">
                          <FaMapMarkerAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No visits found for this customer</p>
                        </div>
                      ) : (
                        customerDetailData.relatedData.visits.map((visit) => (
                          <div key={visit._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#e9931c] transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">{visit.name || 'Visit'}</p>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    visit.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    visit.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {visit.status}
                                  </span>
                                </div>
                                {visit.address && (
                                  <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                                    <FaMapMarkerAlt className="w-3 h-3" />
                                    {visit.address}
                                    {visit.city && `, ${visit.city}`}
                                    {visit.state && `, ${visit.state}`}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {visit.visitDate && (
                                    <span className="flex items-center gap-1">
                                      <FaCalendarAlt className="w-3 h-3" />
                                      {new Date(visit.visitDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {visit.salesman && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="w-3 h-3" />
                                      {visit.salesman.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Samples Tab */}
                  {customerDetailTab === 'samples' && (
                    <div className="space-y-3">
                      {(!customerDetailData.relatedData?.samples || customerDetailData.relatedData.samples.length === 0) ? (
                        <div className="text-center py-12">
                          <FaFlask className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No samples found for this customer</p>
                        </div>
                      ) : (
                        customerDetailData.relatedData.samples.map((sample) => (
                          <div key={sample._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#e9931c] transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800 mb-1">{sample.customerName || 'Sample'}</p>
                                {sample.productName && (
                                  <p className="text-sm text-gray-600 mb-1">Product: {sample.productName}</p>
                                )}
                                {sample.sampleNumber && (
                                  <p className="text-xs text-gray-500 mb-1">Sample #: {sample.sampleNumber}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {sample.quantity && (
                                    <span>Quantity: {sample.quantity}</span>
                                  )}
                                  {sample.status && (
                                    <span className={`px-2 py-0.5 rounded ${
                                      sample.status === 'Converted' ? 'bg-green-100 text-green-700' :
                                      sample.status === 'Delivered' ? 'bg-blue-100 text-blue-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {sample.status}
                                    </span>
                                  )}
                                  {sample.visitDate && (
                                    <span className="flex items-center gap-1">
                                      <FaCalendarAlt className="w-3 h-3" />
                                      {new Date(sample.visitDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {sample.salesman && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="w-3 h-3" />
                                      {sample.salesman.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Quotations Tab */}
                  {customerDetailTab === 'quotations' && (
                    <div className="space-y-3">
                      {(!customerDetailData.relatedData?.quotations || customerDetailData.relatedData.quotations.length === 0) ? (
                        <div className="text-center py-12">
                          <FaFileAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No quotations found for this customer</p>
                        </div>
                      ) : (
                        customerDetailData.relatedData.quotations.map((quotation) => (
                          <div key={quotation._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#e9931c] transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">Quotation #{quotation.quotationNumber || 'N/A'}</p>
                                  {quotation.status && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      quotation.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                      quotation.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {quotation.status}
                                    </span>
                                  )}
                                </div>
                                {quotation.total !== undefined && (
                                  <p className="text-sm font-semibold text-gray-800 mb-1">Total: ₹{quotation.total?.toLocaleString() || 0}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {quotation.createdAt && (
                                    <span className="flex items-center gap-1">
                                      <FaCalendarAlt className="w-3 h-3" />
                                      {new Date(quotation.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {quotation.salesman && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="w-3 h-3" />
                                      {quotation.salesman.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Orders Tab */}
                  {customerDetailTab === 'orders' && (
                    <div className="space-y-3">
                      {(!customerDetailData.relatedData?.orders || customerDetailData.relatedData.orders.length === 0) ? (
                        <div className="text-center py-12">
                          <FaShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No orders found for this customer</p>
                        </div>
                      ) : (
                        customerDetailData.relatedData.orders.map((order) => (
                          <div key={order._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#e9931c] transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">Order #{order.soNumber || 'N/A'}</p>
                                  {order.orderStatus && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      order.orderStatus === 'Completed' ? 'bg-green-100 text-green-700' :
                                      order.orderStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {order.orderStatus}
                                    </span>
                                  )}
                                </div>
                                {order.grandTotal !== undefined && (
                                  <p className="text-sm font-semibold text-gray-800 mb-1">Total: ₹{order.grandTotal?.toLocaleString() || 0}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {order.orderDate && (
                                    <span className="flex items-center gap-1">
                                      <FaCalendarAlt className="w-3 h-3" />
                                      {new Date(order.orderDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {order.customerName && (
                                    <span className="flex items-center gap-1">
                                      <FaUser className="w-3 h-3" />
                                      {order.customerName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <FaInfoCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No customer details available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerManagement
