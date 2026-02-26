import { useState, useEffect } from 'react'
import { getMyCustomers, createCustomer, updateCustomer, deleteCustomer, importCustomers } from '../../services/salemanservices/customerService'
import { FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaSpinner, FaFileExcel, FaCheckCircle, FaTimes, FaEdit, FaTrash } from 'react-icons/fa'
import Swal from 'sweetalert2'

const CustomerManagement = ({ openAddForm = false, onAddFormClose }) => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(openAddForm)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [userRole, setUserRole] = useState(null) // Current user role
  const [showImportExcelModal, setShowImportExcelModal] = useState(false)
  const [importExcelFile, setImportExcelFile] = useState(null)
  const [importExcelPreview, setImportExcelPreview] = useState([])
  const [importExcelLoading, setImportExcelLoading] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)

  // Map Excel header (any case, with spaces) to customer field name
  const excelHeaderToField = (header) => {
    if (!header || typeof header !== 'string') return null
    const key = header.trim().toLowerCase().replace(/\s+/g, ' ')
    const map = {
      'first name': 'firstName',
      'firstname': 'firstName',
      'name': 'firstName',
      'contact person': 'contactPerson',
      'contactperson': 'contactPerson',
      'company': 'company',
      'email': 'email',
      'phone': 'phone',
      'address': 'address',
      'city': 'city',
      'state': 'state',
      'pincode': 'postcode',
      'postcode': 'postcode',
      'pin code': 'postcode',
      'post code': 'postcode',
      'status': 'status',
      'notes': 'notes',
      'order potential': 'orderPotential',
      'orderpotential': 'orderPotential',
      'monthly spend': 'monthlySpend',
      'monthlyspend': 'monthlySpend',
      'competitor info': 'competitorInfo',
      'competitorinfo': 'competitorInfo',
    }
    return map[key] || (key.replace(/\s+/g, '') ? key.replace(/\s+/g, '') : null)
  }

  // Parse CSV text (first row = headers) into array of objects
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (!lines.length) return []
    const parseRow = (line) => {
      const out = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          inQuotes = !inQuotes
        } else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) {
          out.push(cur.trim())
          cur = ''
        } else {
          cur += c
        }
      }
      out.push(cur.trim())
      return out
    }
    const headerRow = parseRow(lines[0])
    const headers = headerRow.map((h) => excelHeaderToField(String(h).trim()) || String(h).trim())
    const preview = []
    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i])
      const obj = {}
      headers.forEach((field, j) => {
        const val = cells[j]
        if (field && val !== undefined && String(val).trim() !== '') {
          const trimmed = String(val).trim()
          obj[field] = field === 'monthlySpend' && !isNaN(Number(trimmed)) ? Number(trimmed) : trimmed
        }
      })
      if (obj.firstName || obj.name) {
        if (!obj.name && obj.firstName) obj.name = obj.firstName
        if (!obj.firstName && obj.name) obj.firstName = obj.name
        preview.push(obj)
      }
    }
    return preview
  }

  const handleExcelFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    if (!isCSV) {
      Swal.fire({
        icon: 'warning',
        title: 'Use CSV file',
        text: 'Please select a CSV file. In Excel: File → Save As → CSV (Comma delimited).',
        confirmButtonColor: '#e9931c',
      })
      return
    }
    setImportExcelFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result
        const preview = parseCSV(String(text))
        setImportExcelPreview(preview)
      } catch (err) {
        console.error('Parse error:', err)
        Swal.fire({
          icon: 'error',
          title: 'Parse error',
          text: err.message || 'Could not read file',
          confirmButtonColor: '#e9931c',
        })
        setImportExcelPreview([])
      }
    }
    reader.readAsText(file)
  }

  const handleImportExcelSubmit = async () => {
    if (!importExcelPreview.length) {
      Swal.fire({
        icon: 'warning',
        title: 'No data',
        text: 'No valid rows to import. Ensure the first row has headers (e.g. First Name, Email, Phone) and at least one data row.',
        confirmButtonColor: '#e9931c',
      })
      return
    }
    setImportExcelLoading(true)
    try {
      const result = await importCustomers(importExcelPreview)
      if (result.success) {
        const { createdCount = 0, skippedCount = 0 } = result.data || {}
        setShowImportExcelModal(false)
        setImportExcelFile(null)
        setImportExcelPreview([])
        loadCustomers()
        Swal.fire({
          icon: 'success',
          title: 'Import complete',
          html: `<p>Imported <strong>${createdCount}</strong> customer(s).</p>${skippedCount > 0 ? `<p>Skipped: ${skippedCount} row(s).</p>` : ''}`,
          confirmButtonColor: '#e9931c',
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Import failed',
          text: result.message || 'Failed to import customers',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (err) {
      console.error('Import error:', err)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Error importing customers',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setImportExcelLoading(false)
    }
  }

  const [geocodingAddress, setGeocodingAddress] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    contactPerson: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postcode: '',
    latitude: '',
    longitude: '',
    orderPotential: '',
    monthlySpend: 0,
    status: 'Not Visited',
    notes: '',
    competitorInfo: '',
    associatedContactName: '',
    associatedCompanyName: '',
    lastContact: '',
    lastEngagement: '',
    view: 'admin_salesman',
  })

  // Load data on mount
  useEffect(() => {
    // Get current user role
    const role = localStorage.getItem('userRole')
    setUserRole(role)
    loadCustomers()
  }, [])

  // Handle openAddForm prop change
  useEffect(() => {
    if (openAddForm) {
      setShowAddForm(true)
    }
  }, [openAddForm])

  // Whether this customer was created by the logged-in salesman (only they can edit/delete)
  const isCreatedByMe = (customer) => {
    const myId = localStorage.getItem('userId') || ''
    const createdById = (customer?.createdBy?._id || customer?.createdBy)?.toString?.() || (customer?.createdBy || '').toString()
    return !!myId && !!createdById && myId === createdById
  }

  // Handle form close
  const handleCloseForm = () => {
    setShowAddForm(false)
    setEditingCustomer(null)
    if (onAddFormClose) {
      onAddFormClose()
    }
  }

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer)
    setFormData({
      firstName: customer.firstName || customer.name || '',
      contactPerson: customer.contactPerson || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      postcode: customer.postcode || customer.pincode || '',
      latitude: customer.latitude != null ? String(customer.latitude) : '',
      longitude: customer.longitude != null ? String(customer.longitude) : '',
      orderPotential: customer.orderPotential || '',
      monthlySpend: customer.monthlySpend ?? 0,
      status: customer.status || 'Not Visited',
      notes: customer.notes || '',
      competitorInfo: customer.competitorInfo || '',
      associatedContactName: customer.associatedContactName || '',
      associatedCompanyName: customer.associatedCompanyName || '',
      lastContact: customer.lastContact ? (typeof customer.lastContact === 'string' ? customer.lastContact.slice(0, 10) : customer.lastContact?.toISOString?.()?.slice(0, 10)) : '',
      lastEngagement: customer.lastEngagement ? (typeof customer.lastEngagement === 'string' ? customer.lastEngagement.slice(0, 10) : customer.lastEngagement?.toISOString?.()?.slice(0, 10)) : '',
      view: customer.view || 'admin_salesman',
    })
    setShowAddForm(true)
  }

  const handleUpdateCustomer = async (e) => {
    e.preventDefault()
    if (!editingCustomer) return
    setLoading(true)
    try {
      const customerData = {
        firstName: formData.firstName,
        name: formData.firstName,
        contactPerson: formData.contactPerson,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postcode: formData.postcode,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        orderPotential: formData.orderPotential,
        monthlySpend: formData.monthlySpend || 0,
        status: formData.status,
        notes: formData.notes,
        competitorInfo: formData.competitorInfo,
        associatedContactName: formData.associatedContactName,
        associatedCompanyName: formData.associatedCompanyName,
        lastContact: formData.lastContact || undefined,
        lastEngagement: formData.lastEngagement || undefined,
        view: formData.view || 'admin_salesman',
      }
      const result = await updateCustomer(editingCustomer._id, customerData)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Updated!',
          text: 'Customer updated successfully.',
          confirmButtonColor: '#e9931c',
        })
        setEditingCustomer(null)
        handleCloseForm()
        loadCustomers()
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
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating customer',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCustomer = async (customer) => {
    const id = customer._id || customer.id
    if (!id) return
    const confirmResult = await Swal.fire({
      icon: 'warning',
      title: 'Delete Customer?',
      text: `Are you sure you want to delete "${customer.name || customer.firstName}"? This cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
    })
    if (!confirmResult.isConfirmed) return
    setLoading(true)
    try {
      const result = await deleteCustomer(id)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Customer deleted successfully.',
          confirmButtonColor: '#e9931c',
        })
        loadCustomers()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Could not delete customer',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting customer',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
    }
  }

  // Reload when filters change
  useEffect(() => {
    loadCustomers()
  }, [filterStatus, searchTerm])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (searchTerm) params.search = searchTerm

      const result = await getMyCustomers(params)
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleGeocodeAddress = async () => {
    const trim = (s) => (s != null && typeof s === 'string' ? s.trim() : '')
    const addressPart = trim(formData.address)
    const cityPart = trim(formData.city)
    const statePart = trim(formData.state)
    const parts = [addressPart, cityPart, statePart].filter(Boolean)
    if (!parts.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Address required',
        text: 'Please enter address (and optionally city, state) to auto-fill postcode and location.',
        confirmButtonColor: '#e9931c',
      })
      return
    }
    setGeocodingAddress(true)
    try {
      const doSearch = async (q) => {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
          { headers: { Accept: 'application/json', 'User-Agent': 'SalesRapHub/1.0' } }
        )
        return res.json()
      }
      let query = parts.join(', ')
      let searchData = await doSearch(query)
      if (!Array.isArray(searchData) || !searchData[0]?.lat || !searchData[0]?.lon) {
        const hasCountry = /pakistan|uk|united kingdom|india|uae|usa|germany|france|china|canada|australia|bangladesh|sri lanka|nepal|saudi|oman|qatar|bahrain|kuwait|turkey|malaysia|singapore/i.test(query)
        if (!hasCountry) {
          await new Promise((r) => setTimeout(r, 1100))
          searchData = await doSearch(query + ', Pakistan')
        }
      }
      if (!Array.isArray(searchData) || !searchData[0]?.lat || !searchData[0]?.lon) {
        const fallbackPart = (cityPart || statePart || '').trim()
        if (fallbackPart) {
          await new Promise((r) => setTimeout(r, 1100))
          searchData = await doSearch(fallbackPart)
          if (!Array.isArray(searchData) || !searchData[0]?.lat) {
            await new Promise((r) => setTimeout(r, 1100))
            searchData = await doSearch(fallbackPart + ', Pakistan')
          }
        }
      }
      if (!Array.isArray(searchData) || !searchData[0]?.lat || !searchData[0]?.lon) {
        Swal.fire({
          icon: 'info',
          title: 'Location not found',
          text: 'Could not find this address. Try adding city and country, then use "Auto-fill" again.',
          confirmButtonColor: '#e9931c',
        })
        setGeocodingAddress(false)
        return
      }
      const lat = parseFloat(searchData[0].lat)
      const lon = parseFloat(searchData[0].lon)
      await new Promise((r) => setTimeout(r, 1100))
      const reverseRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { Accept: 'application/json', 'User-Agent': 'SalesRapHub/1.0' } }
      )
      const reverseData = await reverseRes.json()
      const addr = reverseData?.address || {}
      const postcode = addr.postcode || addr.postal_code || ''
      const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || ''
      const state = addr.state || addr.region || ''
      setFormData((prev) => ({
        ...prev,
        postcode: postcode || prev.postcode,
        city: city || prev.city,
        state: state || prev.state,
        latitude: String(lat),
        longitude: String(lon),
      }))
      Swal.fire({
        icon: 'success',
        title: 'Location updated',
        text: postcode ? `Postcode ${postcode} and coordinates set from address.` : 'Latitude and longitude set from address.',
        confirmButtonColor: '#e9931c',
        timer: 2000,
        timerProgressBar: true,
      })
    } catch (err) {
      console.error('Geocode error:', err)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Could not fetch location. Please try again or enter postcode/lat-lng manually.',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setGeocodingAddress(false)
    }
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const customerData = {
        firstName: formData.firstName,
        name: formData.firstName,
        contactPerson: formData.contactPerson,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postcode: formData.postcode,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        orderPotential: formData.orderPotential,
        monthlySpend: formData.monthlySpend || 0,
        status: formData.status,
        notes: formData.notes,
        competitorInfo: formData.competitorInfo,
        associatedContactName: formData.associatedContactName,
        associatedCompanyName: formData.associatedCompanyName,
        lastContact: formData.lastContact || undefined,
        lastEngagement: formData.lastEngagement || undefined,
        view: formData.view || 'admin_salesman',
      }

      const result = await createCustomer(customerData)

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Customer Added!',
          text: 'Customer created successfully!',
          confirmButtonColor: '#e9931c',
        })
        setFormData({
          firstName: '',
          contactPerson: '',
          company: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          postcode: '',
          latitude: '',
          longitude: '',
          orderPotential: '',
          monthlySpend: 0,
          status: 'Not Visited',
          notes: '',
          competitorInfo: '',
          associatedContactName: '',
          associatedCompanyName: '',
          lastContact: '',
          lastEngagement: '',
          view: 'admin_salesman',
        })
        handleCloseForm()
        loadCustomers()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to create customer',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating customer',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
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
    <div className="p-2 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">Customer Management</h2>
        <p className="text-sm sm:text-base text-gray-600">Manage your customers</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c]"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c]"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowImportExcelModal(true)}
            className="flex-1 px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
          >
            <FaFileExcel className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="whitespace-nowrap">Import Excel</span>
          </button>
          <button
            onClick={() => {
              setEditingCustomer(null)
              setFormData({
                firstName: '',
                contactPerson: '',
                company: '',
                email: '',
                phone: '',
                address: '',
                city: '',
                state: '',
                postcode: '',
                latitude: '',
                longitude: '',
                orderPotential: '',
                monthlySpend: 0,
                status: 'Not Visited',
                notes: '',
                competitorInfo: '',
                associatedContactName: '',
                associatedCompanyName: '',
                lastContact: '',
                lastEngagement: '',
                view: 'admin_salesman',
              })
              setShowAddForm(true)
            }}
            className="flex-1 px-4 sm:px-6 py-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="whitespace-nowrap">Add Customer</span>
          </button>
        </div>
      </div>

      {/* Import from Excel Modal */}
      {showImportExcelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <FaFileExcel className="w-6 h-6 text-green-600" />
                Import customers from Excel
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowImportExcelModal(false)
                  setImportExcelFile(null)
                  setImportExcelPreview([])
                }}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                aria-label="Close"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Upload a <strong>CSV</strong> file. First row = headers. In Excel: File → Save As → CSV. Supported columns: <strong>First Name</strong>, Contact Person, Company, Email, Phone, Address, City, State, Pincode/Postcode, Status, Notes, Order Potential, Monthly Spend.
              </p>
              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleExcelFileSelect}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#e9931c] file:text-white file:font-semibold hover:file:bg-[#d8820a]"
                />
              </label>
              {importExcelFile && (
                <p className="text-sm text-gray-700">
                  File: <strong>{importExcelFile.name}</strong>
                </p>
              )}
              {importExcelPreview.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    Preview: {importExcelPreview.length} row(s) to import
                  </p>
                  <div className="max-h-40 overflow-y-auto text-xs text-gray-600">
                    {importExcelPreview.slice(0, 5).map((row, i) => (
                      <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                        {row.firstName || row.name} {row.email ? `(${row.email})` : ''}
                      </div>
                    ))}
                    {importExcelPreview.length > 5 && (
                      <p className="py-1 text-gray-500">... and {importExcelPreview.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  setShowImportExcelModal(false)
                  setImportExcelFile(null)
                  setImportExcelPreview([])
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportExcelSubmit}
                disabled={importExcelLoading || importExcelPreview.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importExcelLoading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="w-4 h-4" />
                    Import {importExcelPreview.length > 0 ? `(${importExcelPreview.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-white sm:bg-black/60 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto min-h-[100dvh]">
          <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-2xl shadow-xl overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0 pb-[env(safe-area-inset-bottom)] sm:pb-0">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b-2 border-gray-200">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingCustomer ? 'Update details of your customer.' : 'Customer will be visible to you. Admin approval is required for the company list.'}</p>
              </div>
              <button
                onClick={handleCloseForm}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-gray-500 hover:text-gray-700 rounded-lg"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={editingCustomer ? handleUpdateCustomer : handleAddCustomer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                    placeholder="Enter full address (street, area, etc.)"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State / Region</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="State or region"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    onClick={handleGeocodeAddress}
                    disabled={loading || geocodingAddress}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#e9931c] text-white rounded-lg font-medium hover:bg-[#d8820a] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {geocodingAddress ? (
                      <>
                        <FaSpinner className="w-4 h-4 animate-spin" />
                        Getting location...
                      </>
                    ) : (
                      <>
                        <FaMapMarkerAlt className="w-4 h-4" />
                        Auto-fill postcode & location from address
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500">Uses address + city/state to set postcode, latitude and longitude</p>
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
                    placeholder="Auto-filled from address or enter manually (e.g. 75400)"
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-filled when you use &quot;Auto-fill postcode & location&quot;. Used for map and visit tasks.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                    <input
                      type="text"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Auto-filled from address or enter manually"
                    />
                    <p className="mt-1 text-xs text-gray-500">Used for visit location (correct lat/lng from address)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                    <input
                      type="text"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="Auto-filled from address or enter manually"
                    />
                    <p className="mt-1 text-xs text-gray-500">Used for visit location (correct lat/lng from address)</p>
                  </div>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Associated Contact</label>
                  <input
                    type="text"
                    name="associatedContactName"
                    value={formData.associatedContactName}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter associated contact name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Associated Company</label>
                  <input
                    type="text"
                    name="associatedCompanyName"
                    value={formData.associatedCompanyName}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter associated company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Contact</label>
                  <input
                    type="date"
                    name="lastContact"
                    value={formData.lastContact}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Engagement</label>
                  <input
                    type="date"
                    name="lastEngagement"
                    value={formData.lastEngagement}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>

              </div>
              <div className="flex-shrink-0 flex gap-2 sm:gap-3 justify-end p-3 sm:p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-2xl pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customers List */}
      {loading && customers.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e9931c] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border-2 border-dashed border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-600 text-lg font-semibold mb-2">No customers found</p>
          <p className="text-gray-500">Create your first customer to get started</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {customers.map((customer) => (
              <div key={customer._id || customer.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{customer.name}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}>
                        {customer.status}
                      </span>
                      {(customer.approvalStatus === 'Pending' || customer.approvalStatus === 'Approved') && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${customer.approvalStatus === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {customer.approvalStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-gray-900">{customer.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-gray-900">{customer.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-gray-900">
                      {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.address || 'N/A'}
                    </p>
                    {customer.pincode && (
                      <p className="text-xs text-gray-500">{customer.pincode}</p>
                    )}
                  </div>
                  {customer.company && (
                    <div>
                      <p className="text-xs text-gray-500">Company</p>
                      <p className="text-gray-900">{customer.company}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200">
                  <a
                    href={getWhatsAppHref(customer.phone) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!getWhatsAppHref(customer.phone)) e.preventDefault()
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${getWhatsAppHref(customer.phone)
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
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${getEmailHref(customer.email, customer.name)
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    title="Send Email"
                  >
                    <FaEnvelope />
                    Email
                  </a>
                  {isCreatedByMe(customer) && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleEditCustomer(customer)}
                        className="p-2 text-[#e9931c] hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomer(customer)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer._id || customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{customer.phone || 'N/A'}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={getWhatsAppHref(customer.phone) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (!getWhatsAppHref(customer.phone)) e.preventDefault()
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${getWhatsAppHref(customer.phone)
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
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${getEmailHref(customer.email, customer.name)
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                              }`}
                            title="Send Email"
                          >
                            <FaEnvelope />
                            Email
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.address || 'N/A'}
                        </div>
                        {customer.pincode && (
                          <div className="text-sm text-gray-500">{customer.pincode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.company || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}>
                            {customer.status}
                          </span>
                          {(customer.approvalStatus === 'Pending' || customer.approvalStatus === 'Approved') && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${customer.approvalStatus === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {customer.approvalStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isCreatedByMe(customer) ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditCustomer(customer)}
                              className="p-2 text-[#e9931c] hover:bg-orange-50 rounded-lg transition-colors"
                              title="Edit Customer"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(customer)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Customer"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default CustomerManagement

