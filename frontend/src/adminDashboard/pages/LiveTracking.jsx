import { useState, useEffect } from 'react'
import { FaMapMarkerAlt, FaSearch, FaUsers, FaRoute, FaSyncAlt, FaEnvelope, FaToggleOn, FaToggleOff } from 'react-icons/fa'
import GoogleMapView from '../../universalcomponents/GoogleMapView'
import { getLatestSalesmenLocations } from '../../services/adminservices/locationService'

const LiveTracking = () => {
  const [salesmenLocations, setSalesmenLocations] = useState([]) // [{ salesman, latestLocation, isOnline, lastSeenMs }]
  const [filteredSalesmen, setFilteredSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('All') // All, Online, Offline
  const [searchTerm, setSearchTerm] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)

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
  }, [autoRefresh])

  useEffect(() => {
    filterSalesmen()
  }, [filter, searchTerm, salesmenLocations])

  const loadSalesmenLocations = async () => {
    setLoading(true)
    try {
      // Mark as "online" if updated within last 5 minutes (backend default)
      const result = await getLatestSalesmenLocations({ activeWithinMinutes: 5 })
      if (result.success) {
        const rows = result.data || []
        setSalesmenLocations(rows)
        setOnlineCount(result.onlineCount || 0)
      }
    } catch (error) {
      console.error('Error loading salesman locations:', error)
      setSalesmenLocations([])
      setOnlineCount(0)
    } finally {
      setLoading(false)
    }
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

  const getMapMarkers = () => {
    return salesmenLocations
      .filter(r => r.latestLocation?.latitude && r.latestLocation?.longitude)
      .map(r => ({
        _id: r.latestLocation?._id || r.salesman?._id,
        name: r.salesman?.name || r.salesman?.email || 'Salesman',
        latitude: parseFloat(r.latestLocation.latitude),
        longitude: parseFloat(r.latestLocation.longitude),
        status: r.isOnline ? 'Online' : 'Offline',
        address: '',
        salesman: r.salesman,
        timestamp: r.latestLocation?.timestamp,
        accuracy: r.latestLocation?.accuracy,
      }))
  }

  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FaMapMarkerAlt className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Tracking</h1>
            <p className="text-gray-600">Monitor sales reps in real-time</p>
          </div>
        </div>
      </div>

      {/* Main Content - Map and Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Map Section - Takes 2/3 width on large screens */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          {/* Map Container */}
          <div className="flex-1 bg-gray-100 relative" style={{ minHeight: '500px' }}>
            {getMapMarkers().length > 0 ? (
              <GoogleMapView
                milestones={[]}
                visitTargets={getMapMarkers()}
                userLocation={null}
                center={
                  getMapMarkers()[0]
                    ? { lat: getMapMarkers()[0].latitude, lng: getMapMarkers()[0].longitude }
                    : { lat: 24.9141, lng: 67.0822 }
                }
                zoom={13}
                height="100%"
                showUserLocation={false}
                showRadius={false}
                isTracking={false}
                onMarkerClick={(target) => {
                  // Handle marker click - can show details modal if needed
                  console.log('Tracking clicked:', target)
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
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
        <div className="flex flex-col gap-4">
          {/* Controls */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-200">
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
            <div className="flex-1 overflow-y-auto p-4">
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
                        className={`p-3 rounded-lg border ${isOnline ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
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
                              <p className="text-xs text-gray-600 mt-1">
                                📍 {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
                              </p>
                            )}
                          </div>
                          {isOnline && (
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          )}
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
    </div>
  )
}

export default LiveTracking
