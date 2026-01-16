import { useState, useEffect, useRef } from 'react'
import { getVisitTargets, createVisitTarget, updateVisitTarget, deleteVisitTarget } from '../../services/adminservices/visitTargetService'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers } from '../../services/adminservices/customerService'
import { FaEdit, FaTrash } from 'react-icons/fa'

const AssignTarget = () => {
  const [visitTargets, setVisitTargets] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTarget, setEditingTarget] = useState(null)
  const [filterSalesman, setFilterSalesman] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [mapLocation, setMapLocation] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const mapPickerRef = useRef(null)
  const mapPickerInstanceRef = useRef(null)
  const markerRef = useRef(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    salesman: '',
    latitude: '',
    longitude: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    priority: 'Medium',
    visitDate: '',
    notes: '',
  })

  // Load data on mount
  useEffect(() => {
    loadVisitTargets()
    loadSalesmen()
    loadCustomers()
  }, [])

  // Reload when filters change
  useEffect(() => {
    loadVisitTargets()
  }, [filterSalesman, filterStatus, filterPriority, searchTerm])

  // Close customer suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerSuggestions && !event.target.closest('.customer-search-container')) {
        setShowCustomerSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCustomerSuggestions])

  const loadVisitTargets = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filterSalesman) params.salesman = filterSalesman
      if (filterStatus) params.status = filterStatus
      if (filterPriority) params.priority = filterPriority
      if (searchTerm) params.search = searchTerm

      const result = await getVisitTargets(params)
      console.log('AssignTarget - Load result:', result)
      if (result.success && result.data) {
        console.log('AssignTarget - Setting visit targets:', result.data.length, result.data)
        setVisitTargets(result.data)
      } else {
        console.error('Failed to load visit targets:', result.message)
        setError(result.message || 'Failed to load visit targets')
        setVisitTargets([])
      }
    } catch (error) {
      console.error('Error loading visit targets:', error)
      setError(error.message || 'Error loading visit targets')
      setVisitTargets([])
    } finally {
      setLoading(false)
    }
  }

  const loadSalesmen = async () => {
    try {
      console.log('Loading salesmen...')
      const result = await getUsers({ role: 'salesman', status: 'Active' })
      console.log('Salesmen result:', result)
      if (result.success && result.data) {
        console.log('Salesmen loaded:', result.data.length, result.data)
        setSalesmen(result.data)
      } else {
        console.error('Failed to load salesmen:', result.message)
        setSalesmen([])
      }
    } catch (error) {
      console.error('Error loading salesmen:', error)
      setSalesmen([])
    }
  }

  const loadCustomers = async () => {
    try {
      const result = await getCustomers()
      if (result.success && result.data) {
        setCustomers(result.data)
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    }
  }

  const handleCustomerSearch = (e) => {
    const value = e.target.value
    setCustomerSearch(value)
    setShowCustomerSuggestions(value.length > 0)
  }

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.firstName || customer.name || '')
    setShowCustomerSuggestions(false)
    
    // Auto-fill form with customer data
    const postcode = customer.postcode || customer.pincode || ''
    const address = customer.address || ''
    const city = customer.city || ''
    const state = customer.state || ''
    
    setFormData({
      ...formData,
      name: customer.firstName || customer.name || '',
      description: `Visit target for ${customer.firstName || customer.name}`,
      salesman: customer.assignedSalesman?._id || customer.assignedSalesman || formData.salesman,
      address: address,
      city: city,
      state: state,
      pincode: postcode,
    })

    // Auto-fetch location from postcode using Google Geocoding API
    if (postcode) {
      // Wait for Google Maps to load if not already loaded
      const fetchLocationFromPostcode = () => {
        if (!window.google || !window.google.maps) {
          console.log('Google Maps not loaded, waiting...')
          setTimeout(fetchLocationFromPostcode, 500)
          return
        }

        try {
          const geocoder = new window.google.maps.Geocoder()
          
          // Build search query - try multiple formats for better results
          const searchQueries = []
          
          // For UK postcodes, add UK prefix
          if (postcode.match(/^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i)) {
            searchQueries.push(`${postcode}, UK`)
            searchQueries.push(postcode)
          } else {
            // Try with city, state, postcode
            if (city && state) {
              searchQueries.push(`${city}, ${state} ${postcode}`.trim())
            }
            if (city) {
              searchQueries.push(`${city}, ${postcode}`)
            }
            if (state) {
              searchQueries.push(`${state} ${postcode}`.trim())
            }
            searchQueries.push(postcode)
          }

          // Try each query until one works
          let queryIndex = 0
          const tryGeocode = () => {
            if (queryIndex >= searchQueries.length) {
              console.log('All geocoding attempts failed for postcode:', postcode)
              return
            }

            const searchQuery = searchQueries[queryIndex]
            console.log('Trying geocode with:', searchQuery)
            
            geocoder.geocode({ address: searchQuery }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location
                const addressComponents = results[0].address_components
                let fetchedCity = city
                let fetchedState = state
                let fetchedAddress = address
                let fetchedPostcode = postcode

                // Extract city, state, postcode from address components
                addressComponents.forEach(component => {
                  if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                    fetchedCity = component.long_name
                  }
                  if (component.types.includes('administrative_area_level_1')) {
                    fetchedState = component.long_name
                  }
                  if (component.types.includes('postal_code')) {
                    fetchedPostcode = component.long_name
                  }
                })

                setFormData(prev => ({
                  ...prev,
                  latitude: location.lat().toString(),
                  longitude: location.lng().toString(),
                  address: fetchedAddress || results[0].formatted_address,
                  city: fetchedCity || prev.city,
                  state: fetchedState || prev.state,
                  pincode: fetchedPostcode || prev.pincode,
                }))
                
                console.log('Location fetched successfully:', location.lat(), location.lng())
              } else {
                console.log('Geocoding failed for query:', searchQuery, 'Status:', status)
                queryIndex++
                tryGeocode() // Try next query
              }
            })
          }

          tryGeocode()
        } catch (error) {
          console.error('Error fetching location from postcode:', error)
        }
      }

      // Start fetching location
      fetchLocationFromPostcode()
    }
  }

  const filteredCustomers = customers.filter(customer => {
    if (!customerSearch) return false
    const searchLower = customerSearch.toLowerCase()
    const firstName = (customer.firstName || '').toLowerCase()
    const name = (customer.name || '').toLowerCase()
    const company = (customer.company || '').toLowerCase()
    const email = (customer.email || '').toLowerCase()
    return firstName.includes(searchLower) || 
           name.includes(searchLower) || 
           company.includes(searchLower) ||
           email.includes(searchLower)
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleMapClick = () => {
    setShowMapPicker(true)
  }

  const initializeMapPicker = () => {
    if (!mapPickerRef.current || !window.google || !window.google.maps) {
      return
    }

    const defaultCenter = formData.latitude && formData.longitude
      ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
      : { lat: 28.6139, lng: 77.2090 } // Default: Delhi

    const map = new window.google.maps.Map(mapPickerRef.current, {
      center: defaultCenter,
      zoom: 13,
      mapTypeId: 'roadmap',
    })

    mapPickerInstanceRef.current = map

    // Add marker if coordinates exist
    if (formData.latitude && formData.longitude) {
      const position = { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
      markerRef.current = new window.google.maps.Marker({
        position: position,
        map: map,
        draggable: true,
      })

      // Update form when marker is dragged
      markerRef.current.addListener('dragend', (e) => {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        updateLocationFromMap(lat, lng)
      })
    }

    // Add click listener to map
    map.addListener('click', (e) => {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      
      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }

      // Add new marker
      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        draggable: true,
      })

      // Update form
      updateLocationFromMap(lat, lng)

      // Add drag listener
      markerRef.current.addListener('dragend', (e) => {
        const newLat = e.latLng.lat()
        const newLng = e.latLng.lng()
        updateLocationFromMap(newLat, newLng)
      })
    })
  }

  const updateLocationFromMap = async (lat, lng) => {
    setFormData({
      ...formData,
      latitude: lat.toString(),
      longitude: lng.toString(),
    })

    // Try to get address using Geocoding API
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const address = results[0].formatted_address
          setFormData(prev => ({
            ...prev,
            address: address || prev.address,
          }))
          setMapLocation({ lat, lng, address })
        }
      })
    }
  }

  const handleMapPickerClose = () => {
    setShowMapPicker(false)
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
    if (mapPickerInstanceRef.current) {
      mapPickerInstanceRef.current = null
    }
  }

  // Handle location search using Google Places API
  const handleLocationSearch = (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) {
      alert('Please enter a location to search')
      return
    }

    if (!window.google || !window.google.maps) {
      alert('Google Maps is not loaded yet. Please wait a moment and try again.')
      return
    }

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location
        const addressComponents = results[0].address_components
        let city = ''
        let state = ''
        let pincode = ''

        // Extract city, state, pincode from address components
        addressComponents.forEach(component => {
          if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
            city = component.long_name
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name
          }
          if (component.types.includes('postal_code')) {
            pincode = component.long_name
          }
        })

        setFormData({
          ...formData,
          latitude: location.lat().toString(),
          longitude: location.lng().toString(),
          address: results[0].formatted_address,
          city: city || formData.city,
          state: state || formData.state,
          pincode: pincode || formData.pincode,
        })

        // Update map picker location if open
        if (showMapPicker && mapPickerInstanceRef.current) {
          mapPickerInstanceRef.current.setCenter(location)
          if (markerRef.current) {
            markerRef.current.setMap(null)
          }
          markerRef.current = new window.google.maps.Marker({
            position: location,
            map: mapPickerInstanceRef.current,
            draggable: true,
          })
          markerRef.current.addListener('dragend', (e) => {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            updateLocationFromMap(lat, lng)
          })
        }
      } else {
        alert('Location not found. Please try a different search term.')
      }
    })
  }

  // Initialize map picker when modal opens
  useEffect(() => {
    if (showMapPicker && window.google && window.google.maps) {
      setTimeout(() => {
        initializeMapPicker()
      }, 100)
    }
  }, [showMapPicker])

  // Wait for Google Maps to load
  useEffect(() => {
    if (showMapPicker) {
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps && mapPickerRef.current) {
          clearInterval(checkGoogleMaps)
          initializeMapPicker()
        }
      }, 100)

      return () => clearInterval(checkGoogleMaps)
    }
  }, [showMapPicker])

  const handleAddTarget = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const targetData = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        visitDate: formData.visitDate || undefined,
      }

      const result = await createVisitTarget(targetData)
      console.log('AssignTarget - Create result:', result)
      
      if (result.success) {
        alert('Visit target created successfully!')
        resetForm()
        setShowAddForm(false)
        // Reload visit targets after a short delay to ensure data is saved
        setTimeout(() => {
          loadVisitTargets()
        }, 500)
      } else {
        alert(result.message || 'Failed to create visit target')
      }
    } catch (error) {
      console.error('Error creating visit target:', error)
      alert('Error creating visit target')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTarget = (target) => {
    setEditingTarget(target)
    setFormData({
      name: target.name || '',
      description: target.description || '',
      salesman: target.salesman?._id || target.salesman || '',
      latitude: target.latitude?.toString() || '',
      longitude: target.longitude?.toString() || '',
      address: target.address || '',
      city: target.city || '',
      state: target.state || '',
      pincode: target.pincode || '',
      priority: target.priority || 'Medium',
      visitDate: target.visitDate ? new Date(target.visitDate).toISOString().split('T')[0] : '',
      notes: target.notes || '',
    })
    setShowAddForm(true)
  }

  const handleUpdateTarget = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const targetData = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        visitDate: formData.visitDate || undefined,
      }

      const result = await updateVisitTarget(editingTarget._id, targetData)
      
      if (result.success) {
        alert('Visit target updated successfully!')
        setEditingTarget(null)
        resetForm()
        setShowAddForm(false)
        loadVisitTargets()
      } else {
        alert(result.message || 'Failed to update visit target')
      }
    } catch (error) {
      console.error('Error updating visit target:', error)
      alert('Error updating visit target')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTarget = async (id) => {
    if (!window.confirm('Are you sure you want to delete this visit target?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteVisitTarget(id)
      
      if (result.success) {
        alert('Visit target deleted successfully!')
        loadVisitTargets()
      } else {
        alert(result.message || 'Failed to delete visit target')
      }
    } catch (error) {
      console.error('Error deleting visit target:', error)
      alert('Error deleting visit target')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingTarget(null)
    setSelectedCustomer(null)
    setCustomerSearch('')
    setShowCustomerSuggestions(false)
    setFormData({
      name: '',
      description: '',
      salesman: '',
      latitude: '',
      longitude: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      priority: 'Medium',
      visitDate: '',
      notes: '',
    })
    setMapLocation(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-green-100 text-green-800'
    }
  }

  // Debug: Log when component renders
  useEffect(() => {
    console.log('AssignTarget component rendered')
  }, [])

  return (
    <div className="w-full">
      <div className="rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Assign Target</h2>
            <p className="text-gray-600 mt-1">Assign visit targets to salesmen</p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center gap-2"
            title="Add Visit Target"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Target</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search targets..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Salesman</label>
            <select
              value={filterSalesman}
              onChange={(e) => setFilterSalesman(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="">All Salesmen</option>
              {salesmen.map((salesman) => (
                <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                  {salesman.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterSalesman('')
                setFilterStatus('')
                setFilterPriority('')
                setSearchTerm('')
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              title="Clear Filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg p-6 mb-6 border-2 border-[#e9931c]">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingTarget ? 'Edit Visit Target' : 'Add New Visit Target'}
            </h3>
            <form onSubmit={editingTarget ? handleUpdateTarget : handleAddTarget} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Selection with Autocomplete */}
              <div className="md:col-span-2 relative customer-search-container">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={handleCustomerSearch}
                    onFocus={() => setShowCustomerSuggestions(customerSearch.length > 0)}
                    placeholder="Type customer name to search..."
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                  {showCustomerSuggestions && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <div
                          key={customer._id || customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-semibold text-gray-800">
                            {customer.firstName || customer.name}
                          </div>
                          {customer.company && (
                            <div className="text-sm text-gray-500">{customer.company}</div>
                          )}
                          {customer.email && (
                            <div className="text-xs text-gray-400">{customer.email}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {showCustomerSuggestions && customerSearch.length > 0 && filteredCustomers.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4">
                      <div className="text-sm text-gray-500">No customers found</div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Select a customer to auto-fill target name and other details
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter target name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Salesman *</label>
                <select
                  name="salesman"
                  value={formData.salesman}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  <option value="">Select Salesman</option>
                  {salesmen.length === 0 ? (
                    <option value="" disabled>No active salesmen found</option>
                  ) : (
                    salesmen.map((salesman) => (
                      <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                        {salesman.name} ({salesman.email})
                      </option>
                    ))
                  )}
                </select>
                {salesmen.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">No active salesmen available. Please create a salesman first.</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="2"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location Search</label>
                <div className="mb-2 relative">
                  <input
                    type="text"
                    id="location-search"
                    placeholder="Search location (e.g., Delhi, Mumbai, etc.)"
                    className="w-full px-4 py-2 pr-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleLocationSearch(e.target.value)
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const searchInput = document.getElementById('location-search')
                      if (searchInput && searchInput.value) {
                        handleLocationSearch(searchInput.value)
                      }
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-[#e9931c] text-white rounded hover:bg-[#d8820a] transition-colors"
                    title="Search Location"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    required
                    step="any"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="28.6139"
                  />
                  <button
                    type="button"
                    onClick={handleMapClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    title="Pick Location on Map"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Map</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Longitude *</label>
                <input
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  required
                  step="any"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="77.2090"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter state"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter pincode"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visit Date</label>
                <input
                  type="date"
                  name="visitDate"
                  value={formData.visitDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter any notes"
                />
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center gap-2"
                  title={editingTarget ? 'Update Target' : 'Create Target'}
                >
                  {editingTarget ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Update</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Create</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowAddForm(false)
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors flex items-center gap-2"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Visit Targets List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Visit Targets ({visitTargets.length})
          </h3>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {loading && visitTargets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200">
              <p className="text-gray-600">Loading visit targets...</p>
            </div>
          ) : visitTargets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200">
              <p className="text-gray-600">No visit targets found. Add your first visit target!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Salesman</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Location</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Priority</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Visit Date</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visitTargets.map((target) => (
                    <tr key={target._id} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-800">{target.name}</div>
                        {target.description && (
                          <div className="text-sm text-gray-500">{target.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-800">
                          {target.salesman?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-800">
                          {target.address || `${target.latitude}, ${target.longitude}`}
                        </div>
                        {(target.city || target.state) && (
                          <div className="text-xs text-gray-500">
                            {[target.city, target.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(target.priority)}`}>
                          {target.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(target.status)}`}>
                          {target.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {target.visitDate ? new Date(target.visitDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditTarget(target)}
                            className="p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                              <FaEdit className="w-5 h-5 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteTarget(target._id)}
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
          )}
        </div>

        {/* Map Picker Modal */}
        {showMapPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ margin: 'auto' }}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Select Location on Map</h3>
                <button
                  onClick={handleMapPickerClose}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 flex-1">
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Click on the map to select location. You can also drag the marker to adjust the position.
                  </p>
                </div>
                <div 
                  ref={mapPickerRef} 
                  className="w-full h-[500px] rounded-lg border-2 border-gray-200"
                  style={{ minHeight: '400px' }}
                />
              </div>
              <div className="p-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleMapPickerClose}
                  className="flex-1 px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
                >
                  Use Selected Location
                </button>
                <button
                  onClick={handleMapPickerClose}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AssignTarget
