import { useState, useEffect } from 'react'
import { getVisitTargets, getSalesmanTargetStats } from '../../services/adminservices/visitTargetService'
import { getUsers } from '../../services/adminservices/userService'
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaCheckCircle,
  FaSearch,
  FaFilter,
  FaClock
} from 'react-icons/fa'

const VisitedTargets = () => {
  const [visitTargets, setVisitTargets] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatus, setFilterStatus] = useState('Completed')
  const [filterSalesman, setFilterSalesman] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [salesmanStats, setSalesmanStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    loadSalesmen()
    loadVisitTargets()
  }, [])

  useEffect(() => {
    loadVisitTargets()
    // Load salesman stats when a salesman is selected
    if (filterSalesman) {
      loadSalesmanStats(filterSalesman)
    } else {
      setSalesmanStats(null)
    }
  }, [selectedDate, filterStatus, filterSalesman, searchTerm, filterCity])

  const loadVisitTargets = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus && filterStatus !== 'All') params.status = filterStatus
      if (filterSalesman) params.salesman = filterSalesman
  
      const result = await getVisitTargets(params)
      if (result.success && result.data) {
        let targets = result.data
  
        // Filter by date
        if (selectedDate) {
          const selected = new Date(selectedDate)
          targets = targets.filter(target => {
            const dateToCheck = target.completedAt || target.visitDate
            if (!dateToCheck) return false
            const d = new Date(dateToCheck)
            return d.getFullYear() === selected.getFullYear() &&
                   d.getMonth() === selected.getMonth() &&
                   d.getDate() === selected.getDate()
          })
        }
        
        // Filter by city
        if (filterCity) {
          targets = targets.filter(target =>
            target.city?.toLowerCase().includes(filterCity.toLowerCase())
          )
        }
  
        // Search by business name or contact
        if (searchTerm) {
          targets = targets.filter(target =>
            (target.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            target.contact?.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        }
  
        setVisitTargets(targets)
      } else {
        setVisitTargets([])
      }
    } catch (error) {
      console.error(error)
      setVisitTargets([])
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

  const loadSalesmanStats = async (salesmanId) => {
    if (!salesmanId) {
      setSalesmanStats(null)
      return
    }

    setLoadingStats(true)
    try {
      const result = await getSalesmanTargetStats(salesmanId)
      if (result.success && result.data) {
        setSalesmanStats(result.data)
      } else {
        console.error('Failed to load salesman stats:', result.message)
        setSalesmanStats(null)
      }
    } catch (error) {
      console.error('Error loading salesman stats:', error)
      setSalesmanStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'Low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Visited Targets</h1>
        <p className="text-gray-600">View all completed visit targets</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200 shadow-sm">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            />
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <FaFilter className="text-gray-500" />
          {['All', 'Completed', 'Pending', 'In Progress', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status === 'All' ? '' : status)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${(filterStatus === status || (status === 'All' && !filterStatus))
                ? 'bg-[#e9931c] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Additional Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search business or contact..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            />
          </div>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
          >
            <option value="">Filter by city</option>
            {[...new Set(visitTargets.map(vt => vt.city).filter(Boolean))].map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <select
            value={filterSalesman}
            onChange={(e) => setFilterSalesman(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
          >
            <option value="">Filter by salesman</option>
            {salesmen.map((salesman) => (
              <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                {salesman.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salesman Stats */}
      {filterSalesman && salesmanStats && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Salesman Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-700 mb-1">Total Targets</p>
              <p className="text-3xl font-bold text-blue-900">{salesmanStats.totalTargets}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-green-700 mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-900">{salesmanStats.completedTargets}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-yellow-700 mb-1">In Progress</p>
              <p className="text-3xl font-bold text-yellow-900">{salesmanStats.inProgressTargets}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-purple-700 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-900">{salesmanStats.completionRate}%</p>
            </div>
          </div>

          {salesmanStats.recentVisits && salesmanStats.recentVisits.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Recent Completed Visits</h3>
              <div className="space-y-3">
                {salesmanStats.recentVisits.map((visit, index) => (
                  <div key={index} className="border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r">
                    <p className="text-sm font-medium text-gray-900">{visit.name}</p>
                    <p className="text-xs text-gray-500">
                      {visit.city && `${visit.city}, `}{visit.state}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(visit.completedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visit Targets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading visit targets...</p>
        </div>
      ) : visitTargets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaCalendarAlt className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No visits scheduled</h3>
          <p className="text-gray-600">No completed visit targets found for the selected date and filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visitTargets.map((target) => (
            <div
              key={target._id}
              className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{target.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(target.status)}`}>
                      {target.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(target.priority)}`}>
                      {target.priority}
                    </span>
                  </div>
                  {target.description && (
                    <p className="text-gray-600 mb-2">{target.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="flex items-start gap-2">
                  <FaMapMarkerAlt className="w-5 h-5 text-[#e9931c] mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-sm font-medium text-gray-900">
                      {target.address || target.city || 'N/A'}
                    </p>
                    {target.city && target.state && (
                      <p className="text-xs text-gray-500">{target.city}, {target.state}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FaUser className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">Salesman</p>
                    <p className="text-sm font-medium text-gray-900">
                      {target.salesman?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FaCheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">Completed At</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(target.completedAt)}
                    </p>
                  </div>
                </div>

                {target.visitDate && (
                  <div className="flex items-start gap-2">
                    <FaClock className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(target.visitDate)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {target.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Notes:</p>
                  <p className="text-sm text-gray-900">{target.notes}</p>
                </div>
              )}

              {target.comments && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 mb-1">Comments:</p>
                  <p className="text-sm text-gray-900">{target.comments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default VisitedTargets
