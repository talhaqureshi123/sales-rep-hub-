import { useState, useEffect, useMemo } from 'react'
import { 
  FaCheckCircle, 
  FaClock, 
  FaExclamationTriangle, 
  FaPlus, 
  FaSearch, 
  FaSpinner,
  FaCalendarAlt,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaEdit,
  FaTrash,
  FaCheck,
  FaChevronLeft,
  FaSync,
  FaCloudUploadAlt,
  FaChevronUp,
  FaChevronDown,
  FaFilter,
  FaBuilding,
  FaBriefcase,
  FaFileAlt,
  FaHistory,
  FaStickyNote,
  FaChevronRight,
  FaEllipsisH
} from 'react-icons/fa'
import { getFollowUps, getFollowUp, createFollowUp, updateFollowUp, deleteFollowUp, approveFollowUp, rejectFollowUp, pushToHubSpot } from '../../services/adminservices/followUpService'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers } from '../../services/adminservices/customerService'
import { importHubSpotTasksToDb } from '../../services/adminservices/hubspotService'
import appTheme from '../../apptheme/apptheme'
import Swal from 'sweetalert2'

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Pending', label: 'Pending Approval' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Today', label: 'Due today' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Completed', label: 'Completed' },
]

const TASK_TYPES = ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const Tasks = () => {
  const [tasks, setTasks] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [modalActiveTab, setModalActiveTab] = useState('overview')
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [pushingToHubSpot, setPushingToHubSpot] = useState(false)
  const [sortField, setSortField] = useState('dueDate')
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedRows, setSelectedRows] = useState([])
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false)
  const [showDueDateDropdown, setShowDueDateDropdown] = useState(false)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showSalesmanDropdown, setShowSalesmanDropdown] = useState(false)
  const [activeFilters, setActiveFilters] = useState({
    taskType: [],
    priority: [],
    salesman: [],
    dueDateRange: null
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  const [formData, setFormData] = useState({
    salesman: '',
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    type: 'Call',
    priority: 'Medium',
    dueDate: '',
    dueTime: '09:00',
    description: '',
    notes: '',
  })

  const filtered = useMemo(() => {
    let list = tasks
    // Filter by status if not Pending (Pending is already filtered in loadTasks)
    if (activeTab !== 'All' && activeTab !== 'Pending') {
      list = list.filter((t) => t.status === activeTab)
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter((t) => {
        return (
          (t.description || '').toLowerCase().includes(s) ||
          (t.customerName || '').toLowerCase().includes(s) ||
          (t.customerEmail || '').toLowerCase().includes(s) ||
          (t.followUpNumber || '').toLowerCase().includes(s) ||
          (t.salesman?.name || '').toLowerCase().includes(s)
        )
      })
    }
    // Apply active filters
    if (activeFilters.taskType.length > 0) {
      list = list.filter(t => activeFilters.taskType.includes(t.type))
    }
    if (activeFilters.priority.length > 0) {
      list = list.filter(t => activeFilters.priority.includes(t.priority))
    }
    if (activeFilters.salesman.length > 0) {
      list = list.filter(t => activeFilters.salesman.includes(t.salesman?._id?.toString() || t.salesman?.toString()))
    }
    if (activeFilters.dueDateRange) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)
      
      list = list.filter(t => {
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        
        switch (activeFilters.dueDateRange) {
          case 'today':
            return dueDate.getTime() === today.getTime()
          case 'yesterday':
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            return dueDate.getTime() === yesterday.getTime()
          case 'tomorrow':
            return dueDate.getTime() === tomorrow.getTime()
          case 'thisWeek':
            return dueDate >= today && dueDate <= nextWeek
          case 'overdue':
            return dueDate < today
          default:
            return true
        }
      })
    }
    return list
  }, [tasks, activeTab, search, activeFilters])

  useEffect(() => {
    loadTasks()
    loadSalesmen()
    loadCustomers()
  }, [])

  useEffect(() => {
    loadTasks()
  }, [activeTab])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTaskTypeDropdown(false)
        setShowDueDateDropdown(false)
        setShowPriorityDropdown(false)
        setShowSalesmanDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      let filters = {}
      if (activeTab === 'Pending') {
        filters.approvalStatus = 'Pending'
      } else if (activeTab !== 'All') {
        filters.status = activeTab
      }
      const res = await getFollowUps(filters)
      if (res.success) {
        setTasks(res.data || [])
      } else {
        setTasks([])
      }
    } catch (e) {
      console.error(e)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const loadSalesmen = async () => {
    try {
      const res = await getUsers({ role: 'salesman' })
      if (res.success) {
        setSalesmen(res.data || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadCustomers = async () => {
    try {
      const res = await getCustomers()
      if (res.success) {
        setCustomers(res.data || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!formData.salesman) {
        Swal.fire({
          icon: 'warning',
          title: 'Salesman Required',
          text: 'Please select a salesman',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Combine date and time for dueDate
      const dueDateTime = formData.dueDate && formData.dueTime
        ? new Date(`${formData.dueDate}T${formData.dueTime}`)
        : new Date()

      const taskData = {
        salesman: formData.salesman,
        customer: formData.customer || undefined,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        type: formData.type,
        priority: formData.priority,
        scheduledDate: dueDateTime,
        dueDate: dueDateTime,
        description: formData.description || `Follow up with ${formData.customerName}`,
        notes: formData.notes || undefined,
      }

      const res = await createFollowUp(taskData)
      if (res.success) {
        // Wait a bit for async HubSpot sync to complete
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Reload task to check if HubSpot sync was successful
        const updatedRes = await getFollowUp(res.data._id)
        if (updatedRes.success && updatedRes.data.hubspotTaskId) {
          Swal.fire({
            icon: 'success',
            title: 'Task Created!',
            text: 'Task created successfully and posted to HubSpot!',
            confirmButtonColor: '#e9931c'
          })
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Task Created!',
            text: 'Task created successfully! You can push it to HubSpot manually if needed.',
            confirmButtonColor: '#e9931c'
          })
        }
        setShowCreateForm(false)
        resetForm()
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to create task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating task',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTaskClick = async (task) => {
    try {
      const res = await getFollowUp(task._id)
      if (res.success) {
        setSelectedTask(res.data)
        setShowTaskDetail(true)
        setModalActiveTab('overview')
        // Find current task index in filtered list
        const index = filtered.findIndex(t => t._id === task._id)
        setCurrentTaskIndex(index >= 0 ? index : 0)
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading task details',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleNextTask = () => {
    if (currentTaskIndex < filtered.length - 1) {
      const nextTask = filtered[currentTaskIndex + 1]
      handleTaskClick(nextTask)
    }
  }

  const handlePrevTask = () => {
    if (currentTaskIndex > 0) {
      const prevTask = filtered[currentTaskIndex - 1]
      handleTaskClick(prevTask)
    }
  }

  const handleCompleteTask = async (taskId) => {
    const result = await Swal.fire({
      title: 'Mark as Completed?',
      text: 'Are you sure you want to mark this task as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Complete',
      cancelButtonText: 'Cancel'
    })
    if (!result.isConfirmed) return
    
    try {
      const res = await updateFollowUp(taskId, {
        status: 'Completed',
        completedDate: new Date(),
      })
      if (res.success) {
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to update task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating task',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleDeleteTask = async (taskId) => {
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: 'Are you sure you want to delete this task? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel'
    })
    if (!result.isConfirmed) return
    
    try {
      const res = await deleteFollowUp(taskId)
      if (res.success) {
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to delete task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting task',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleApproveTask = async (taskId) => {
    if (!window.confirm('Approve this task? It will be posted to HubSpot and the salesman will be notified.')) return
    
    try {
      const res = await approveFollowUp(taskId)
      if (res.success) {
        // Wait a bit for async HubSpot sync
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Reload to check HubSpot sync status
        const updatedRes = await getFollowUp(taskId)
        if (updatedRes.success && updatedRes.data.hubspotTaskId) {
          Swal.fire({
            icon: 'success',
            title: 'Task Approved!',
            text: 'Task approved successfully! It has been posted to HubSpot. Salesman will be notified.',
            confirmButtonColor: '#e9931c'
          })
        } else {
          Swal.fire({
            icon: 'success',
            title: 'Task Approved!',
            text: 'Task approved successfully! HubSpot sync is in progress. Salesman will be notified.',
            confirmButtonColor: '#e9931c'
          })
        }
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        alert(res.message || 'Failed to approve task')
      }
    } catch (e) {
      console.error(e)
      alert('Error approving task')
    }
  }

  const handleRejectTask = async (taskId) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Reject Task',
      text: 'Enter rejection reason (optional):',
      input: 'text',
      inputPlaceholder: 'Enter reason...',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel'
    })
    if (!isConfirmed) return
    
    try {
      const res = await rejectFollowUp(taskId, reason || '')
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Task Rejected',
          text: 'Task rejected successfully.',
          confirmButtonColor: '#e9931c'
        })
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        alert(res.message || 'Failed to reject task')
      }
    } catch (e) {
      console.error(e)
      alert('Error rejecting task')
    }
  }

  const handlePushToHubSpot = async (taskId) => {
    const result = await Swal.fire({
      title: 'Push to HubSpot?',
      text: 'This can only be done once to prevent duplicates',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Push',
      cancelButtonText: 'Cancel'
    })
    if (!result.isConfirmed) return
    
    setPushingToHubSpot(true)
    try {
      const res = await pushToHubSpot(taskId)
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Task successfully pushed to HubSpot!',
          confirmButtonColor: '#e9931c'
        })
        // Reload task details to get updated hubspotTaskId
        if (selectedTask && selectedTask._id === taskId) {
          const updatedRes = await getFollowUp(taskId)
          if (updatedRes.success) {
            setSelectedTask(updatedRes.data)
          }
        }
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to push task to HubSpot',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing task to HubSpot',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingToHubSpot(false)
    }
  }

  const handleImportFromHubSpot = async () => {
    setImporting(true)
    try {
      const res = await importHubSpotTasksToDb()
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          text: 'Tasks imported successfully from HubSpot!',
          confirmButtonColor: '#e9931c'
        })
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: res.message || 'Failed to import tasks',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error importing tasks',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setImporting(false)
    }
  }

  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c._id === customerId)
    if (customer) {
      setFormData({
        ...formData,
        customer: customerId,
        customerName: customer.name || customer.firstName || '',
        customerEmail: customer.email || '',
        customerPhone: customer.phone || '',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      salesman: '',
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      type: 'Call',
      priority: 'Medium',
      dueDate: '',
      dueTime: '09:00',
      description: '',
      notes: '',
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Overdue':
        return { bg: appTheme.status.error.light, text: appTheme.status.error.text, icon: FaExclamationTriangle }
      case 'Today':
        return { bg: appTheme.status.warning.light, text: appTheme.status.warning.text, icon: FaClock }
      case 'Upcoming':
        return { bg: appTheme.status.info.light, text: appTheme.status.info.text, icon: FaCalendarAlt }
      case 'Completed':
        return { bg: appTheme.status.success.light, text: appTheme.status.success.text, icon: FaCheckCircle }
      default:
        return { bg: appTheme.background.lightGray, text: appTheme.text.secondary, icon: FaClock }
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-700'
      case 'High':
        return 'bg-orange-100 text-orange-700'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'Low':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(paginatedTasks.map(t => t._id))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) 
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    )
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' 
      ? <FaChevronUp className="w-3 h-3 ml-1" />
      : <FaChevronDown className="w-3 h-3 ml-1" />
  }

  // Sort filtered tasks
  const sortedTasks = useMemo(() => {
    let sorted = [...filtered]
    sorted.sort((a, b) => {
      let aVal, bVal
      switch (sortField) {
        case 'description':
          aVal = (a.description || '').toLowerCase()
          bVal = (b.description || '').toLowerCase()
          break
        case 'customerName':
          aVal = (a.customerName || '').toLowerCase()
          bVal = (b.customerName || '').toLowerCase()
          break
        case 'dueDate':
          aVal = new Date(a.dueDate || 0).getTime()
          bVal = new Date(b.dueDate || 0).getTime()
          break
        case 'priority':
          const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 }
          aVal = priorityOrder[a.priority] || 0
          bVal = priorityOrder[b.priority] || 0
          break
        case 'type':
          aVal = (a.type || '').toLowerCase()
          bVal = (b.type || '').toLowerCase()
          break
        case 'status':
          aVal = (a.status || '').toLowerCase()
          bVal = (b.status || '').toLowerCase()
          break
        default:
          aVal = new Date(a.createdAt || 0).getTime()
          bVal = new Date(b.createdAt || 0).getTime()
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })
    return sorted
  }, [filtered, sortField, sortOrder])

  // Pagination
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedTasks.slice(startIndex, endIndex)
  }, [sortedTasks, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage)

  const handleFilterChange = (filterType, value, isMultiple = false) => {
    setActiveFilters(prev => {
      if (isMultiple) {
        const current = prev[filterType] || []
        const newValue = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value]
        return { ...prev, [filterType]: newValue }
      } else {
        return { ...prev, [filterType]: value === prev[filterType] ? null : value }
      }
    })
  }

  const removeFilter = (filterType, value = null) => {
    setActiveFilters(prev => {
      if (value !== null) {
        const current = prev[filterType] || []
        return { ...prev, [filterType]: current.filter(v => v !== value) }
      } else {
        return { ...prev, [filterType]: Array.isArray(prev[filterType]) ? [] : null }
      }
    })
  }

  const clearAllFilters = () => {
    setActiveFilters({
      taskType: [],
      priority: [],
      salesman: [],
      dueDateRange: null
    })
    setSearch('')
  }

  const hasActiveFilters = activeFilters.taskType.length > 0 || 
    activeFilters.priority.length > 0 || 
    activeFilters.salesman.length > 0 || 
    activeFilters.dueDateRange !== null ||
    search.trim() !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: appTheme.text.primary }}>Tasks</h2>
          <p className="text-sm" style={{ color: appTheme.text.secondary }}>
            Follow-up sample tracker - Manage all tasks and assign to salesmen
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImportFromHubSpot}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            style={{ 
              backgroundColor: appTheme.status.info.main,
              color: appTheme.text.white
            }}
          >
            {importing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            <span>Import from HubSpot</span>
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
            style={{ 
              backgroundColor: appTheme.primary.main,
              color: appTheme.text.white
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = appTheme.primary.dark}
            onMouseLeave={(e) => e.target.style.backgroundColor = appTheme.primary.main}
          >
            <FaPlus className="w-5 h-5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Header with Record Count */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: appTheme.text.primary }}>Tasks</h2>
          <p className="text-sm" style={{ color: appTheme.text.secondary }}>
            {loading ? 'Loading...' : `${sortedTasks.length} records`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportFromHubSpot}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border"
            style={{ 
              borderColor: appTheme.primary.main,
              color: appTheme.primary.main,
              backgroundColor: 'white'
            }}
          >
            {importing ? <FaSpinner className="animate-spin" /> : <FaSync />}
            <span>Import</span>
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-all"
            style={{ backgroundColor: '#ff7a59' }}
          >
            <FaPlus className="w-4 h-4" />
            <span>Create task</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setCurrentPage(1)
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={activeTab === tab.id ? { backgroundColor: appTheme.primary.main } : {}}
          >
            {tab.label}
            {activeTab === tab.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveTab('All')
                  setCurrentPage(1)
                }}
                className="ml-2 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {/* Active Filter Tags */}
          {activeFilters.taskType.map(type => (
            <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Task type: {type}
              <button onClick={() => removeFilter('taskType', type)} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.priority.map(priority => (
            <span key={priority} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Priority: {priority}
              <button onClick={() => removeFilter('priority', priority)} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.salesman.map(salesmanId => {
            const salesman = salesmen.find(s => (s._id || s.id) === salesmanId)
            return salesman ? (
              <span key={salesmanId} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                Assigned to: {salesman.name}
                <button onClick={() => removeFilter('salesman', salesmanId)} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
              </span>
            ) : null
          })}
          {activeFilters.dueDateRange && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Due date: {activeFilters.dueDateRange}
              <button onClick={() => removeFilter('dueDateRange')} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Task Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTaskTypeDropdown(!showTaskTypeDropdown)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
                setShowSalesmanDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Task type</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showTaskTypeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {TASK_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.taskType.includes(type)}
                        onChange={() => handleFilterChange('taskType', type, true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Due Date Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDueDateDropdown(!showDueDateDropdown)
                setShowTaskTypeDropdown(false)
                setShowPriorityDropdown(false)
                setShowSalesmanDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Due date</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showDueDateDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] max-h-80 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'yesterday', label: 'Yesterday' },
                    { value: 'tomorrow', label: 'Tomorrow' },
                    { value: 'thisWeek', label: 'This week' },
                    { value: 'overdue', label: 'Overdue' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('dueDateRange', option.value)
                        setShowDueDateDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        activeFilters.dueDateRange === option.value ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPriorityDropdown(!showPriorityDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
                setShowSalesmanDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Priority</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showPriorityDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {PRIORITIES.map(priority => (
                    <label key={priority} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.priority.includes(priority)}
                        onChange={() => handleFilterChange('priority', priority, true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Salesman/Assigned To Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSalesmanDropdown(!showSalesmanDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Assigned to</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showSalesmanDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {salesmen.map(salesman => (
                    <label key={salesman._id || salesman.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.salesman.includes((salesman._id || salesman.id).toString())}
                        onChange={() => handleFilterChange('salesman', (salesman._id || salesman.id).toString(), true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{salesman.name || salesman.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Filters Button */}
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <FaFilter className="w-3 h-3" />
            <span>Advanced filters</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300">
            <FaSearch style={{ color: appTheme.text.tertiary }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task title and notes"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: appTheme.text.primary }}
            />
          </div>
          <button className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
            Save view
          </button>
          {selectedRows.length > 0 && (
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Start {selectedRows.length} tasks
            </button>
          )}
          <button className="text-sm text-gray-600 hover:text-gray-800 underline">
            Edit columns
          </button>
        </div>
      </div>

      {/* Task Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: appTheme.background.white, boxShadow: appTheme.shadow.md }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FaSpinner className="animate-spin" style={{ color: appTheme.primary.main }} size={32} />
          </div>
        ) : paginatedTasks.length === 0 ? (
          <div className="text-center py-12">
            <FaCalendarAlt className="mx-auto mb-4" style={{ color: appTheme.text.light }} size={48} />
            <p className="font-medium" style={{ color: appTheme.text.secondary }}>No tasks found</p>
            <p className="text-sm mt-2" style={{ color: appTheme.text.tertiary }}>
              {search ? 'Try a different search term' : 'Create your first task to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <table className="w-full border-collapse" style={{ minWidth: '1400px' }}>
              <thead className="bg-gray-50 border-b" style={{ borderColor: appTheme.border.light }}>
                <tr>
                  <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === paginatedTasks.length && paginatedTasks.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                      style={{ accentColor: appTheme.primary.main }}
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      STATUS
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[200px]"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center">
                      TITLE
                      <SortIcon field="description" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[150px]"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center">
                      ASSOCIATED CONTACT
                      <SortIcon field="customerName" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[150px]" style={{ color: appTheme.text.secondary }}>
                    ASSOCIATED COMPANY
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: appTheme.text.secondary }}>
                    LAST CONTACT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: appTheme.text.secondary }}>
                    LAST ENGAGEMENT
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center">
                      TASK TYPE
                      <SortIcon field="type" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center">
                      DUE DATE
                      <SortIcon field="dueDate" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky right-0 bg-gray-50 z-10" style={{ color: appTheme.text.secondary }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y" style={{ borderColor: appTheme.border.light }}>
                {paginatedTasks.map((task) => {
                  const statusStyle = getStatusColor(task.status)
                  const StatusIcon = statusStyle.icon
                  return (
                    <tr
                      key={task._id}
                      className="hover:bg-blue-50 transition-colors border-b border-gray-100"
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(task._id)}
                          onChange={() => handleSelectRow(task._id)}
                          className="rounded border-gray-300"
                          style={{ accentColor: appTheme.primary.main }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap group relative">
                          <StatusIcon className="w-4 h-4" style={{ color: statusStyle.text }} />
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold font-sans transition-all hover:opacity-80 cursor-default"
                            style={{ backgroundColor: statusStyle.bg, color: '#000000' }}
                            title={task.status}
                          >
                            {task.status}
                          </span>
                          {task.approvalStatus === 'Pending' && (
                            <span 
                              className="px-2 py-0.5 rounded text-xs font-medium font-sans bg-yellow-100 text-black transition-all hover:opacity-80 cursor-default"
                              title="Pending Approval"
                            >
                              Pending
                            </span>
                          )}
                          {task.approvalStatus === 'Approved' && task.hubspotTaskId && (
                            <span 
                              className="px-2 py-0.5 rounded text-xs font-medium font-sans bg-green-100 text-black transition-all hover:opacity-80 cursor-default"
                              title="Posted to HubSpot"
                            >
                              ✓ HubSpot
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[200px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskClick(task)
                            }}
                            className="text-left text-sm font-medium hover:underline transition-colors cursor-pointer"
                            style={{ color: '#0066cc' }}
                          >
                            {task.description || `Follow up with ${task.customerName}`}
                          </button>
                          {task.notes && (
                            <p className="text-xs mt-1 text-gray-500 line-clamp-1">
                              {task.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-600">
                              {(task.customerName || task.customerEmail || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: appTheme.text.primary }}>
                              {task.customerName || '—'}
                            </p>
                            {task.customerEmail && (
                              <p className="text-xs text-gray-500 truncate">
                                {task.customerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {task.customer?.company ? (
                            <>
                              <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-gray-600">
                                  {task.customer.company[0].toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm truncate" style={{ color: appTheme.text.primary }}>
                                {task.customer.company}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">—</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">—</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: appTheme.text.secondary }}>
                          {task.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: appTheme.text.secondary }}>
                            <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs text-gray-500">{new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {task.approvalStatus === 'Approved' && !task.hubspotTaskId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePushToHubSpot(task._id)
                              }}
                              disabled={pushingToHubSpot}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                              style={{ backgroundColor: appTheme.status.info.main }}
                              title="Push to HubSpot"
                            >
                              {pushingToHubSpot ? (
                                <FaSpinner className="animate-spin" />
                              ) : (
                                <>
                                  <FaCloudUploadAlt />
                                  Push
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskClick(task)
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="View Details"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {sortedTasks.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      {/* Create Task Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ backgroundColor: appTheme.primary.main, borderColor: appTheme.border.light }}>
              <h3 className="text-xl font-bold text-white">Create Task</h3>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              {/* Salesman Selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Assign to Salesman <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.salesman}
                  onChange={(e) => setFormData({ ...formData, salesman: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                >
                  <option value="">Select a salesman...</option>
                  {salesmen.map((salesman) => (
                    <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                      {salesman.name || salesman.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Customer (Optional)
                </label>
                <select
                  value={formData.customer}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                >
                  <option value="">Select a customer...</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                  placeholder="Enter customer name"
                />
              </div>

              {/* Customer Email */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Customer Email
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                  placeholder="Enter customer email"
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                  placeholder="Enter customer phone"
                />
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Task Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{ 
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  >
                    {TASK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{ 
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{ 
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{ 
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                  placeholder="e.g., Follow up with sample tracker for salesman"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 resize-none"
                  style={{ 
                    borderColor: appTheme.border.medium,
                    focusRingColor: appTheme.primary.main
                  }}
                  placeholder="Add any additional notes..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: appTheme.border.light }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    resetForm()
                  }}
                  className="px-5 py-2 rounded-lg font-medium transition-colors"
                  style={{ 
                    color: appTheme.text.secondary,
                    backgroundColor: appTheme.background.lightGray
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg font-medium text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: appTheme.primary.main }}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <FaSpinner className="animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail View - HubSpot Style */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setShowTaskDetail(false)
                    setSelectedTask(null)
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {selectedTask.description || `Follow up with ${selectedTask.customerName}`}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">
                      Task {currentTaskIndex + 1}/{filtered.length}
                    </span>
                    <button
                      onClick={handlePrevTask}
                      disabled={currentTaskIndex === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextTask}
                      disabled={currentTaskIndex === filtered.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedTask.status !== 'Completed' && (
                  <button
                    onClick={() => handleCompleteTask(selectedTask._id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Complete
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowTaskDetail(false)
                    setSelectedTask(null)
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Content - Three Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Contact Information */}
              <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
                {selectedTask.customerName && (
                  <>
                    {/* Contact Card */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-2xl font-semibold text-gray-600">
                            {(selectedTask.customerName || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold text-gray-900">{selectedTask.customerName}</h2>
                          {selectedTask.customerEmail && (
                            <p className="text-sm text-gray-500 mt-1">{selectedTask.customerEmail}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaStickyNote className="w-4 h-4" />
                          Note
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaEnvelope className="w-4 h-4" />
                          Email
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaPhone className="w-4 h-4" />
                          Call
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaCalendarAlt className="w-4 h-4" />
                          Task
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaCalendarAlt className="w-4 h-4" />
                          Meeting
                        </button>
                        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <FaEllipsisH className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* About this contact */}
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">About this contact</h3>
                      <div className="space-y-3">
                        {selectedTask.customerEmail && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Email</p>
                            <p className="text-sm text-gray-900">{selectedTask.customerEmail}</p>
                          </div>
                        )}
                        {selectedTask.customerPhone && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                            <p className="text-sm text-gray-900">{selectedTask.customerPhone}</p>
                          </div>
                        )}
                        {selectedTask.salesman && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Contact owner</p>
                            <p className="text-sm text-gray-900">{selectedTask.salesman.name || selectedTask.salesman.email}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Contacted</p>
                          <p className="text-sm text-gray-400">—</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Lead Status</p>
                          <p className="text-sm text-gray-400">—</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Center Panel - Task Details with Tabs */}
              <div className="flex-1 bg-white overflow-y-auto">
                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'overview'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab('activities')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'activities'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => setActiveTab('intelligence')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'intelligence'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Intelligence
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {modalActiveTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Data Highlights */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Data highlights</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">CREATE DATE</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.createdAt
                                ? new Date(selectedTask.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) + ' GMT+5'
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">LAST ACTIVITY DATE</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.dueDate
                                ? new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) + ' GMT+5'
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">LIFECYCLE STAGE</p>
                            <p className="text-sm font-medium text-gray-900">Lead</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activities */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-gray-900">Recent activities</h3>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                placeholder="Search activities"
                                className="pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <button className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              Create activities
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                            <input type="checkbox" className="rounded border-gray-300" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(selectedTask.dueDate || selectedTask.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                </span>
                                <span className="text-sm text-gray-500">›</span>
                                <span className="text-sm text-gray-600">
                                  Task assigned to {selectedTask.salesman?.name || 'Salesman'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  selectedTask.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                  selectedTask.status === 'Today' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {selectedTask.status === 'Overdue' ? 'Overdue' : selectedTask.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {selectedTask.dueDate
                                    ? new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) + ' GMT+5'
                                    : '—'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 mt-1">
                                {selectedTask.description || `Follow up with ${selectedTask.customerName}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {modalActiveTab === 'activities' && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Activities tab content</p>
                    </div>
                  )}

                  {modalActiveTab === 'intelligence' && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Intelligence tab content</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - Associated Companies */}
              <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Companies ({selectedTask.customer?.company ? 1 : 0})
                    </h3>
                  </div>
                  {selectedTask.customer?.company ? (
                    <div className="space-y-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-semibold text-gray-600">
                              {selectedTask.customer.company[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {selectedTask.customer.company}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Primary</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Company Domain Name</p>
                            <p className="text-gray-900">—</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                            <p className="text-gray-900">—</p>
                          </div>
                        </div>
                        <button className="mt-3 text-xs text-blue-600 hover:underline">
                          Add association label
                        </button>
                      </div>
                      <button className="text-sm text-blue-600 hover:underline">
                        View all associated Companies
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No companies associated</p>
                  )}

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Deals (0)</h3>
                    <p className="text-sm text-gray-500">No deals associated</p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Tickets (0)</h3>
                    <p className="text-sm text-gray-500">No tickets associated</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tasks
