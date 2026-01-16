import { useState, useEffect } from 'react'
import { FaCamera, FaSearch, FaUser, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaEye } from 'react-icons/fa'
import { getAllTracking } from '../../services/adminservices/trackingService'
import { getUsers } from '../../services/adminservices/userService'

const ShiftPhotos = () => {
  const [shifts, setShifts] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSalesman, setSelectedSalesman] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedShift, setSelectedShift] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)

  useEffect(() => {
    loadSalesmen()
    loadShifts()
  }, [selectedSalesman, selectedStatus, selectedDate])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadShifts()
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

  const loadShifts = async () => {
    setLoading(true)
    try {
      const result = await getAllTracking({
        salesman: selectedSalesman !== 'All' ? selectedSalesman : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        date: selectedDate || undefined,
        search: searchTerm || undefined,
      })
      if (result.success && result.data) {
        setShifts(result.data)
      } else {
        console.error('Error loading shifts:', result.message)
        setShifts([])
      }
    } catch (error) {
      console.error('Error loading shifts:', error)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewPhoto = (shift) => {
    setSelectedShift(shift)
    setShowImageModal(true)
  }

  const formatTime = (date) => {
    if (!date) return null
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (date) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getLocationString = (location) => {
    if (!location) return 'No location'
    if (location.latitude && location.longitude) {
      return `${location.latitude}, ${location.longitude}`
    }
    if (location.address) return location.address
    return 'No location'
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FaCamera className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shift Photos</h1>
            <p className="text-gray-600">View and manage shift photos from sales team.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Salesman Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep</label>
            <select
              value={selectedSalesman}
              onChange={(e) => setSelectedSalesman(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="All">All Reps</option>
              {salesmen.map((salesman) => (
                <option key={salesman._id} value={salesman._id}>
                  {salesman.name || salesman.email}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="stopped">Stopped</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <div className="relative">
              <FaCalendarAlt className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by location..."
                className="w-full pl-12 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4">
        <p className="text-gray-600">Showing {shifts.length} shifts</p>
      </div>

      {/* Shifts Grid or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shifts...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaCamera className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No shifts found</h3>
          <p className="text-gray-600">Shift data will appear here when sales team starts tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map((shift) => (
            <div
              key={shift._id || shift.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Photos Section - Three images */}
              <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50">
                {/* Start Meter Photo */}
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center relative group overflow-hidden">
                  {shift.speedometerImage ? (
                    <>
                      <img
                        src={shift.speedometerImage}
                        alt="Start Meter"
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => handleViewPhoto(shift)}
                      />
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewPhoto(shift)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <FaCamera className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-gray-400 text-xs">No photo</p>
                    </div>
                  )}
                </div>

                {/* Visited Area Photo */}
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center relative group overflow-hidden">
                  {shift.visitedAreaImages?.length > 1 ? (
                    <>
                      <div
                        className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 cursor-pointer"
                        onClick={() => handleViewPhoto(shift)}
                        title="View"
                      >
                        {shift.visitedAreaImages.slice(0, 4).map((img, idx) => (
                          <img
                            key={`${shift._id}-visitimg-${idx}`}
                            src={img}
                            alt={`Visited area ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ))}
                      </div>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewPhoto(shift)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : shift.visitedAreaImage ? (
                    <>
                      <img
                        src={shift.visitedAreaImage}
                        alt="Visited area"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => handleViewPhoto(shift)}
                      />
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewPhoto(shift)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <FaCamera className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-gray-400 text-xs">No photo</p>
                    </div>
                  )}
                </div>

                {/* End Meter Photo */}
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center relative group overflow-hidden">
                  {shift.endingMeterImage ? (
                    <>
                      <img
                        src={shift.endingMeterImage}
                        alt="End Meter"
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => handleViewPhoto(shift)}
                      />
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewPhoto(shift)}
                          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="View"
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <FaCamera className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-gray-400 text-xs">No photo</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shift Details */}
              <div className="p-4">
                {/* Salesman */}
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {shift.salesman?.name || shift.salesman?.email || 'N/A'}
                    </p>
                    {shift.salesman?.email && (
                      <p className="text-xs text-gray-500">
                        {shift.salesman.email}
                      </p>
                    )}
                  </div>
                  {/* Status Badge */}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    shift.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : shift.status === 'stopped' || shift.status === 'completed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {shift.status === 'active' ? 'Active' : shift.status === 'stopped' ? 'Stopped' : shift.status === 'completed' ? 'Completed' : 'Unknown'}
                  </span>
                </div>

                {/* Date */}
                <div className="mb-3">
                  <p className="text-sm text-gray-700">
                    {formatDate(shift.shiftDate || shift.startedAt || shift.createdAt)}
                  </p>
                </div>

                {/* Start Shift */}
                <div className="mb-2">
                  <p className="text-sm text-gray-700">
                    <span className="text-gray-500">Start Shift</span> at {formatTime(shift.startedAt || shift.createdAt) || 'N/A'}
                  </p>
                </div>

                {/* End Shift */}
                <div className="mb-3">
                  <p className="text-sm text-gray-700">
                    <span className="text-gray-500">End Shift</span> is {
                      (shift.status === 'stopped' || shift.status === 'completed' || shift.stoppedAt) 
                        ? formatTime(shift.stoppedAt) 
                        : 'Not ended yet.'
                    }
                  </p>
                </div>

                {/* Location */}
                <div className="mb-3">
                  <p className="text-sm text-gray-700">
                    {getLocationString(shift.startLocation || shift.endLocation)}
                  </p>
                </div>

                {/* Total Visits */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Visits: </span>
                    {shift.visitCount || 0}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-medium">Estimated KM: </span>
                    {Number(shift.estimatedKilometers || 0).toFixed(2)} km
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-medium">Actual KM (Visits): </span>
                    {Number(shift.actualKilometers || 0).toFixed(2)} km
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Shift Photo - {selectedShift.salesman?.name || selectedShift.salesman?.email}
              </h3>
              <button
                onClick={() => {
                  setShowImageModal(false)
                  setSelectedShift(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {selectedShift.speedometerImage && (
                  <div>
                    <h4 className="font-medium mb-2">Meter Photo:</h4>
                    <img
                      src={selectedShift.speedometerImage}
                      alt="Shift meter"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}
                {selectedShift.visitedAreaImage && (
                  <div>
                    <h4 className="font-medium mb-2">
                      Visited Area Photo{selectedShift.visitedAreaImages?.length > 1 ? 's' : ''}:
                    </h4>
                    {selectedShift.visitedAreaImages?.length > 1 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedShift.visitedAreaImages.slice(0, 8).map((img, idx) => (
                          <img
                            key={`${selectedShift._id}-modal-visitimg-${idx}`}
                            src={img}
                            alt={`Visited area ${idx + 1}`}
                            className="w-full h-auto rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <img
                        src={selectedShift.visitedAreaImage}
                        alt="Visited area"
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                  </div>
                )}
              </div>
              {selectedShift.endingMeterImage && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Ending Meter:</h4>
                  <img
                    src={selectedShift.endingMeterImage}
                    alt="Ending meter"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FaUser className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Salesman:</span> {selectedShift.salesman?.name || selectedShift.salesman?.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Date:</span> {formatDate(selectedShift.shiftDate || selectedShift.startedAt || selectedShift.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FaClock className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Start:</span> {formatTime(selectedShift.startedAt || selectedShift.createdAt)}
                  </p>
                </div>
                {selectedShift.stoppedAt && (
                  <div className="flex items-center gap-2">
                    <FaClock className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">End:</span> {formatTime(selectedShift.stoppedAt)}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FaMapMarkerAlt className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Location:</span> {getLocationString(selectedShift.startLocation || selectedShift.endLocation)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Visits:</span> {selectedShift.visitCount || 0}
                  </p>
                </div>
                {selectedShift.totalDistance && (
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Total Distance:</span> {selectedShift.totalDistance.toFixed(2)} km
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Estimated KM:</span> {Number(selectedShift.estimatedKilometers || 0).toFixed(2)} km
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShiftPhotos
