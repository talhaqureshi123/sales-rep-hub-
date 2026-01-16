import { useState, useEffect } from 'react'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomersBySalesman } from '../../services/adminservices/customerService'
import { getUsers } from '../../services/adminservices/userService'
import { getHubSpotCustomers, importHubSpotCustomersToDb, pushCustomersToHubSpot } from '../../services/adminservices/hubspotService'
import { FaUsers, FaCheckSquare, FaFileExcel, FaSearch, FaFilter, FaTh, FaMapMarkerAlt, FaEdit, FaTrash, FaWhatsapp, FaEnvelope, FaSyncAlt, FaCloudDownloadAlt, FaDatabase } from 'react-icons/fa'

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([])
  const [dataSource, setDataSource] = useState('db') // 'db' | 'hubspot'
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [hubspotImporting, setHubspotImporting] = useState(false)
  const [hubspotFetching, setHubspotFetching] = useState(false)
  const [hubspotPushing, setHubspotPushing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [filterSalesman, setFilterSalesman] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'map'
  const [selectedCustomers, setSelectedCustomers] = useState([])

  const [formData, setFormData] = useState({
    firstName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    orderPotential: '',
    monthlySpend: 0,
    status: 'Not Visited',
    notes: '',
    competitorInfo: '',
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
    if (dataSource === 'hubspot') {
      loadHubSpotCustomers()
    } else {
      loadCustomers()
    }
    loadSalesmen()
  }, [])

  // Reload when filters change
  useEffect(() => {
    if (dataSource === 'hubspot') {
      loadHubSpotCustomers()
    } else {
      loadCustomers()
    }
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

  const mapHubSpotContactToCustomerRow = (c) => {
    const p = c?.properties || {}
    const firstname = (p.firstname || '').trim()
    const lastname = (p.lastname || '').trim()
    const fullName = `${firstname} ${lastname}`.trim()
    const email = (p.email || '').trim()
    const fallbackName = email ? email.split('@')[0] : 'HubSpot Contact'
    const name = fullName || firstname || lastname || fallbackName

    return {
      _id: `hubspot:${c?.id}`,
      hubspotId: c?.id,
      hubspotUrl: c?.url,
      source: 'hubspot',
      firstName: name,
      name,
      email: email || '',
      phone: (p.phone || '').trim(),
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      postcode: p.zip || '',
      company: p.company || '',
      status: 'HubSpot',
      assignedSalesman: null,
    }
  }

  const loadHubSpotCustomers = async () => {
    setHubspotFetching(true)
    try {
      const result = await getHubSpotCustomers()
      const rows = Array.isArray(result?.data) ? result.data.map(mapHubSpotContactToCustomerRow) : []

      let filtered = rows
      const q = String(searchTerm || '').trim().toLowerCase()
      if (q) {
        filtered = filtered.filter((r) => {
          return (
            (r.name || '').toLowerCase().includes(q) ||
            (r.email || '').toLowerCase().includes(q) ||
            (r.phone || '').toLowerCase().includes(q) ||
            (r.company || '').toLowerCase().includes(q)
          )
        })
      }

      // In HubSpot view, ignore salesman/status filters (keep UI stable)
      setCustomers(filtered)
    } catch (e) {
      console.error('Error fetching HubSpot customers:', e)
      setCustomers([])
    } finally {
      setHubspotFetching(false)
    }
  }

  const handleShowHubSpotContactsLive = async () => {
    setSelectedCustomers([])
    setViewMode('grid')
    setShowAddForm(false)
    setEditingCustomer(null)
    setDataSource('hubspot')
    // keep filters simple in HubSpot view
    setFilterSalesman('')
    setFilterStatus('All')
    await loadHubSpotCustomers()
  }

  const handleShowDbCustomers = async () => {
    setSelectedCustomers([])
    setDataSource('db')
    await loadCustomers()
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
      }

      const result = await createCustomer(customerData)
      
      if (result.success) {
        setShowAddForm(false)
        resetForm()
        await loadCustomers()
        alert('Customer added successfully!')
      } else {
        alert(result.message || 'Failed to create customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Error creating customer')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCustomer = (customer) => {
    if (customer?.source === 'hubspot' || String(customer?._id || '').startsWith('hubspot:')) {
      alert('HubSpot contact is read-only here. Import to DB if you want to edit in app.')
      return
    }
    setEditingCustomer(customer)
    setFormData({
      firstName: customer.firstName || customer.name || '',
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      postcode: customer.postcode || customer.pincode || '',
      orderPotential: customer.orderPotential || '',
      monthlySpend: customer.monthlySpend || 0,
      status: customer.status || 'Not Visited',
      notes: customer.notes || '',
      competitorInfo: customer.competitorInfo || '',
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
      }

      const result = await updateCustomer(editingCustomer._id, customerData)
      
      if (result.success) {
        setShowAddForm(false)
        resetForm()
        await loadCustomers()
        alert('Customer updated successfully!')
      } else {
        alert(result.message || 'Failed to update customer')
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
      alert('HubSpot contact cannot be deleted from here. Switch to DB Customers to delete local customers.')
      return
    }
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteCustomer(id)
      
      if (result.success) {
        alert('Customer deleted successfully!')
        loadCustomers()
      } else {
        alert(result.message || 'Failed to delete customer')
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Error deleting customer')
    } finally {
      setLoading(false)
    }
  }

  const handleImportHubSpotContacts = async () => {
    setHubspotImporting(true)
    try {
      const result = await importHubSpotCustomersToDb()
      if (result?.success) {
        const meta = result?.data || {}
        alert(
          `HubSpot contacts imported ✅\n\nFetched: ${meta.fetchedFromHubSpot ?? '-'}\nCreated: ${meta.created ?? '-'}\nUpdated: ${meta.updated ?? '-'}\nSkipped (no email): ${meta.skipped ?? '-'}`
        )
        await loadCustomers()
      } else {
        alert(result?.message || 'Failed to import HubSpot contacts')
      }
    } catch (e) {
      console.error('Error importing HubSpot contacts:', e)
      alert('Error importing HubSpot contacts')
    } finally {
      setHubspotImporting(false)
    }
  }

  const handlePushAppCustomersToHubSpot = async () => {
    setHubspotPushing(true)
    try {
      const result = await pushCustomersToHubSpot(false, 0)
      if (result?.success) {
        const meta = result?.data || {}
        alert(
          `Pushed App Customers to HubSpot ✅\n\nAttempted: ${meta.attempted ?? '-'}\nSynced: ${meta.synced ?? '-'}\nSkipped (no valid email): ${meta.skippedNoValidEmail ?? '-'}\nFailed: ${meta.failed ?? '-'}`
        )
      } else {
        alert(result?.message || 'Failed to push customers to HubSpot')
      }
    } catch (e) {
      console.error('Error pushing customers to HubSpot:', e)
      alert('Error pushing customers to HubSpot')
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
      email: '',
      phone: '',
      address: '',
      postcode: '',
      orderPotential: '',
      monthlySpend: 0,
      status: 'Not Visited',
      notes: '',
      competitorInfo: '',
    })
    setShowAddForm(false)
    setLoading(false)
  }

  const handleExportToExcel = () => {
    // Simple CSV export
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Address', 'Assigned Salesman', 'Status']
    const rows = customers.map(c => [
      c.name || '',
      c.email || '',
      c.phone || '',
      c.company || '',
      c.address || '',
      c.assignedSalesman?.name || 'Not Assigned',
      c.status || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    )
  }

  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([])
    } else {
      setSelectedCustomers(customers.map(c => c._id))
    }
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
          {/* Data source toggle */}
          <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={handleShowDbCustomers}
              disabled={dataSource === 'db' || loading || hubspotFetching}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                dataSource === 'db'
                  ? 'bg-[#e9931c] text-white'
                  : 'text-gray-700 hover:bg-orange-50'
              }`}
              title="Show customers from your app database"
            >
              <FaDatabase className="w-4 h-4" />
              <span className="whitespace-nowrap">App Customers</span>
            </button>
            <button
              onClick={handleShowHubSpotContactsLive}
              disabled={hubspotFetching || loading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                dataSource === 'hubspot'
                  ? 'bg-[#e9931c] text-white'
                  : 'text-gray-700 hover:bg-orange-50'
              }`}
              title="Fetch contacts live from HubSpot"
            >
              <FaCloudDownloadAlt className={`w-4 h-4 ${hubspotFetching ? 'animate-pulse' : ''}`} />
              <span className="whitespace-nowrap">
                {hubspotFetching ? 'Fetching...' : 'Live HubSpot'}
              </span>
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Select customers"
          >
            <FaCheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">Select</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Export customers"
          >
            <FaFileExcel className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">Export</span>
          </button>

          <button
            onClick={handleImportHubSpotContacts}
            disabled={hubspotImporting || loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Import HubSpot contacts into app database"
          >
            <FaSyncAlt className={`w-4 h-4 ${hubspotImporting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">
              {hubspotImporting ? 'Importing...' : 'Import HubSpot'}
            </span>
          </button>

          <button
            onClick={handlePushAppCustomersToHubSpot}
            disabled={dataSource === 'hubspot' || hubspotPushing || loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Push all existing app customers to HubSpot (requires valid email)"
          >
            <FaSyncAlt className={`w-4 h-4 ${hubspotPushing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">
              {hubspotPushing ? 'Pushing...' : 'Push to HubSpot'}
            </span>
          </button>

          <button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            disabled={dataSource === 'hubspot'}
            className="flex items-center gap-2 px-5 py-2 bg-[#e9931c] text-white rounded-xl font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title={dataSource === 'hubspot' ? 'Switch to App Customers to add' : 'Add Customer'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => {
            const salesman = getSalesmanInfo(customer.assignedSalesman?._id || customer.assignedSalesman)
            return (
              <div
                key={customer._id}
                className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer._id)}
                      onChange={() => handleSelectCustomer(customer._id)}
                      className="w-5 h-5 text-[#e9931c] rounded focus:ring-[#e9931c]"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{customer.name}</h3>
                      {customer.company && (
                        <p className="text-sm text-gray-500">{customer.company}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditCustomer(customer)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
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
                  {salesman && (
                    <p className="text-gray-600">
                      <span className="font-medium">Salesman:</span> {salesman.name}
                    </p>
                  )}
                  <div className="pt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 text-center">
          <FaMapMarkerAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Map view coming soon...</p>
        </div>
      )}
    </div>
  )
}

export default CustomerManagement
