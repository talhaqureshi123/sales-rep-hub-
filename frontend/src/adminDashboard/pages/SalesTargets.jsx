import { useState, useEffect } from 'react'
import { FaBullseye, FaCheckCircle, FaChartLine, FaExclamationTriangle, FaFilter, FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaDollarSign } from 'react-icons/fa'
import Swal from 'sweetalert2'
import { getSalesTargets, getSalesTarget, createSalesTarget, updateSalesTarget, deleteSalesTarget } from '../../services/adminservices/salesTargetService'
import { getUsers } from '../../services/adminservices/userService'

// Local date in YYYY-MM-DD format (avoids UTC timezone shifting)
const getLocalDateString = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Period = fixed days: Week 7, Month 30, Quarter 90, Yearly 365
const getPeriodDays = (period) => {
  switch (period) {
    case 'Daily': return 0
    case 'Weekly': return 7
    case 'Monthly': return 30
    case 'Quarterly': return 90  // 3 months × 30 days
    case 'Yearly': return 365
    default: return 0
  }
}

// End date = start date + period days (startDateStr in YYYY-MM-DD)
const calculateEndDateFromStart = (startDateStr, period) => {
  if (!startDateStr || !period) return ''
  const days = getPeriodDays(period)
  const start = new Date(startDateStr)
  if (isNaN(start.getTime())) return ''
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  return getLocalDateString(end)
}

// Calculate start and end dates based on period (starting from today) – Month 30 din, Week 7 din, Quarter 90 din
const calculatePeriodDates = (period) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startStr = getLocalDateString(today)
  const endStr = calculateEndDateFromStart(startStr, period) || startStr
  return {
    startDate: startStr,
    endDate: endStr
  }
}

const SalesTargets = () => {
  const [targets, setTargets] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState(null)

  const [filters, setFilters] = useState({
    salesman: 'All',
    status: 'All',
    period: 'All',
    fromDate: '',
    targetType: 'Orders', // Only show Orders type targets
  })

  const [formData, setFormData] = useState({
    salesman: '',
    targetName: '',
    targetType: 'Orders', // Default to Orders
    targetValue: 0,
    targetAmount: '', // Optional: target amount in £
    period: '',
    startDate: '',
    endDate: '',
  })

  const statusOptions = ['All', 'Active', 'Completed', 'Failed', 'Cancelled']
  const periodOptions = ['All', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']
  const targetTypeOptions = ['Orders'] // Only Orders type allowed

  useEffect(() => {
    loadSalesmen()
    loadTargets()
  }, [])

  useEffect(() => {
    loadTargets()
  }, [filters])

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

  const loadTargets = async () => {
    setLoading(true)
    try {
      const result = await getSalesTargets({
        salesman: filters.salesman !== 'All' ? filters.salesman : undefined,
        status: filters.status !== 'All' ? filters.status : undefined,
        period: filters.period !== 'All' ? filters.period : undefined,
        fromDate: filters.fromDate || undefined,
      })
      if (result.success && result.data) {
        setTargets(result.data)
      } else {
        console.error('Error loading targets:', result.message)
        setTargets([])
      }
    } catch (error) {
      console.error('Error loading targets:', error)
      setTargets([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    const updatedFormData = {
      ...formData,
      [name]: value,
    }

    // Period = 30 din month, 7 din week, 90 din quarter – end date auto from start
    if (name === 'period' && value) {
      if (updatedFormData.startDate) {
        updatedFormData.endDate = calculateEndDateFromStart(updatedFormData.startDate, value) || updatedFormData.endDate
      } else {
        const dates = calculatePeriodDates(value)
        updatedFormData.startDate = dates.startDate
        updatedFormData.endDate = dates.endDate
      }
    }
    if (name === 'startDate' && value && formData.period) {
      updatedFormData.endDate = calculateEndDateFromStart(value, formData.period) || updatedFormData.endDate
    }

    setFormData(updatedFormData)
  }

  const handleCreateTarget = async (e) => {
    e.preventDefault()
    if (!formData.salesman || !formData.targetName || !formData.targetType || !formData.period || !formData.startDate || !formData.endDate) {
      await Swal.fire({
        icon: 'warning',
        title: 'Required Fields',
        text: 'Please fill in all required fields',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    setLoading(true)
    try {
      const payload = { ...formData, targetValue: formData.targetValue != null ? Number(formData.targetValue) : 0 }
      if (formData.targetAmount === '' || formData.targetAmount == null) delete payload.targetAmount
      else payload.targetAmount = Number(formData.targetAmount)
      const result = await createSalesTarget(payload)
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Sales target created successfully!',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
        setShowCreateModal(false)
        resetForm()
        loadTargets()
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Error creating sales target',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error creating target:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating sales target',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditTarget = async (targetId) => {
    try {
      const result = await getSalesTarget(targetId)
      if (result.success && result.data) {
        const target = result.data
        setSelectedTarget(target)
        const startStr = target.startDate ? getLocalDateString(new Date(target.startDate)) : ''
        const period = target.period || ''
        // End date = start + period days (Month 30, Week 7, Quarter 90)
        const endStr = startStr && period
          ? calculateEndDateFromStart(startStr, period)
          : (target.endDate ? getLocalDateString(new Date(target.endDate)) : '')
        setFormData({
          salesman: target.salesman._id || target.salesman,
          targetName: target.targetName || '',
          targetType: target.targetType || '',
          targetValue: target.targetValue || 0,
          targetAmount: target.targetAmount || '',
          period,
          startDate: startStr,
          endDate: endStr,
        })
        setShowEditModal(true)
      }
    } catch (error) {
      console.error('Error loading target:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading target details',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleUpdateTarget = async (e) => {
    e.preventDefault()
    if (!selectedTarget) return

    setLoading(true)
    try {
      // Ensure dates are sent in correct format
      const updateData = {
        ...formData,
        targetAmount: (formData.targetAmount === '' || formData.targetAmount == null) ? undefined : Number(formData.targetAmount),
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      }
      console.log('📅 Updating target with dates:', { startDate: updateData.startDate, endDate: updateData.endDate })
      const result = await updateSalesTarget(selectedTarget._id, updateData)
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Sales target updated successfully!',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
        setShowEditModal(false)
        resetForm()
        loadTargets()
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Error updating sales target',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error updating target:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating sales target',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveTarget = async (targetId) => {
    setLoading(true)
    try {
      const result = await updateSalesTarget(targetId, { approvalStatus: 'Approved' })
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Approved!',
          text: 'Sales target has been approved and is now visible to the salesman.',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
        loadTargets()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to approve sales target',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error approving target:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error approving sales target',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTarget = async (targetId) => {
    const confirmResult = await Swal.fire({
      icon: 'warning',
      title: 'Delete Sales Target?',
      text: 'Are you sure you want to delete this sales target? This action cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    })
    if (!confirmResult.isConfirmed) return

    setLoading(true)
    try {
      const result = await deleteSalesTarget(targetId)
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Sales target deleted successfully!',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
        loadTargets()
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Error deleting sales target',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error deleting target:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting sales target',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      salesman: '',
      targetName: '',
      targetType: 'Orders', // Default to Orders
      targetValue: 0,
      targetAmount: '',
      period: '',
      startDate: '',
      endDate: '',
    })
    setSelectedTarget(null)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatProgress = (target) => {
    const val = target.targetValue || 0
    if (val === 0) return null // No order target set in create – don't show "0 / 0 orders"
    return `${target.currentProgress || 0} / ${val} orders`
  }

  const calculateProgressPercentage = (target) => {
    const targetVal = target.targetValue || 0
    if (targetVal > 0) {
      const percentage = ((target.currentProgress || 0) / targetVal) * 100
      if (percentage > 0 && percentage < 1) return percentage.toFixed(1)
      return Math.min(percentage, 100).toFixed(0)
    }
    // No order target: use amount-based % if targetAmount set
    const amount = target.targetAmount || 0
    if (amount <= 0) return 0
    const current = target.currentAmount || 0
    const pct = (current / amount) * 100
    if (pct > 0 && pct < 1) return pct.toFixed(1)
    return Math.min(pct, 100).toFixed(0)
  }

  const calculateDaysRemaining = (endDate) => {
    if (!endDate) return 0
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-orange-100 text-orange-800'
      case 'Completed':
        return 'bg-blue-100 text-blue-800'
      case 'Failed':
        return 'bg-red-100 text-red-800'
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Targets Management</h1>
          <p className="text-gray-600">Create and manage sales targets for your team member</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-5 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
        >
          <FaPlus className="w-5 h-5" />
          Create New Target
        </button>
      </div>

      {/* Info: Which orders count */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
        <p className="font-medium text-gray-900 mb-1">Orders counted in target</p>
        <p className="text-gray-600">Progress counts orders with status: <span className="font-semibold text-[#e9931c]">Confirmed</span>, <span className="font-semibold text-[#e9931c]">Processing</span>, <span className="font-semibold text-[#e9931c]">Dispatched</span>, <span className="font-semibold text-[#e9931c]">Delivered</span>. Draft, Pending and Cancelled orders are not counted.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Sales Rep Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep</label>
            <select
              value={filters.salesman}
              onChange={(e) => setFilters({ ...filters, salesman: e.target.value })}
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
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters({ ...filters, status })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.status === status
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* From Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div className="relative">
              <FaCalendarAlt className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
              />
            </div>
          </div>

          {/* Period Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
            <div className="flex flex-wrap gap-2">
              {periodOptions.map((period) => (
                <button
                  key={period}
                  onClick={() => setFilters({ ...filters, period })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.period === period
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Targets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading targets...</p>
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaBullseye className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No targets found</h3>
          <p className="text-gray-600">Create your first sales target to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((target) => {
            const progressPercent = calculateProgressPercentage(target)
            const startDate = target.startDate ? new Date(target.startDate) : null
            const endDate = target.endDate ? new Date(target.endDate) : null
            const daysRemaining = calculateDaysRemaining(target.endDate)
            const salesmanName = target.salesman?.name || target.salesman?.email || 'N/A'
            const salesmanEmail = target.salesman?.email || ''

            return (
              <div
                key={target._id || target.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                {/* Name and Tag */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {salesmanName.toLowerCase()}
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {target.period}
                    </span>
                  </div>
                </div>

                {/* Email */}
                {salesmanEmail && (
                  <p className="text-sm text-gray-600 mb-3">{salesmanEmail}</p>
                )}

                {/* Status Badge */}
                <div className="mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(target.status)}`}>
                    {target.status}
                  </span>
                </div>

                {/* Target name with Icon */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FaDollarSign className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-900">{target.targetName}</span>
                  </div>
                  {((target.targetValue || 0) > 0) && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {target.targetType}
                    </span>
                  )}
                </div>

                {/* Progress – hide "X / Y orders" when no order target */}
                <div className="mb-4">
                  {formatProgress(target) != null && (
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      {formatProgress(target)}
                    </p>
                  )}
                  {target.targetAmount != null && target.targetAmount > 0 && (
                    <div className="text-sm space-y-0.5 mb-1">
                      <p className="font-medium text-gray-700">Target: £{Number(target.targetAmount).toFixed(2)}</p>
                      <p className="font-medium text-[#e9931c]">Amount: £{Number(target.currentAmount || 0).toFixed(2)}</p>
                      <p className="font-medium text-blue-600">Remaining: £{Number(target.remainingAmount != null ? target.remainingAmount : Math.max(0, target.targetAmount - (target.currentAmount || 0))).toFixed(2)}</p>
                    </div>
                  )}
                  {(!target.targetAmount || target.targetAmount <= 0) && target.currentAmount != null && (
                    <p className="text-sm font-medium text-[#e9931c] mb-1">
                      Amount: £{Number(target.currentAmount || 0).toFixed(2)}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    {progressPercent}% Complete
                  </p>
                </div>

                {/* Date Range */}
                {startDate && endDate && (
                  <p className="text-xs text-gray-600 mb-3">
                    {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}

                {/* Remaining Time */}
                {daysRemaining > 0 && (
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                      {daysRemaining} days remaining
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleEditTarget(target._id || target.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                  >
                    <FaEdit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTarget(target._id || target.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                  >
                    <FaTrash className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Target Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white w-full h-full max-w-full rounded-none min-h-[100dvh] max-h-[100dvh] sm:w-auto sm:h-auto sm:max-w-2xl sm:min-h-0 sm:max-h-[90vh] sm:rounded-t-xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto">
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">Create New Target</h3>
                <p className="text-sm text-gray-600">Set up a new sales target for your team member</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTarget} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Rep <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="salesman"
                    value={formData.salesman}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select rep</option>
                    {salesmen.map((salesman) => (
                      <option key={salesman._id} value={salesman._id}>
                        {salesman.name || salesman.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="targetName"
                    value={formData.targetName}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Q1 2025 Orders Target"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>

                {/* Target Type is always Orders - hidden field */}
                <input type="hidden" name="targetType" value="Orders" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Amount (£) <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <input
                    type="number"
                    name="targetAmount"
                    value={formData.targetAmount}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                  <p className="text-xs text-gray-500 mt-1">Target sales amount in £ – will show Target / Amount / Remaining</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="period"
                    value={formData.period}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select period</option>
                    {periodOptions.filter(p => p !== 'All').map((period) => (
                      <option key={period} value={period}>{period}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Week = 7 days, Month = 30 days, Quarter = 90 days, Year = 365 days</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FaCalendarAlt className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <FaCalendarAlt className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-8 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      />
                    </div>
                  </div>
                </div>

              </div>
              <div className="flex-shrink-0 flex gap-3 justify-end p-4 sm:p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-xl sm:rounded-b-lg pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {showEditModal && selectedTarget && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white w-full h-full max-w-full rounded-none min-h-[100dvh] max-h-[100dvh] sm:w-auto sm:h-auto sm:max-w-2xl sm:min-h-0 sm:max-h-[90vh] sm:rounded-t-xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto">
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">Edit Target</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateTarget} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Same form fields as create modal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep *</label>
                  <select
                    name="salesman"
                    value={formData.salesman}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select rep</option>
                    {salesmen.map((salesman) => (
                      <option key={salesman._id} value={salesman._id}>
                        {salesman.name || salesman.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Name *</label>
                  <input
                    type="text"
                    name="targetName"
                    value={formData.targetName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>

                {/* Target Type is always Orders - hidden field */}
                <input type="hidden" name="targetType" value="Orders" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Period *</label>
                  <select
                    name="period"
                    value={formData.period}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">Select period</option>
                    {periodOptions.filter(p => p !== 'All').map((period) => (
                      <option key={period} value={period}>{period}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Week = 7 days, Month = 30 days, Quarter = 90 days, Year = 365 days</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    />
                  </div>
                </div>

              </div>
              <div className="flex-shrink-0 flex gap-3 justify-end p-4 sm:p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-xl sm:rounded-b-lg pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    resetForm()
                  }}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-sm sm:px-6 sm:py-2 sm:text-base bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default SalesTargets
