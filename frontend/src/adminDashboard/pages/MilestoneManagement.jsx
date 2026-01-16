import { useState, useEffect, useRef } from 'react'
import { getAllMilestones, createMilestone, updateMilestone, deleteMilestone, getSalesmen } from '../../services/adminservices/milestoneService'
import { getUsers } from '../../services/adminservices/userService'

const MilestoneManagement = () => {
  const [milestones, setMilestones] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const mapPickerRef = useRef(null)
  const mapPickerInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    address: '',
    salesmanId: '',
    priority: 'Medium',
    radius: 100,
    notes: '',
  })

  // Load milestones and salesmen on mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load milestones
      const milestonesResult = await getAllMilestones()
      if (milestonesResult.success) {
        setMilestones(milestonesResult.data || [])
      }

      // Load salesmen
      const salesmenResult = await getSalesmen()
      if (salesmenResult.success) {
        setSalesmen(salesmenResult.data || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const milestoneData = {
        name: formData.name,
        description: formData.description,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        address: formData.address,
        salesmanId: formData.salesmanId,
        priority: formData.priority,
        radius: parseFloat(formData.radius),
        notes: formData.notes,
      }

      let result
      if (editingMilestone) {
        result = await updateMilestone(editingMilestone._id, milestoneData)
      } else {
        result = await createMilestone(milestoneData)
      }

      if (result.success) {
        alert(editingMilestone ? 'Milestone updated successfully!' : 'Milestone created successfully!')
        setShowForm(false)
        setEditingMilestone(null)
        resetForm()
        loadData()
      } else {
        alert(result.message || 'Failed to save milestone')
      }
    } catch (error) {
      console.error('Error saving milestone:', error)
      alert('Error saving milestone')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (milestone) => {
    setEditingMilestone(milestone)
    setFormData({
      name: milestone.name || '',
      description: milestone.description || '',
      latitude: milestone.latitude?.toString() || '',
      longitude: milestone.longitude?.toString() || '',
      address: milestone.address || '',
      salesmanId: milestone.salesman?._id || milestone.salesman || '',
      priority: milestone.priority || 'Medium',
      radius: milestone.proximityDistance ? (milestone.proximityDistance * 1000).toString() : '100',
      notes: milestone.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (milestoneId) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteMilestone(milestoneId)
      if (result.success) {
        alert('Milestone deleted successfully!')
        loadData()
      } else {
        alert(result.message || 'Failed to delete milestone')
      }
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Error deleting milestone')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      latitude: '',
      longitude: '',
      address: '',
      salesmanId: '',
      priority: 'Medium',
      radius: 100,
      notes: '',
    })
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingMilestone(null)
    resetForm()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 font-semibold'
      case 'Medium':
        return 'text-yellow-600 font-semibold'
      case 'Low':
        return 'text-green-600 font-semibold'
      default:
        return 'text-gray-600'
    }
  }

  // Map Picker Functions
  const handleMapPickerClick = () => {
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
          setFormData(prev => ({
            ...prev,
            address: results[0].formatted_address || prev.address,
          }))
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Milestone Management</h2>
        <button
          onClick={() => {
            resetForm()
            setEditingMilestone(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
        >
          + Create Milestone
        </button>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingMilestone ? 'Edit Milestone' : 'Create New Milestone'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Milestone Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign to Salesman *
                    </label>
                    <select
                      name="salesmanId"
                      value={formData.salesmanId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    >
                      <option value="">Select Salesman</option>
                      {salesmen.map((salesman) => (
                        <option key={salesman._id} value={salesman._id}>
                          {salesman.name} ({salesman.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleInputChange}
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                      />
                      <button
                        type="button"
                        onClick={handleMapPickerClick}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        title="Pick Location on Map"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="hidden sm:inline">Map</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Radius (meters) *
                    </label>
                    <input
                      type="number"
                      name="radius"
                      value={formData.radius}
                      onChange={handleInputChange}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingMilestone ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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

      {/* Milestones List */}
      {loading && !showForm ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading milestones...</p>
        </div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No milestones found. Create your first milestone!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Salesman</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Radius</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {milestones.map((milestone) => (
                <tr key={milestone._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium">{milestone.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {milestone.salesman?.name || 'N/A'} ({milestone.salesman?.email || 'N/A'})
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{milestone.address || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={getPriorityColor(milestone.priority)}>
                      {milestone.priority || 'Medium'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(milestone.status)}`}>
                      {milestone.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {milestone.proximityDistance ? (milestone.proximityDistance * 1000).toFixed(0) : 100}m
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(milestone)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(milestone._id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Delete
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
  )
}

export default MilestoneManagement

