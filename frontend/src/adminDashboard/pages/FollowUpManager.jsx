import { useState, useEffect } from 'react'
import { FaBell, FaSearch, FaEdit, FaTrash, FaEye, FaPlus, FaClock, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt, FaPhone, FaEnvelope, FaWalking, FaFileAlt, FaFlask, FaShoppingCart, FaChevronDown } from 'react-icons/fa'
import { getFollowUps, getFollowUp, createFollowUp, updateFollowUp, deleteFollowUp } from '../../services/adminservices/followUpService'

const FollowUpManager = () => {
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedType, setSelectedType] = useState('All')
  const [selectedPriority, setSelectedPriority] = useState('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState(null)
  const [expandedFollowUps, setExpandedFollowUps] = useState(new Set())

  const statusOptions = ['All', 'Overdue', 'Today', 'Upcoming', 'Completed']
  const typeOptions = ['All', 'Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check']
  const priorityOptions = ['All', 'Low', 'Medium', 'High', 'Urgent']

  const [formData, setFormData] = useState({
    salesman: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    type: 'Call',
    priority: 'Medium',
    scheduledDate: '',
    dueDate: '',
    description: '',
    notes: '',
  })

  useEffect(() => {
    loadFollowUps()
  }, [selectedStatus, selectedType, selectedPriority])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadFollowUps()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadFollowUps = async () => {
    setLoading(true)
    try {
      const result = await getFollowUps({
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        type: selectedType !== 'All' ? selectedType : undefined,
        priority: selectedPriority !== 'All' ? selectedPriority : undefined,
        search: searchTerm || undefined,
      })
      if (result.success && result.data) {
        setFollowUps(result.data)
      } else {
        console.error('Error loading follow-ups:', result.message)
        setFollowUps([])
      }
    } catch (error) {
      console.error('Error loading follow-ups:', error)
      setFollowUps([])
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

  const handleCreateFollowUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await createFollowUp(formData)
      if (result.success) {
        alert('Follow-up created successfully!')
        setShowCreateModal(false)
        resetForm()
        loadFollowUps()
      } else {
        alert(result.message || 'Error creating follow-up')
      }
    } catch (error) {
      console.error('Error creating follow-up:', error)
      alert('Error creating follow-up')
    } finally {
      setLoading(false)
    }
  }

  const handleEditFollowUp = async (followUpId) => {
    try {
      const result = await getFollowUp(followUpId)
      if (result.success && result.data) {
        setSelectedFollowUp(result.data)
        setFormData({
          salesman: result.data.salesman?._id || '',
          customerName: result.data.customerName || '',
          customerEmail: result.data.customerEmail || '',
          customerPhone: result.data.customerPhone || '',
          type: result.data.type || 'Call',
          priority: result.data.priority || 'Medium',
          scheduledDate: result.data.scheduledDate ? new Date(result.data.scheduledDate).toISOString().split('T')[0] : '',
          dueDate: result.data.dueDate ? new Date(result.data.dueDate).toISOString().split('T')[0] : '',
          description: result.data.description || '',
          notes: result.data.notes || '',
        })
        setShowEditModal(true)
      }
    } catch (error) {
      console.error('Error loading follow-up:', error)
      alert('Error loading follow-up details')
    }
  }

  const handleUpdateFollowUp = async (e) => {
    e.preventDefault()
    if (!selectedFollowUp) return

    setLoading(true)
    try {
      const result = await updateFollowUp(selectedFollowUp._id, formData)
      if (result.success) {
        alert('Follow-up updated successfully!')
        setShowEditModal(false)
        resetForm()
        loadFollowUps()
      } else {
        alert(result.message || 'Error updating follow-up')
      }
    } catch (error) {
      console.error('Error updating follow-up:', error)
      alert('Error updating follow-up')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFollowUp = async (followUpId) => {
    if (!window.confirm('Are you sure you want to delete this follow-up?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteFollowUp(followUpId)
      if (result.success) {
        alert('Follow-up deleted successfully!')
        loadFollowUps()
      } else {
        alert(result.message || 'Error deleting follow-up')
      }
    } catch (error) {
      console.error('Error deleting follow-up:', error)
      alert('Error deleting follow-up')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpandFollowUp = (followUpId) => {
    setExpandedFollowUps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(followUpId)) {
        newSet.delete(followUpId)
      } else {
        newSet.add(followUpId)
      }
      return newSet
    })
  }

  const handleViewFollowUp = async (followUpId) => {
    try {
      const result = await getFollowUp(followUpId)
      if (result.success && result.data) {
        const fu = result.data
        alert(
          `Follow-up #${fu.followUpNumber}\n` +
          `Customer: ${fu.customerName}\n` +
          `Type: ${fu.type}\n` +
          `Priority: ${fu.priority}\n` +
          `Status: ${fu.status}\n` +
          `Due Date: ${fu.dueDate ? new Date(fu.dueDate).toLocaleDateString() : 'N/A'}\n` +
          (fu.description ? `Description: ${fu.description}` : '')
        )
      }
    } catch (error) {
      console.error('Error loading follow-up:', error)
      alert('Error loading follow-up details')
    }
  }

  const resetForm = () => {
    setFormData({
      salesman: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      type: 'Call',
      priority: 'Medium',
      scheduledDate: '',
      dueDate: '',
      description: '',
      notes: '',
    })
    setSelectedFollowUp(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Overdue':
        return 'bg-red-100 text-red-800'
      case 'Today':
        return 'bg-orange-100 text-orange-800'
      case 'Upcoming':
        return 'bg-blue-100 text-blue-800'
      case 'Completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-800'
      case 'High':
        return 'bg-orange-100 text-orange-800'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'Low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Call':
        return <FaPhone className="w-4 h-4" />
      case 'Email':
        return <FaEnvelope className="w-4 h-4" />
      case 'Visit':
        return <FaWalking className="w-4 h-4" />
      case 'Quote Follow-up':
        return <FaFileAlt className="w-4 h-4" />
      case 'Sample Feedback':
        return <FaFlask className="w-4 h-4" />
      case 'Order Check':
        return <FaShoppingCart className="w-4 h-4" />
      default:
        return <FaBell className="w-4 h-4" />
    }
  }

  const getDisplayStatus = (status) => {
    // Image mein "Pending" dikh raha hai, but model mein "Upcoming" hai
    // So "Upcoming" ko "Pending" ke tarah show karenge
    if (status === 'Upcoming') {
      return 'Pending'
    }
    return status
  }

  const filteredFollowUps = followUps

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FaBell className="w-8 h-8 text-[#e9931c]" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Follow-Up Manager</h1>
            <p className="text-gray-600">Track and manage customer follow-ups.</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-5 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
        >
          <FaPlus className="w-5 h-5" />
          <span>Create Follow-Up</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        {/* Status Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedType === type
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.map((priority) => (
              <button
                key={priority}
                onClick={() => setSelectedPriority(priority)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedPriority === priority
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search follow-ups by number, customer name, email, or description..."
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
      </div>

      {/* Follow-Ups List or Empty State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading follow-ups...</p>
        </div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaBell className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No follow-ups found</h3>
          <p className="text-gray-600">Follow-ups will appear here when you create them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFollowUps.map((followUp) => {
            const followUpId = followUp._id || followUp.id
            const isExpanded = expandedFollowUps.has(followUpId)
            const displayStatus = getDisplayStatus(followUp.status)
            const dueDate = followUp.dueDate ? new Date(followUp.dueDate) : null
            const scheduledDate = followUp.scheduledDate ? new Date(followUp.scheduledDate) : null
            
            return (
              <div
                key={followUpId}
                className="bg-white border-l-4 border-red-500 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Customer Name as Heading */}
                      <h3 className="text-lg font-bold text-gray-900 mb-3">
                        {followUp.customerName}
                      </h3>
                      
                      {/* Type Icon and Due Date */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-gray-600">
                          {getTypeIcon(followUp.type)}
                        </span>
                        {dueDate && (
                          <p className="text-sm text-gray-700">
                            Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      
                      {/* Priority and Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(followUp.priority)}`}>
                          {followUp.priority}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(followUp.status)}`}>
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                    
                    {/* Dropdown Arrow */}
                    <button
                      onClick={() => toggleExpandFollowUp(followUpId)}
                      className={`ml-4 p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all ${isExpanded ? 'rotate-180' : ''}`}
                      title={isExpanded ? "Collapse" : "Expand Details"}
                    >
                      <FaChevronDown className="w-5 h-5 transition-transform" />
                    </button>
                  </div>
                  
                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      {followUp.description && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Description</p>
                          <p className="text-sm text-gray-700">{followUp.description}</p>
                        </div>
                      )}
                      {scheduledDate && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Scheduled Date</p>
                          <p className="text-sm text-gray-700">
                            {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {followUp.customerEmail && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Email</p>
                          <p className="text-sm text-gray-700">{followUp.customerEmail}</p>
                        </div>
                      )}
                      {followUp.customerPhone && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Phone</p>
                          <p className="text-sm text-gray-700">{followUp.customerPhone}</p>
                        </div>
                      )}
                      {followUp.salesman && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Salesman</p>
                          <p className="text-sm text-gray-700">
                            {followUp.salesman.name || followUp.salesman.email}
                          </p>
                        </div>
                      )}
                      {followUp.notes && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Notes</p>
                          <p className="text-sm text-gray-700">{followUp.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleEditFollowUp(followUpId)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                        >
                          <FaEdit className="w-4 h-4 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFollowUp(followUpId)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                        >
                          <FaTrash className="w-4 h-4 inline mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Follow-Up Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">
                {showEditModal ? 'Edit Follow-Up' : 'Create New Follow-Up'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setShowEditModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={showEditModal ? handleUpdateFollowUp : handleCreateFollowUp} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    {typeOptions.filter(t => t !== 'All').map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    {priorityOptions.filter(p => p !== 'All').map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                  <input
                    type="date"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter follow-up description"
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
                    placeholder="Enter any notes about the follow-up"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    resetForm()
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : showEditModal ? 'Update Follow-Up' : 'Create Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default FollowUpManager
