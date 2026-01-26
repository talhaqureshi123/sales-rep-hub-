import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { 
  FaMapMarkerAlt, 
  FaSearch, 
  FaUsers, 
  FaRoute, 
  FaSyncAlt, 
  FaEnvelope, 
  FaToggleOn, 
  FaToggleOff,
  FaTasks,
  FaFlask,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimes,
  FaSpinner,
  FaUser,
  FaPhone,
  FaBuilding,
  FaLocationArrow,
  FaCrosshairs,
  FaInfoCircle
} from 'react-icons/fa'
import GoogleMapView from '../../universalcomponents/GoogleMapView'
import { getLatestSalesmenLocations } from '../../services/adminservices/locationService'
import { getFollowUps } from '../../services/adminservices/followUpService'
import { getVisitTargets } from '../../services/adminservices/visitTargetService'
import { getSamples } from '../../services/adminservices/sampleService'
import { getAllTracking } from '../../services/adminservices/trackingService'

const LiveTracking = () => {
  const [salesmenLocations, setSalesmenLocations] = useState([]) // [{ salesman, latestLocation, isOnline, lastSeenMs }]
  const [filteredSalesmen, setFilteredSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('All') // All, Online, Offline
  const [searchTerm, setSearchTerm] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [selectedSalesman, setSelectedSalesman] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTab, setDetailTab] = useState('tasks') // tasks, samples, visits, tracking
  const [salesmanTasks, setSalesmanTasks] = useState([])
  const [salesmanSamples, setSalesmanSamples] = useState([])
  const [salesmanVisits, setSalesmanVisits] = useState([])
  const [salesmanTracking, setSalesmanTracking] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [salesmanLatestLocation, setSalesmanLatestLocation] = useState(null)
  const [locationAddresses, setLocationAddresses] = useState({}) // { salesmanId: address }
  const loadingAddressesRef = useRef(false) // Prevent duplicate address loading
  const addressCacheRef = useRef({}) // Cache to check without causing re-renders

  // Memoize loadSalesmenLocations to prevent unnecessary re-renders
  const loadSalesmenLocations = useCallback(async () => {
    setLoading(true)
    try {
      // Mark as "online" if updated within last 5 minutes (backend default)
      const result = await getLatestSalesmenLocations({ activeWithinMinutes: 5 })
      if (result.success) {
        const rows = result.data || []
        setSalesmenLocations(rows)
        setOnlineCount(result.onlineCount || 0)

        // Fetch addresses only if not already loading and Google Maps is available
        if (!loadingAddressesRef.current && window.google && window.google.maps) {
          loadingAddressesRef.current = true
          
          // Fetch addresses for all locations (only new ones - check cache ref instead of state)
          const addressPromises = rows
            .filter(row => {
              const salesmanId = row.salesman?._id
              return salesmanId && 
                     row.latestLocation?.latitude && 
                     row.latestLocation?.longitude &&
                     !addressCacheRef.current[salesmanId] // Check cache ref instead of state
            })
            .map(async (row) => {
              const salesmanId = row.salesman?._id
              if (!salesmanId) return null

              const lat = parseFloat(row.latestLocation.latitude)
              const lng = parseFloat(row.latestLocation.longitude)
              const address = await getAddressFromCoordinates(lat, lng)
              
              return { salesmanId, address }
            })

          if (addressPromises.length > 0) {
            const addressResults = await Promise.all(addressPromises)
            setLocationAddresses(prev => {
              const newMap = { ...prev }
              addressResults.forEach(result => {
                if (result && result.salesmanId && result.address) {
                  newMap[result.salesmanId] = result.address
                  addressCacheRef.current[result.salesmanId] = result.address // Update cache ref
                }
              })
              return newMap
            })
          }
          
          loadingAddressesRef.current = false
        }
      }
    } catch (error) {
      console.error('Error loading salesman locations:', error)
      setSalesmenLocations([])
      setOnlineCount(0)
      loadingAddressesRef.current = false
    } finally {
      setLoading(false)
    }
  }, []) // No dependencies to prevent infinite loops

  useEffect(() => {
    loadSalesmenLocations()

    // Auto-refresh every 10 seconds if enabled
    let intervalId
    if (autoRefresh) {
      intervalId = setInterval(() => {
        loadSalesmenLocations()
      }, 10000) // 10 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [autoRefresh, loadSalesmenLocations])

  useEffect(() => {
    filterSalesmen()
  }, [filter, searchTerm, salesmenLocations])

  // Reverse geocode to get address from coordinates - with better formatting
  const getAddressFromCoordinates = (lat, lng) => {
    return new Promise((resolve) => {
      if (!window.google || !window.google.maps) {
        resolve(null)
        return
      }

      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const addressComponents = results[0].address_components
          const formatted = results[0].formatted_address
          
          // Extract meaningful parts
          let streetNumber = ''
          let route = ''
          let sublocality = ''
          let locality = ''
          let area = ''
          let city = ''
          let state = ''
          let country = ''
          
          addressComponents.forEach(component => {
            const types = component.types
            if (types.includes('street_number')) {
              streetNumber = component.long_name
            } else if (types.includes('route')) {
              route = component.long_name
            } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
              sublocality = component.long_name
            } else if (types.includes('locality')) {
              locality = component.long_name
            } else if (types.includes('administrative_area_level_2')) {
              area = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.long_name
            } else if (types.includes('country')) {
              country = component.long_name
            }
          })
          
          // Build a cleaner address - prioritize meaningful location names
          const parts = []
          
          // Priority 1: Area/Locality name (most important - this is what user wants to see)
          if (sublocality) {
            parts.push(sublocality)
          } else if (locality) {
            parts.push(locality)
          } else if (area) {
            parts.push(area)
          }
          
          // Priority 2: Street address (if available)
          if (streetNumber && route) {
            parts.push(`${streetNumber} ${route}`)
          } else if (route && !parts.includes(route)) {
            parts.push(route)
          }
          
          // Priority 3: City (if not already added as locality)
          if (city && !parts.includes(city) && city !== locality) {
            parts.push(city)
          }
          
          // Priority 4: State (only if different from city/locality)
          if (state && state !== city && state !== locality && !parts.includes(state)) {
            parts.push(state)
          }
          
          // Return formatted address - prefer meaningful location names
          if (parts.length > 0) {
            // Remove "V262+7FR" type plus codes and keep only meaningful names
            const cleanAddress = parts
              .filter(part => {
                const trimmed = part.trim()
                // Remove plus codes like "V262+7FR"
                if (trimmed.match(/^[A-Z0-9]+\+[0-9]+[A-Z]*/)) return false
                // Remove postal codes if they appear as standalone
                if (trimmed.match(/^\d{5,6}$/)) return false
                return true
              })
              .join(', ')
            resolve(cleanAddress || formatted.split(',')[0]) // Fallback to first part
          } else {
            // Fallback: Use first meaningful parts of Google's formatted address
            const formattedParts = formatted.split(',')
            const meaningfulParts = formattedParts
              .filter(part => {
                const trimmed = part.trim()
                // Remove plus codes
                if (trimmed.match(/^[A-Z0-9]+\+[0-9]+/)) return false
                // Remove postal codes
                if (trimmed.match(/^\d{5,6}$/)) return false
                return true
              })
              .slice(0, 2) // Take first 2 meaningful parts (Area, City)
            resolve(meaningfulParts.join(', ') || formatted)
          }
        } else {
          resolve(null)
        }
      })
    })
  }


  const filterSalesmen = () => {
    let filtered = salesmenLocations

    // Filter by status
    if (filter === 'Online') {
      filtered = filtered.filter(r => r.isOnline)
    } else if (filter === 'Offline') {
      filtered = filtered.filter(r => !r.isOnline)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r => {
        const s = r.salesman || {}
        return (
          (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    setFilteredSalesmen(filtered)
  }

  const handleRefresh = () => {
    loadSalesmenLocations()
  }

  const handleSendReport = () => {
    // TODO: Implement send report functionality
    alert('Send Report functionality will be implemented')
  }

  // Load salesman details when selected
  const loadSalesmanDetails = async (salesmanId) => {
    if (!salesmanId) return
    
    setLoadingDetails(true)
    try {
      // Find latest location from current data
      const row = salesmenLocations.find(r => r.salesman?._id === salesmanId)
      if (row && row.latestLocation) {
        setSalesmanLatestLocation(row.latestLocation)
      } else {
        setSalesmanLatestLocation(null)
      }

      // Load all data in parallel
      const [tasksResult, samplesResult, visitsResult, trackingResult] = await Promise.all([
        getFollowUps({ salesman: salesmanId }),
        getSamples({ salesman: salesmanId }),
        getVisitTargets({ salesman: salesmanId }),
        getAllTracking({ salesman: salesmanId })
      ])

      if (tasksResult.success) {
        setSalesmanTasks(tasksResult.data || [])
      } else {
        setSalesmanTasks([])
      }

      if (samplesResult.success) {
        setSalesmanSamples(samplesResult.data || [])
      } else {
        setSalesmanSamples([])
      }

      if (visitsResult.success) {
        setSalesmanVisits(visitsResult.data || [])
      } else {
        setSalesmanVisits([])
      }

      if (trackingResult.success) {
        setSalesmanTracking(trackingResult.data || [])
      } else {
        setSalesmanTracking([])
      }
    } catch (error) {
      console.error('Error loading salesman details:', error)
      setSalesmanTasks([])
      setSalesmanSamples([])
      setSalesmanVisits([])
      setSalesmanTracking([])
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleSalesmanClick = (row) => {
    const salesman = row.salesman
    if (salesman && salesman._id) {
      setSelectedSalesman(salesman)
      setShowDetailModal(true)
      setDetailTab('tasks')
      loadSalesmanDetails(salesman._id)
    }
  }

  // Memoize map markers to prevent map re-rendering
  const mapMarkers = useMemo(() => {
    return salesmenLocations
      .filter(r => r.latestLocation?.latitude && r.latestLocation?.longitude)
      .map(r => {
        const salesmanId = r.salesman?._id
        return {
          _id: r.latestLocation?._id || salesmanId,
          name: r.salesman?.name || r.salesman?.email || 'Salesman',
          latitude: parseFloat(r.latestLocation.latitude),
          longitude: parseFloat(r.latestLocation.longitude),
          status: r.isOnline ? 'Online' : 'Offline',
          address: locationAddresses[salesmanId] || '',
          salesman: r.salesman,
          timestamp: r.latestLocation?.timestamp,
          accuracy: r.latestLocation?.accuracy,
          lastSeenMs: r.lastSeenMs,
        }
      })
  }, [salesmenLocations, locationAddresses]) // Only update when locations or addresses change

  // Get first salesman's location coordinates (only from location data, not addresses)
  const firstSalesmanLocation = salesmenLocations.find(r => r.latestLocation?.latitude && r.latestLocation?.longitude)
  const firstLat = firstSalesmanLocation?.latestLocation?.latitude
  const firstLng = firstSalesmanLocation?.latestLocation?.longitude
  
  // Memoize map center to prevent map resetting - only update when coordinates actually change
  const mapCenter = useMemo(() => {
    if (firstLat && firstLng) {
      return { lat: parseFloat(firstLat), lng: parseFloat(firstLng) }
    }
    return { lat: 24.9141, lng: 67.0822 } // Default Karachi
  }, [firstLat, firstLng])

  // Memoize marker click handler
  const handleMarkerClick = useCallback((target) => {
    const row = salesmenLocations.find(r => 
      (r.salesman?._id === target.salesman?._id) || 
      (r.latestLocation?._id === target._id) ||
      (r.salesman?._id === target._id)
    )
    if (row) {
      handleSalesmanClick(row)
    }
  }, [salesmenLocations, handleSalesmanClick])

  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <FaMapMarkerAlt className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Tracking</h1>
            <p className="text-gray-600">Monitor sales reps in real-time</p>
          </div>
        </div>
      </div>

      {/* Main Content - Map and Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        {/* Map Section - Takes 2/3 width on large screens */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '600px', height: '100%' }}>
          {/* Map Container */}
          <div className="flex-1 bg-gray-100 relative" style={{ minHeight: '500px', height: '100%', width: '100%' }}>
            {mapMarkers.length > 0 ? (
              <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                <GoogleMapView
                  key={`map-${firstLat || 0}-${firstLng || 0}`} // Stable key - only change when first location coordinates change
                  milestones={[]}
                  visitTargets={mapMarkers}
                  userLocation={null}
                  center={mapCenter}
                  zoom={mapMarkers.length === 1 ? 16 : 15} // Higher zoom for single salesman (16), multiple salesmen (15)
                  height="100%"
                  showUserLocation={false}
                  showRadius={false}
                  isTracking={false}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50" style={{ minHeight: '500px', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <div className="text-center">
                  <FaMapMarkerAlt className="w-24 h-24 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No Locations Yet</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Salesman locations will appear when the app starts sending GPS updates
                  </p>
                </div>
              </div>
            )}

            {/* Map Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              <button className="bg-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium text-purple-600 border border-purple-200">
                Heatmap
              </button>
              <button className="bg-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                Geofences
              </button>
              <button className="bg-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                Routes
              </button>
              <button className="bg-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors text-sm font-medium text-purple-600 border border-purple-200">
                Customers
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md flex flex-col">
              <button className="px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-t-lg">
                +
              </button>
              <div className="border-t border-gray-200"></div>
              <button className="px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-b-lg">
                −
              </button>
            </div>
          </div>

          {/* Map Attribution */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Leaflet | © OpenStreetMap
          </div>
        </div>

        {/* Right Sidebar - Controls and Reps List */}
        <div className="flex flex-col gap-4 min-h-0" style={{ height: '100%' }}>
          {/* Controls */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {autoRefresh ? (
                  <FaToggleOn
                    className="w-8 h-8 text-[#e9931c] cursor-pointer"
                    onClick={() => setAutoRefresh(false)}
                  />
                ) : (
                  <FaToggleOff
                    className="w-8 h-8 text-gray-400 cursor-pointer"
                    onClick={() => setAutoRefresh(true)}
                  />
                )}
                <span className="text-sm font-medium text-gray-700">Auto-refresh</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <FaSyncAlt className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={handleSendReport}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Send Report"
                >
                  <FaEnvelope className="w-4 h-4 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaRoute className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">Online Window:</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  5 min
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FaUsers className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">Online Reps:</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {onlineCount}/{salesmenLocations.length}
                </span>
              </div>
            </div>
          </div>

          {/* Sales Reps List */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden" style={{ maxHeight: '100%' }}>
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="relative mb-3">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search reps..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('All')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'All'
                      ? 'bg-[#e9931c] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('Online')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'Online'
                      ? 'bg-[#e9931c] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFilter('Offline')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'Offline'
                      ? 'bg-[#e9931c] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  Offline
                </button>
              </div>
            </div>

            {/* Reps List */}
            <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0, maxHeight: '100%' }}>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#e9931c] border-t-transparent mx-auto mb-2"></div>
                  <p className="text-gray-600 text-sm">Loading...</p>
                </div>
              ) : filteredSalesmen.length === 0 ? (
                <div className="text-center py-12">
                  <FaUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No reps found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSalesmen.map((row) => {
                    const salesman = row.salesman || {}
                    const loc = row.latestLocation
                    const isOnline = !!row.isOnline

                    return (
                      <div
                        key={salesman._id}
                        onClick={() => handleSalesmanClick(row)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${isOnline ? 'border-green-200 bg-green-50 hover:bg-green-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {salesman.name || salesman.email}
                            </p>
                            {salesman.email && (
                              <p className="text-xs text-gray-500 mt-1">
                                {salesman.email}
                              </p>
                            )}
                            {loc?.latitude && loc?.longitude && (
                              <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                                {/* Address */}
                                <div className="flex items-start gap-2">
                                  <FaMapMarkerAlt className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#e9931c]" />
                                  <div className="flex-1 min-w-0">
                                    {locationAddresses[salesman._id] ? (
                                      <p className="text-xs font-medium text-gray-800 leading-relaxed">
                                        {locationAddresses[salesman._id]}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-gray-500 italic">Loading address...</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                      {Number(loc.latitude).toFixed(6)}, {Number(loc.longitude).toFixed(6)}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Last Seen & Accuracy */}
                                <div className="flex items-center gap-3 pl-5 text-xs text-gray-500">
                                  {loc.timestamp && (
                                    <span className="flex items-center gap-1.5">
                                      <FaClock className="w-3 h-3" />
                                      {row.lastSeenMs !== null && row.lastSeenMs !== undefined ? (
                                        <>
                                          {row.lastSeenMs < 60000 
                                            ? `${Math.floor(row.lastSeenMs / 1000)}s ago`
                                            : row.lastSeenMs < 3600000
                                            ? `${Math.floor(row.lastSeenMs / 60000)}m ago`
                                            : `${Math.floor(row.lastSeenMs / 3600000)}h ago`}
                                        </>
                                      ) : (
                                        new Date(loc.timestamp).toLocaleTimeString()
                                      )}
                                    </span>
                                  )}
                                  {loc.accuracy && (
                                    <span className="flex items-center gap-1.5">
                                      <FaCrosshairs className="w-3 h-3" />
                                      {Math.round(loc.accuracy)}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {!loc?.latitude || !loc?.longitude ? (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                  <FaInfoCircle className="w-3 h-3" />
                                  No location data available
                                </p>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {isOnline ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs font-semibold text-green-600">Online</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                                <span className="text-xs font-semibold text-gray-500">Offline</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Salesman Detail Modal */}
      {showDetailModal && selectedSalesman && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-slideUp my-auto">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <FaUser className="w-6 h-6 text-[#e9931c]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedSalesman.name || selectedSalesman.email}</h3>
                    <p className="text-sm text-orange-100 mt-0.5">{selectedSalesman.email}</p>
                    {selectedSalesman.phone && (
                      <p className="text-xs text-orange-200 mt-0.5 flex items-center gap-1">
                        <FaPhone className="w-3 h-3" />
                        {selectedSalesman.phone}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setSelectedSalesman(null)
                    setSalesmanTasks([])
                    setSalesmanSamples([])
                    setSalesmanVisits([])
                    setSalesmanTracking([])
                    setSalesmanLatestLocation(null)
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setDetailTab('tasks')}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  detailTab === 'tasks'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaTasks className="w-4 h-4" />
                Tasks ({salesmanTasks.length})
              </button>
              <button
                onClick={() => setDetailTab('samples')}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  detailTab === 'samples'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaFlask className="w-4 h-4" />
                Samples ({salesmanSamples.length})
              </button>
              <button
                onClick={() => setDetailTab('visits')}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  detailTab === 'visits'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaMapMarkerAlt className="w-4 h-4" />
                Visits ({salesmanVisits.length})
              </button>
              <button
                onClick={() => setDetailTab('tracking')}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  detailTab === 'tracking'
                    ? 'bg-white text-[#e9931c] border-b-2 border-[#e9931c]'
                    : 'text-gray-600 hover:text-[#e9931c] hover:bg-gray-100'
                }`}
              >
                <FaRoute className="w-4 h-4" />
                Tracking ({salesmanTracking.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <FaSpinner className="w-8 h-8 text-[#e9931c] animate-spin mr-3" />
                  <p className="text-gray-600">Loading details...</p>
                </div>
              ) : (
                <>
                  {/* Tasks Tab */}
                  {detailTab === 'tasks' && (
                    <div className="space-y-3">
                      {salesmanTasks.length === 0 ? (
                        <div className="text-center py-12">
                          <FaTasks className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No tasks found</p>
                        </div>
                      ) : (
                        salesmanTasks.map((task) => (
                          <div key={task._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">{task.title || task.customerName || 'Task'}</p>
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
                                </div>
                                {task.customerName && (
                                  <p className="text-sm text-gray-600 mb-1">Customer: {task.customerName}</p>
                                )}
                                {task.description && (
                                  <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <FaClock className="w-3 h-3" />
                                      Due: {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 rounded ${
                                      task.priority === 'High' || task.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {task.priority}
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
                  {detailTab === 'samples' && (
                    <div className="space-y-3">
                      {salesmanSamples.length === 0 ? (
                        <div className="text-center py-12">
                          <FaFlask className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No samples found</p>
                        </div>
                      ) : (
                        salesmanSamples.map((sample) => (
                          <div key={sample._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800 mb-1">{sample.customerName || 'Sample'}</p>
                                {sample.productName && (
                                  <p className="text-sm text-gray-600 mb-1">Product: {sample.productName}</p>
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
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Visits Tab */}
                  {detailTab === 'visits' && (
                    <div className="space-y-3">
                      {salesmanVisits.length === 0 ? (
                        <div className="text-center py-12">
                          <FaMapMarkerAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-600">No visits found</p>
                        </div>
                      ) : (
                        salesmanVisits.map((visit) => (
                          <div key={visit._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                                  {visit.priority && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      visit.priority === 'High' ? 'bg-red-100 text-red-700' :
                                      visit.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {visit.priority}
                                    </span>
                                  )}
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
                                  {visit.latitude && visit.longitude && (
                                    <span className="flex items-center gap-1">
                                      <FaLocationArrow className="w-3 h-3" />
                                      {Number(visit.latitude).toFixed(4)}, {Number(visit.longitude).toFixed(4)}
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

                  {/* Tracking Tab */}
                  {detailTab === 'tracking' && (
                    <div className="space-y-4">
                      {/* Latest Location */}
                      {salesmanLatestLocation && (
                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <div className="flex items-center gap-2 mb-3">
                            <FaMapMarkerAlt className="w-5 h-5 text-blue-600" />
                            <h4 className="font-semibold text-blue-800">Current Location</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-blue-600 font-medium">Latitude</p>
                              <p className="text-sm font-semibold text-blue-800 font-mono">
                                {Number(salesmanLatestLocation.latitude).toFixed(6)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 font-medium">Longitude</p>
                              <p className="text-sm font-semibold text-blue-800 font-mono">
                                {Number(salesmanLatestLocation.longitude).toFixed(6)}
                              </p>
                            </div>
                            {salesmanLatestLocation.accuracy && (
                              <div>
                                <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                  <FaCrosshairs className="w-3 h-3" />
                                  Accuracy
                                </p>
                                <p className="text-sm font-semibold text-blue-800">
                                  {salesmanLatestLocation.accuracy} m
                                </p>
                              </div>
                            )}
                            {salesmanLatestLocation.timestamp && (
                              <div>
                                <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                  <FaClock className="w-3 h-3" />
                                  Last Updated
                                </p>
                                <p className="text-sm font-semibold text-blue-800">
                                  {new Date(salesmanLatestLocation.timestamp).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                          {locationAddresses[selectedSalesman?._id] && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                              <p className="text-xs text-blue-600 font-medium flex items-center gap-1.5 mb-1">
                                <FaMapMarkerAlt className="w-3 h-3" />
                                Address
                              </p>
                              <p className="text-sm text-blue-800 leading-relaxed">
                                {locationAddresses[selectedSalesman._id]}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tracking Sessions */}
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FaRoute className="w-4 h-4 text-[#e9931c]" />
                          Tracking Sessions
                        </h4>
                        {salesmanTracking.length === 0 ? (
                          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                            <FaRoute className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600">No tracking sessions found</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {salesmanTracking.map((track) => (
                              <div key={track._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold text-gray-800">Tracking Session</p>
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                        track.status === 'active' ? 'bg-green-100 text-green-700' :
                                        track.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {track.status}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                      {track.startingKilometers && (
                                        <div>
                                          <p className="text-xs text-gray-500">Starting KM</p>
                                          <p className="text-sm font-semibold text-gray-800">{track.startingKilometers} km</p>
                                        </div>
                                      )}
                                      {track.endingKilometers && (
                                        <div>
                                          <p className="text-xs text-gray-500">Ending KM</p>
                                          <p className="text-sm font-semibold text-gray-800">{track.endingKilometers} km</p>
                                        </div>
                                      )}
                                      {track.totalDistance && (
                                        <div>
                                          <p className="text-xs text-gray-500">Total Distance</p>
                                          <p className="text-sm font-semibold text-gray-800">{track.totalDistance} km</p>
                                        </div>
                                      )}
                                      {track.startedAt && (
                                        <div>
                                          <p className="text-xs text-gray-500">Started At</p>
                                          <p className="text-sm font-semibold text-gray-800">
                                            {new Date(track.startedAt).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    {track.startLocation && (
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                          <FaLocationArrow className="w-3 h-3 text-green-600" />
                                          <span className="font-medium">Start:</span>
                                          <span className="font-mono">
                                            {track.startLocation.latitude?.toFixed(6)}, {track.startLocation.longitude?.toFixed(6)}
                                          </span>
                                        </p>
                                      </div>
                                    )}
                                    {track.endLocation && (
                                      <div className="mt-1">
                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                          <FaLocationArrow className="w-3 h-3 text-red-600" />
                                          <span className="font-medium">End:</span>
                                          <span className="font-mono">
                                            {track.endLocation.latitude?.toFixed(6)}, {track.endLocation.longitude?.toFixed(6)}
                                          </span>
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveTracking
