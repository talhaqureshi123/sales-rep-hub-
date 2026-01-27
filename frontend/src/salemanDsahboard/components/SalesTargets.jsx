import { useState, useEffect } from 'react'
import { getMySalesTargets, getMySalesTargetStats } from '../../services/salemanservices/salesTargetService'
import { 
  FaBullseye, 
  FaTrophy, 
  FaChartLine, 
  FaCalendarAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSpinner,
  FaPlus,
  FaStar
} from 'react-icons/fa'
import Swal from 'sweetalert2'

const SalesTargets = () => {
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({
    status: 'All',
    period: 'All',
    targetType: 'Orders' // Only show Orders type
  })

  useEffect(() => {
    loadSalesTargets()
    loadStats()
  }, [filters])

  const loadSalesTargets = async () => {
    try {
      setLoading(true)
      const filterParams = {}
      if (filters.status !== 'All') filterParams.status = filters.status
      if (filters.period !== 'All') filterParams.period = filters.period
      // Always filter by Orders type
      filterParams.targetType = 'Orders'

      const result = await getMySalesTargets(filterParams)
      if (result.success && result.data) {
        setTargets(result.data || [])
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Failed to load sales targets',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error loading sales targets:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading sales targets. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getMySalesTargetStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <FaCheckCircle className="w-5 h-5 text-green-600" />
      case 'Failed':
        return <FaTimesCircle className="w-5 h-5 text-red-600" />
      case 'Cancelled':
        return <FaTimesCircle className="w-5 h-5 text-gray-600" />
      default:
        return <FaClock className="w-5 h-5 text-blue-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Failed':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  const getTargetLabel = (targetType) => {
    switch (targetType) {
      case 'Orders':
        return { singular: 'order', plural: 'orders', unit: '' }
      case 'Revenue':
        return { singular: 'revenue', plural: 'revenue', unit: '£' }
      case 'Visits':
        return { singular: 'visit', plural: 'visits', unit: '' }
      case 'New Customers':
        return { singular: 'customer', plural: 'customers', unit: '' }
      case 'Quotes':
        return { singular: 'quote', plural: 'quotes', unit: '' }
      case 'Conversions':
        return { singular: 'conversion', plural: 'conversions', unit: '' }
      default:
        return { singular: 'item', plural: 'items', unit: '' }
    }
  }

  const formatTargetValue = (value, targetType) => {
    const label = getTargetLabel(targetType)
    if (targetType === 'Revenue') {
      return `${label.unit}${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return `${value.toLocaleString()} ${label.plural}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 text-[#e9931c] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sales targets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
            <FaBullseye className="w-5 h-5 sm:w-6 sm:h-6 text-[#e9931c]" />
            My Sales Targets
          </h2>
          <p className="text-sm sm:text-base text-gray-600">View and track your assigned sales targets</p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-5 border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Total Targets</p>
              <FaBullseye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-700">{stats.total || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">All time</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 sm:p-5 border border-green-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Active</p>
              <FaClock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-700">{stats.active || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">In progress</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 sm:p-5 border border-yellow-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Completed</p>
              <FaCheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-700">{stats.completed || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Achieved</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 sm:p-5 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Completion Rate</p>
              <FaChartLine className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-700">
              {stats.completionPercentage || 0}%
            </p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Overall progress</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
            <select
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="All">All Periods</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Type</label>
            <select
              value={filters.targetType}
              onChange={(e) => handleFilterChange('targetType', e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="Orders">Orders</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Targets List */}
      {targets.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
          <FaBullseye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg">No sales targets found</p>
          <p className="text-sm text-gray-500 mt-2">
            {filters.status !== 'All' || filters.period !== 'All'
              ? 'Try adjusting your filters'
              : 'No targets have been assigned to you yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {targets.map((target) => {
            const progressPercentage = target.targetValue > 0
              ? (target.currentProgress / target.targetValue) * 100
              : 0
            const isExceeded = target.currentProgress > target.targetValue
            const isCompleted = progressPercentage >= 100 || target.status === 'Completed'
            const remaining = Math.max(0, target.targetValue - target.currentProgress)
            const exceededBy = isExceeded ? target.currentProgress - target.targetValue : 0
            const targetLabel = getTargetLabel(target.targetType || 'Orders')

            return (
              <div
                key={target._id}
                className={`bg-white rounded-lg p-2 border shadow-sm hover:shadow-md transition-all ${
                  isExceeded 
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-white' 
                    : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-xs mb-0.5 flex items-center gap-1.5">
                      {target.targetName || `${target.targetType} Target`}
                      {isExceeded && (
                        <span className="flex items-center gap-1 px-1 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          <FaPlus className="w-2 h-2" />
                          Exceeded!
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-600">{target.targetType}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isExceeded && (
                      <div className="relative">
                        <FaStar className="w-4 h-4 text-yellow-400 animate-pulse" />
                        <FaPlus className="w-2.5 h-2.5 text-green-600 absolute -top-0.5 -right-0.5 bg-white rounded-full p-0.5" />
                      </div>
                    )}
                    {isCompleted && !isExceeded && (
                      <FaTrophy className="w-3.5 h-3.5 text-yellow-500" />
                    )}
                    <div className="scale-70">{getStatusIcon(target.status)}</div>
                  </div>
                </div>

                {/* Target Figures - Money Display */}
                <div className="mb-2 bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg p-1.5 border border-gray-300">
                  <div className="space-y-1.5">
                    {/* Total Target */}
                    <div className="bg-white rounded-lg p-1.5 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-0.5 font-medium">
                        Total Target {target.targetType}
                      </p>
                      <p className="text-base font-bold text-gray-800">
                        {formatTargetValue(target.targetValue || 0, target.targetType)}
                      </p>
                    </div>
                    
                    {/* Current Progress */}
                    <div className="bg-white rounded-lg p-1.5 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-0.5 font-medium">
                        Current {target.targetType}
                      </p>
                      <p className="text-base font-bold text-blue-600">
                        {formatTargetValue(target.currentProgress || 0, target.targetType)}
                      </p>
                    </div>
                    
                    {/* Remaining Target or Exceeded */}
                    {isExceeded ? (
                      <div className="bg-green-100 rounded-lg p-1.5 border border-green-400">
                        <p className="text-xs text-gray-700 mb-0.5 font-medium">
                          Exceeded By
                        </p>
                        <p className="text-lg font-bold text-green-700 flex items-center justify-center gap-1">
                          <FaPlus className="w-3 h-3" />
                          {formatTargetValue(exceededBy, target.targetType)}
                        </p>
                      </div>
                    ) : !isCompleted ? (
                      <div className="bg-orange-100 rounded-lg p-1.5 border border-orange-400">
                        <p className="text-xs text-gray-700 mb-0.5 font-medium">
                          Remaining Target {target.targetType}
                        </p>
                        <p className="text-lg font-bold text-orange-700">
                          {formatTargetValue(remaining, target.targetType)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-green-100 rounded-lg p-1.5 border border-green-400">
                        <p className="text-xs text-gray-700 mb-0.5 font-medium">Status</p>
                        <p className="text-base font-bold text-green-700">Target Achieved!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-1.5">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-600 font-medium">Progress</span>
                    <span className={`font-bold text-xs ${
                      isExceeded ? 'text-green-600' : 'text-gray-800'
                    }`}>
                      {isExceeded ? (
                        <span className="flex items-center gap-0.5">
                          {progressPercentage.toFixed(1)}%
                          <FaPlus className="w-2 h-2 text-green-600" />
                        </span>
                      ) : (
                        `${progressPercentage.toFixed(1)}%`
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 relative overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        isExceeded
                          ? 'bg-gradient-to-r from-green-500 to-green-600'
                          : isCompleted
                          ? 'bg-green-500'
                          : progressPercentage >= 75
                          ? 'bg-blue-500'
                          : progressPercentage >= 50
                          ? 'bg-yellow-500'
                          : 'bg-orange-500'
                      }`}
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    />
                    {isExceeded && (
                      <div className="absolute top-0 right-0 h-1.5 w-1.5 bg-green-600 rounded-full flex items-center justify-center">
                        <FaPlus className="w-1 h-1 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-1.5 flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(target.status)}`}>
                    {target.status}
                  </span>
                  {isExceeded && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
                      <FaStar className="w-2 h-2" />
                      Exceeded
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-0.5 text-xs text-gray-600 border-t pt-1.5">
                  <div className="flex items-center gap-1">
                    <FaCalendarAlt className="w-2.5 h-2.5 text-gray-400" />
                    <span>
                      {new Date(target.startDate).toLocaleDateString()} - {new Date(target.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FaChartLine className="w-2.5 h-2.5 text-gray-400" />
                    <span>Period: {target.period}</span>
                  </div>
                  {target.createdBy && typeof target.createdBy === 'object' && (
                    <div className="text-xs text-gray-500">
                      Assigned by: {target.createdBy.name || target.createdBy.email}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SalesTargets
