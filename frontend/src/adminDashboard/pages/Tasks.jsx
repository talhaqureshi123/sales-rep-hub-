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
  FaEllipsisH,
  FaFlask,
  FaShoppingCart,
  FaMapMarkerAlt
} from 'react-icons/fa'
import { getFollowUps, getFollowUp, createFollowUp, updateFollowUp, deleteFollowUp, approveFollowUp, rejectFollowUp, pushToHubSpot } from '../../services/adminservices/followUpService'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers } from '../../services/adminservices/customerService'
import { importHubSpotTasksToDb } from '../../services/adminservices/hubspotService'
import appTheme from '../../apptheme/apptheme'
import Swal from 'sweetalert2'

const TABS = [
  { id: 'All', label: 'All Tasks' },
  { id: 'HubSpotImported', label: 'HubSpot Imported' },
  { id: 'PushedToHubSpot', label: 'Pushed to HubSpot' },
  { id: 'NotPushed', label: 'Not Pushed' },
  { id: 'Pending', label: 'Pending Approval' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Today', label: 'Due today' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Completed', label: 'Completed' },
]

// Task types - include both app types and HubSpot types
const TASK_TYPES = ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check', 'TODO', 'CALL', 'VISIT', 'MEETING']
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
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const [filterSearch, setFilterSearch] = useState({
    taskType: '',
    priority: '',
    salesman: '',
    dueDate: '',
    time: ''
  })
  const [activeFilters, setActiveFilters] = useState({
    taskType: [],
    priority: [],
    salesman: [],
    dueDateRange: null,
    timeRange: null
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  const [formData, setFormData] = useState({
    salesman: '',
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    associatedContactName: '',
    associatedContactEmail: '',
    associatedCompanyName: '',
    associatedCompanyDomain: '',
    type: 'Call',
    priority: 'Medium',
    dueDate: '',
    dueTime: '09:00',
    description: '',
    notes: '',
  })

  const filtered = useMemo(() => {
    let list = [...tasks] // Create a copy to avoid mutating original
    
    // Apply search filter first (before other filters) for better performance
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      // Helper function to safely convert to string and search
      const safeSearch = (value) => {
        if (value === null || value === undefined) return ''
        return String(value).toLowerCase()
      }
      
      list = list.filter((t) => {
        return (
          safeSearch(t.description).includes(s) ||
          safeSearch(t.customerName).includes(s) ||
          safeSearch(t.customerEmail).includes(s) ||
          safeSearch(t.customerPhone).includes(s) ||
          safeSearch(t.followUpNumber).includes(s) ||
          safeSearch(t.salesman?.name).includes(s) ||
          safeSearch(t.salesman?.email).includes(s) ||
          safeSearch(t.hubspot_owner_name).includes(s) ||
          safeSearch(t.hubspot_owner_email).includes(s) ||
          safeSearch(t.createdBy?.name).includes(s) ||
          safeSearch(t.createdBy?.email).includes(s) ||
          safeSearch(t.type).includes(s) ||
          safeSearch(t.hs_task_type).includes(s) ||
          safeSearch(t.status).includes(s) ||
          safeSearch(t.priority).includes(s) ||
          safeSearch(t.hs_task_priority).includes(s) ||
          safeSearch(t.notes).includes(s) ||
          safeSearch(t.hs_task_body).includes(s) ||
          safeSearch(t.hs_task_queue).includes(s) ||
          safeSearch(t.hs_task_reminder).includes(s) ||
          safeSearch(t.customer?.company).includes(s) ||
          safeSearch(t.customer?.name).includes(s) ||
          safeSearch(t.associatedCompanyName).includes(s) ||
          safeSearch(t.associatedCompanyDomain).includes(s) ||
          safeSearch(t.associatedContactName).includes(s) ||
          safeSearch(t.associatedContactEmail).includes(s) ||
          safeSearch(t.hs_task_subject).includes(s) ||
          safeSearch(t._id).includes(s)
        )
      })
    }
    
    // Filter by source/status tabs (only if no search is active, or apply after search)
    if (activeTab === 'AppCreated') {
      // Tasks created in app by admin or salesman (not imported from HubSpot)
      list = list.filter((t) => {
        const createdBy = t.createdBy?._id || t.createdBy
        const createdByRole = t.createdBy?.role
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null
        
        const description = (t.description || '').toLowerCase()
        const customerName = (t.customerName || '').toLowerCase()
        
        const matchesImportPattern = description.includes('hubspot task') || 
                                     description.match(/^hubspot task \d+$/) ||
                                     customerName === 'hubspot contact'
        
        const isImported = hasHubSpotId && matchesImportPattern
        
        return createdBy && 
               (createdByRole === 'admin' || createdByRole === 'salesman' || !createdByRole) &&
               !isImported
      })
    } else if (activeTab === 'HubSpotImported') {
      list = list.filter((t) => t.source === 'hubspot')
    } else if (activeTab === 'PushedToHubSpot') {
      list = list.filter((t) => {
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null
        return hasHubSpotId
      })
    } else if (activeTab === 'NotPushed') {
      list = list.filter((t) => {
        const noHubSpotId = !t.hubspotTaskId || t.hubspotTaskId === '' || t.hubspotTaskId === null
        return noHubSpotId && t.approvalStatus === 'Approved'
      })
    } else if (activeTab === 'Pending') {
      list = list.filter((t) => t.approvalStatus === 'Pending')
    } else if (activeTab !== 'All') {
      // Status-based filters (Overdue, Today, Upcoming, Completed)
      list = list.filter((t) => t.status === activeTab)
    }
    // Apply active filters
    if (activeFilters.taskType.length > 0) {
      list = list.filter(t => {
        // Prioritize HubSpot type (hs_task_type) over mapped type (type)
        const taskType = (t.hs_task_type || t.type || '').toString().trim()
        if (!taskType) return false
        
        // Check if the task type matches any of the selected filters (case-insensitive)
        return activeFilters.taskType.some(filterType => {
          const filterLower = filterType.toLowerCase().trim()
          const taskTypeLower = taskType.toLowerCase().trim()
          
          // Direct match (case-insensitive)
          if (taskTypeLower === filterLower) return true
          
          // Handle HubSpot type mappings and variations
          if (filterLower === 'call') {
            return taskTypeLower === 'call' || taskTypeLower === 'todo' || taskTypeLower.includes('call')
          }
          if (filterLower === 'email') {
            return taskTypeLower === 'email' || taskTypeLower.includes('email')
          }
          if (filterLower === 'visit') {
            return taskTypeLower === 'visit' || taskTypeLower === 'meeting' || taskTypeLower.includes('visit') || taskTypeLower.includes('meeting')
          }
          if (filterLower === 'quote follow-up' || filterLower === 'quote follow up') {
            return taskTypeLower.includes('quote') || taskTypeLower.includes('quotation')
          }
          if (filterLower === 'sample feedback') {
            return taskTypeLower.includes('sample')
          }
          if (filterLower === 'order check') {
            return taskTypeLower.includes('order')
          }
          if (filterLower === 'todo') {
            return taskTypeLower === 'todo' || taskTypeLower === 'call' || taskTypeLower.includes('todo')
          }
          
          return false
        })
      })
    }
    if (activeFilters.priority.length > 0) {
      list = list.filter(t => {
        const taskPriority = t.priority || ''
        return activeFilters.priority.some(filterPriority => {
          const filterLower = filterPriority.toLowerCase()
          const taskPriorityLower = taskPriority.toLowerCase()
          return taskPriorityLower === filterLower || 
                 (filterPriority === 'High' && (taskPriorityLower === 'high' || taskPriorityLower === 'urgent')) ||
                 (filterPriority === 'Urgent' && taskPriorityLower === 'urgent')
        })
      })
    }
    if (activeFilters.salesman.length > 0) {
      list = list.filter(t => {
        // Check salesman ID
        const salesmanId = t.salesman?._id?.toString() || t.salesman?.toString()
        if (activeFilters.salesman.includes(salesmanId)) return true
        
        // Also check HubSpot owner name and email for imported tasks
        const hubspotOwnerName = (t.hubspot_owner_name || '').toLowerCase().trim()
        const hubspotOwnerEmail = (t.hubspot_owner_email || '').toLowerCase().trim()
        
        // Check if any selected salesman matches HubSpot owner
        return activeFilters.salesman.some(selectedId => {
          const selectedSalesman = salesmen.find(s => (s._id || s.id).toString() === selectedId)
          if (!selectedSalesman) return false
          
          const salesmanName = (selectedSalesman.name || '').toLowerCase().trim()
          const salesmanEmail = (selectedSalesman.email || '').toLowerCase().trim()
          
          // Match by name or email
          return (hubspotOwnerName && salesmanName && hubspotOwnerName === salesmanName) ||
                 (hubspotOwnerEmail && salesmanEmail && hubspotOwnerEmail === salesmanEmail) ||
                 (hubspotOwnerName && salesmanEmail && hubspotOwnerName.includes(salesmanEmail.split('@')[0])) ||
                 (hubspotOwnerEmail && salesmanName && hubspotOwnerEmail.includes(salesmanName.toLowerCase().replace(/\s+/g, '.')))
        })
      })
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
    // Time filter (filter by time of day)
    if (activeFilters.timeRange) {
      list = list.filter(t => {
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        const hours = dueDate.getHours()
        
        switch (activeFilters.timeRange) {
          case 'morning':
            // 6:00 AM - 12:00 PM (6-11)
            return hours >= 6 && hours < 12
          case 'afternoon':
            // 12:00 PM - 6:00 PM (12-17)
            return hours >= 12 && hours < 18
          case 'evening':
            // 6:00 PM - 12:00 AM (18-23)
            return hours >= 18 && hours < 24
          case 'night':
            // 12:00 AM - 6:00 AM (0-5)
            return hours >= 0 && hours < 6
          default:
            return true
        }
      })
    }
    return list
  }, [tasks, search, activeTab, activeFilters])

  useEffect(() => {
    loadTasks()
    loadSalesmen()
    loadCustomers()
  }, [])


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTaskTypeDropdown(false)
        setShowDueDateDropdown(false)
        setShowPriorityDropdown(false)
        setShowSalesmanDropdown(false)
        setShowTimeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      // Fetch all tasks - no tab filtering
      const res = await getFollowUps({})
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
      // Load all customers from database (both app-created and HubSpot-imported)
      const res = await getCustomers()
      const allCustomers = res.success ? (res.data || []) : []
      
      // Show both app-created and HubSpot-imported customers in dropdown
      // Mark customers and ensure name field exists for display
      const markedCustomers = allCustomers.map(c => ({
        ...c,
        isHubSpot: (c.source || '').toLowerCase() === 'hubspot',
        // Ensure name field exists for display
        name: c.name || c.firstName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Customer'
      }))
      
      setCustomers(markedCustomers)
    } catch (e) {
      console.error(e)
      setCustomers([])
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

      // Map task type to valid backend enum values
      // Backend enum: ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check']
      const mapTaskType = (type) => {
        const typeLower = (type || '').toLowerCase().trim()
        // Map HubSpot types to backend enum values
        if (typeLower === 'todo' || typeLower === 'call') return 'Call'
        if (typeLower === 'visit' || typeLower === 'meeting') return 'Visit'
        if (typeLower === 'email') return 'Email'
        if (typeLower.includes('quote') || typeLower.includes('quotation')) return 'Quote Follow-up'
        if (typeLower.includes('sample')) return 'Sample Feedback'
        if (typeLower.includes('order')) return 'Order Check'
        // If already a valid enum value, return as is
        const validTypes = ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check']
        if (validTypes.includes(type)) return type
        // Default fallback
        return 'Call'
      }

      const taskData = {
        salesman: formData.salesman,
        customer: formData.customer || undefined,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        // Associated Contact (HubSpot-style)
        associatedContactName: formData.associatedContactName || undefined,
        associatedContactEmail: formData.associatedContactEmail || undefined,
        // Associated Company (HubSpot-style)
        associatedCompanyName: formData.associatedCompanyName || undefined,
        associatedCompanyDomain: formData.associatedCompanyDomain || undefined,
        type: mapTaskType(formData.type), // Map to valid enum value
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
    const confirmResult = await Swal.fire({
      icon: 'question',
      title: 'Approve Task?',
      text: 'Approve this task? It will be posted to HubSpot and the salesman will be notified.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280',
    })

    if (!confirmResult.isConfirmed) return
    
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
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to approve task',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error approving task',
        confirmButtonColor: '#e9931c',
      })
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
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to reject task',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error rejecting task',
        confirmButtonColor: '#e9931c',
      })
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
    if (customerId) {
      const customer = customers.find(c => c._id === customerId)
      if (customer) {
        // Handle both app-created and HubSpot-imported customers
        const isHubSpotCustomer = customer.source === 'hubspot' || customer.isHubSpot
        
        setFormData({
          ...formData,
          // Only set customer ObjectId if it's an app-created customer
          // HubSpot-imported customers don't have a local customer ObjectId link
          customer: isHubSpotCustomer ? '' : customerId,
          customerName: customer.name || customer.firstName || '',
          customerEmail: customer.email || '',
          customerPhone: customer.phone || '',
          // For HubSpot customers, also set associated contact fields
          associatedContactName: isHubSpotCustomer ? (customer.name || customer.firstName || '') : formData.associatedContactName,
          associatedContactEmail: isHubSpotCustomer ? (customer.email || '') : formData.associatedContactEmail,
        })
      }
    } else {
      // Clear customer selection
      setFormData({
        ...formData,
        customer: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
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
      associatedContactName: '',
      associatedContactEmail: '',
      associatedCompanyName: '',
      associatedCompanyDomain: '',
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
          // Prioritize HubSpot type (hs_task_type) over mapped type (type)
          aVal = (a.hs_task_type || a.type || '').toLowerCase()
          bVal = (b.hs_task_type || b.type || '').toLowerCase()
          break
        case 'status':
          aVal = (a.status || '').toLowerCase()
          bVal = (b.status || '').toLowerCase()
          break
        case 'salesman':
          aVal = (a.salesman?.name || a.salesman?.email || '').toLowerCase()
          bVal = (b.salesman?.name || b.salesman?.email || '').toLowerCase()
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

  // Calculate counts for each tab
  const tabCounts = useMemo(() => {
    const counts = {
      All: tasks.length,
      HubSpotImported: tasks.filter(t => {
        // Tasks imported from HubSpot have source === 'hubspot'
        return t.source === 'hubspot'
      }).length,
      PushedToHubSpot: tasks.filter(t => {
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null
        return hasHubSpotId
      }).length,
      NotPushed: tasks.filter(t => {
        const noHubSpotId = !t.hubspotTaskId || t.hubspotTaskId === '' || t.hubspotTaskId === null
        return noHubSpotId && t.approvalStatus === 'Approved'
      }).length,
      Pending: tasks.filter(t => t.approvalStatus === 'Pending').length,
      Overdue: tasks.filter(t => t.status === 'Overdue').length,
      Today: tasks.filter(t => t.status === 'Today').length,
      Upcoming: tasks.filter(t => t.status === 'Upcoming').length,
      Completed: tasks.filter(t => t.status === 'Completed').length,
    }
    return counts
  }, [tasks])

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
      dueDateRange: null,
      timeRange: null
    })
    setSearch('')
    setFilterSearch({
      taskType: '',
      priority: '',
      salesman: '',
      dueDate: '',
      time: ''
    })
  }

  const hasActiveFilters = activeFilters.taskType.length > 0 || 
    activeFilters.priority.length > 0 || 
    activeFilters.salesman.length > 0 || 
    activeFilters.dueDateRange !== null ||
    activeFilters.timeRange !== null ||
    search.trim() !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: appTheme.text.primary }}>Tasks</h2>
          <p className="text-sm" style={{ color: appTheme.text.secondary }}>
            {loading ? 'Loading...' : `${sortedTasks.length} of ${tasks.length} tasks`} | Follow-up sample tracker - Manage all tasks and assign to salesmen
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
                if (!showTaskTypeDropdown) {
                  setFilterSearch(prev => ({ ...prev, taskType: '' }))
                }
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
                      placeholder="Search task types..."
                      value={filterSearch.taskType}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, taskType: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {TASK_TYPES.filter((type, index, self) => {
                    // Remove duplicates (case-insensitive)
                    const isUnique = index === self.findIndex(t => t.toLowerCase() === type.toLowerCase())
                    // Filter by search term
                    const matchesSearch = !filterSearch.taskType || type.toLowerCase().includes(filterSearch.taskType.toLowerCase())
                    return isUnique && matchesSearch
                  }).map(type => (
                    <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.taskType.some(ft => ft.toLowerCase() === type.toLowerCase())}
                        onChange={() => {
                          // Check if already selected (case-insensitive)
                          const isSelected = activeFilters.taskType.some(ft => ft.toLowerCase() === type.toLowerCase())
                          if (isSelected) {
                            // Remove all case variants
                            const newFilters = activeFilters.taskType.filter(ft => ft.toLowerCase() !== type.toLowerCase())
                            setActiveFilters(prev => ({ ...prev, taskType: newFilters }))
                          } else {
                            // Add this type
                            handleFilterChange('taskType', type, true)
                          }
                        }}
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
                if (!showDueDateDropdown) {
                  setFilterSearch(prev => ({ ...prev, dueDate: '' }))
                }
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
                      placeholder="Search date filters..."
                      value={filterSearch.dueDate}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, dueDate: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                  ].filter(option => 
                    !filterSearch.dueDate || option.label.toLowerCase().includes(filterSearch.dueDate.toLowerCase())
                  ).map(option => (
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
                if (!showPriorityDropdown) {
                  setFilterSearch(prev => ({ ...prev, priority: '' }))
                }
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
                      placeholder="Search priorities..."
                      value={filterSearch.priority}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, priority: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {PRIORITIES.filter(priority => 
                    !filterSearch.priority || priority.toLowerCase().includes(filterSearch.priority.toLowerCase())
                  ).map(priority => (
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
                setShowTimeDropdown(false)
                if (!showSalesmanDropdown) {
                  setFilterSearch(prev => ({ ...prev, salesman: '' }))
                }
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
                      placeholder="Search salesmen..."
                      value={filterSearch.salesman}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, salesman: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {salesmen.filter(salesman => {
                    const searchTerm = filterSearch.salesman.toLowerCase()
                    if (!searchTerm) return true
                    const name = (salesman.name || '').toLowerCase()
                    const email = (salesman.email || '').toLowerCase()
                    return name.includes(searchTerm) || email.includes(searchTerm)
                  }).map(salesman => (
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

          {/* Time Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTimeDropdown(!showTimeDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
                setShowSalesmanDropdown(false)
                if (!showTimeDropdown) {
                  setFilterSearch(prev => ({ ...prev, time: '' }))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Time</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showTimeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                <div className="py-1">
                  {[
                    { value: 'morning', label: 'Morning (6 AM - 12 PM)' },
                    { value: 'afternoon', label: 'Afternoon (12 PM - 6 PM)' },
                    { value: 'evening', label: 'Evening (6 PM - 12 AM)' },
                    { value: 'night', label: 'Night (12 AM - 6 AM)' }
                  ].filter(option => 
                    !filterSearch.time || option.label.toLowerCase().includes(filterSearch.time.toLowerCase())
                  ).map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('timeRange', option.value)
                        setShowTimeDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        activeFilters.timeRange === option.value ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {option.label}
                    </button>
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
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
          <FaSearch style={{ color: appTheme.text.tertiary }} className="flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title, contact, company, type, status, priority, notes..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: appTheme.text.primary }}
          />
          {search && search.trim() && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSearch('')
              }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
              title="Clear search"
              type="button"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          )}
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
            <table className="w-full border-collapse" style={{ minWidth: '1600px' }}>
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
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[150px]"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('salesman')}
                  >
                    <div className="flex items-center">
                      ASSIGNED TO
                      <SortIcon field="salesman" />
                    </div>
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
                        {/* Show HubSpot badge if task is pushed to HubSpot */}
                        {task.hubspotTaskId && (
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
                          {(() => {
                            // Get the actual contact name - prefer associatedContactName, then customerName (but filter out "HubSpot Contact")
                            const displayName = task.associatedContactName || 
                              (task.customerName && task.customerName !== 'HubSpot Contact' ? task.customerName : '') ||
                              task.customerEmail || '';
                            const displayEmail = task.associatedContactEmail || task.customerEmail || '';
                            
                            if (!displayName && !displayEmail) {
                              return <span className="text-sm text-gray-400">—</span>;
                            }
                            
                            return (
                              <>
                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {(displayName || displayEmail || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: appTheme.text.primary }}>
                                    {displayName || '—'}
                                  </p>
                                  {displayEmail && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {displayEmail}
                                    </p>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {(() => {
                            // Show company from associatedCompanyName first, then customer.company
                            const companyName = task.associatedCompanyName || 
                              (task.customer && task.customer.company ? task.customer.company.trim() : '');
                            
                            if (!companyName) {
                              return <span className="text-sm text-gray-400" title="No company associated">—</span>;
                            }
                            
                            return (
                              <>
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {companyName[0].toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm truncate" style={{ color: appTheme.text.primary }}>
                                  {companyName}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-[150px]">
                          {(() => {
                            // Show assigned salesman (from HubSpot owner if available, otherwise from salesman field)
                            // Priority: hubspot_owner_name > salesman.name > salesman.email
                            const hubspotOwnerName = (task.hubspot_owner_name || '').trim();
                            const salesmanName = (task.salesman?.name || '').trim();
                            const salesmanEmail = (task.salesman?.email || '').trim();
                            
                            // Use HubSpot owner name if available, otherwise use salesman name, then email
                            let displayName = hubspotOwnerName || salesmanName || salesmanEmail || 'No Owner';
                            const displayEmail = task.hubspot_owner_email || salesmanEmail || '';
                            const createdByName = task.createdBy?.name || task.createdBy?.email || '';
                            
                            return (
                              <>
                                {displayName && displayName !== 'No Owner' && (
                                  <div className="flex items-center gap-2">
                                    <FaUser className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate" style={{ color: appTheme.text.primary }} title={hubspotOwnerName ? "HubSpot Owner" : "Assigned Salesman"}>
                                        {displayName}
                                      </span>
                                      {displayEmail && displayEmail !== displayName && (
                                        <span className="text-xs text-gray-500 truncate" title="Email">
                                          {displayEmail}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {displayName === 'No Owner' && (
                                  <span className="text-sm text-gray-400 italic">No Owner</span>
                                )}
                                {createdByName && createdByName !== displayName && createdByName !== salesmanEmail && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 truncate" title="Created By">
                                      Created: {createdByName}
                                    </span>
                                  </div>
                                )}
                                {!displayName && !createdByName && (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </>
                            );
                          })()}
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
                          {task.hs_task_type || task.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: appTheme.text.secondary }}>
                            <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(task.dueDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Show Push button for tasks that can be pushed to HubSpot */}
                          {/* Logic: 
                            - Admin-created tasks: No approval needed, show if not pushed and not imported
                            - Salesman-created tasks: Must be approved, show if approved + not pushed + not imported
                          */}
                          {(() => {
                            // Check if task is imported from HubSpot (not app-created)
                            const isImportedFromHubSpot = task.source === 'hubspot';
                            const isAdminCreated = task.createdBy?.role === 'admin';
                            const isSalesmanCreated = task.createdBy?.role === 'salesman';
                            
                            // Admin-created tasks: Always show push button (unless imported from HubSpot)
                            // Backend will verify if task actually exists in HubSpot before blocking duplicate push
                            if (isAdminCreated) {
                              // Show push button if source is 'app' or undefined/null (app-created)
                              // Don't show if source is 'hubspot' (imported from HubSpot)
                              return !isImportedFromHubSpot;
                            }
                            
                            // Salesman-created tasks: Must be approved and not pushed and not imported
                            if (isSalesmanCreated) {
                              const hasHubspotId = task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null;
                              return task.approvalStatus === 'Approved' && !hasHubspotId && !isImportedFromHubSpot;
                            }
                            
                            // Fallback: if role is unknown, check source field
                            // If source is 'app' or undefined, show push button if approved
                            // If source is 'hubspot', don't show push button
                            if (!isImportedFromHubSpot) {
                              const hasHubspotId = task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null;
                              return task.approvalStatus === 'Approved' && !hasHubspotId;
                            }
                            
                            return false;
                          })() && (
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
                          {/* Show Imported badge for HubSpot imported tasks */}
                          {task.source === 'hubspot' && (
                            <span 
                              className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700"
                              title="Imported from HubSpot"
                            >
                              Imported
                            </span>
                          )}
                          {/* Show Delete button only for app-created tasks (not HubSpot imported) */}
                          {task.source !== 'hubspot' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTask(task._id)
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Task"
                            >
                              <FaTrash className="w-4 h-4" />
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
                  {/* Show both App-created and HubSpot-imported customers */}
                  {customers.length > 0 && (
                    <>
                      {customers.filter(c => c.source !== 'hubspot' && !c.isHubSpot).length > 0 && (
                        <optgroup label="App Customers">
                          {customers.filter(c => c.source !== 'hubspot' && !c.isHubSpot).map((customer) => (
                            <option key={customer._id} value={customer._id}>
                              {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {customers.filter(c => c.source === 'hubspot' || c.isHubSpot).length > 0 && (
                        <optgroup label="HubSpot Customers">
                          {customers.filter(c => c.source === 'hubspot' || c.isHubSpot).map((customer) => (
                            <option key={customer._id} value={customer._id}>
                              {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
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

              {/* Associated Contact (Optional) */}
              <div className="border-t pt-4 mt-4" style={{ borderColor: appTheme.border.light }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: appTheme.text.primary }}>
                  Associated Contact (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.associatedContactName}
                      onChange={(e) => setFormData({ ...formData, associatedContactName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                      style={{ 
                        borderColor: appTheme.border.medium,
                        focusRingColor: appTheme.primary.main
                      }}
                      placeholder="Enter contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.associatedContactEmail}
                      onChange={(e) => setFormData({ ...formData, associatedContactEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                      style={{ 
                        borderColor: appTheme.border.medium,
                        focusRingColor: appTheme.primary.main
                      }}
                      placeholder="Enter contact email"
                    />
                  </div>
                </div>
              </div>

              {/* Associated Company (Optional) */}
              <div className="border-t pt-4 mt-4" style={{ borderColor: appTheme.border.light }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: appTheme.text.primary }}>
                  Associated Company (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.associatedCompanyName}
                      onChange={(e) => setFormData({ ...formData, associatedCompanyName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                      style={{ 
                        borderColor: appTheme.border.medium,
                        focusRingColor: appTheme.primary.main
                      }}
                      placeholder="Enter company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                      Company Domain
                    </label>
                    <input
                      type="text"
                      value={formData.associatedCompanyDomain}
                      onChange={(e) => setFormData({ ...formData, associatedCompanyDomain: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                      style={{ 
                        borderColor: appTheme.border.medium,
                        focusRingColor: appTheme.primary.main
                      }}
                      placeholder="e.g., example.com"
                    />
                  </div>
                </div>
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
                    {selectedTask.description || `Follow up with ${selectedTask.associatedContactName || selectedTask.customerName || 'Contact'}`}
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
                {/* Show Delete button only for app-created tasks (not HubSpot imported) */}
                {selectedTask.source !== 'hubspot' && (
                  <button
                    onClick={() => handleDeleteTask(selectedTask._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <FaTrash className="w-4 h-4" />
                    Delete
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
                {(() => {
                  const displayName = selectedTask.associatedContactName || selectedTask.customerName || '';
                  const displayEmail = selectedTask.associatedContactEmail || selectedTask.customerEmail || '';
                  return displayName || displayEmail ? (
                    <>
                      {/* Contact Card */}
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-2xl font-semibold text-gray-600">
                              {(displayName || displayEmail || '?')[0].toUpperCase()}
                    </span>
                          </div>
                          <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900">{displayName || '—'}</h2>
                            {displayEmail && (
                              <p className="text-sm text-gray-500 mt-1">{displayEmail}</p>
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
                        {displayEmail && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Email</p>
                            <p className="text-sm text-gray-900">{displayEmail}</p>
                          </div>
                        )}
                        {selectedTask.customerPhone && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                            <p className="text-sm text-gray-900">{selectedTask.customerPhone}</p>
                          </div>
                        )}
                        {(() => {
                          // Show assigned salesman - prioritize HubSpot owner name, then salesman name
                          const hubspotOwnerName = (selectedTask.hubspot_owner_name || '').trim();
                          const salesmanName = (selectedTask.salesman?.name || '').trim();
                          const salesmanEmail = (selectedTask.salesman?.email || '').trim();
                          const displayName = hubspotOwnerName || salesmanName || salesmanEmail || '';
                          const displayEmail = selectedTask.hubspot_owner_email || salesmanEmail || '';
                          
                          if (!displayName) return null;
                          
                          return (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                {hubspotOwnerName ? 'HubSpot Owner' : 'Assigned Salesman'}
                              </p>
                              <p className="text-sm text-gray-900">
                                {displayName}
                                {displayEmail && displayEmail !== displayName && (
                                  <span className="ml-2 text-xs text-gray-500">({displayEmail})</span>
                                )}
                              </p>
                            </div>
                          );
                        })()}
                        {selectedTask.createdBy && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Created By</p>
                            <p className="text-sm text-gray-900">
                              {selectedTask.createdBy?.name || selectedTask.createdBy?.email || '—'}
                              {selectedTask.createdBy?.role && (
                                <span className="ml-2 text-xs text-gray-500">({selectedTask.createdBy.role})</span>
                              )}
                            </p>
                          </div>
                        )}
                        {selectedTask.customer?.address && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Address</p>
                            <p className="text-sm text-gray-900">{selectedTask.customer.address}</p>
                          </div>
                        )}
                        {selectedTask.customer?.city && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">City</p>
                            <p className="text-sm text-gray-900">{selectedTask.customer.city}</p>
                          </div>
                        )}
                        {selectedTask.customer?.state && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">State</p>
                            <p className="text-sm text-gray-900">{selectedTask.customer.state}</p>
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
                  ) : null;
                })()}
              </div>

              {/* Center Panel - Task Details with Tabs */}
              <div className="flex-1 bg-white overflow-y-auto">
                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setModalActiveTab('overview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        modalActiveTab === 'overview'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setModalActiveTab('activities')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        modalActiveTab === 'activities'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => setModalActiveTab('intelligence')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        modalActiveTab === 'intelligence'
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
                      {/* Task Details Section */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Task Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Follow-up Number</p>
                            <p className="text-sm font-medium text-gray-900">{selectedTask.followUpNumber || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Task Type</p>
                            <p className="text-sm font-medium text-gray-900">{selectedTask.hs_task_type || selectedTask.type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Priority</p>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              selectedTask.priority === 'Urgent' ? 'bg-red-100 text-red-700' :
                              selectedTask.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                              selectedTask.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {selectedTask.priority || '—'}
                </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Status</p>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              selectedTask.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                              selectedTask.status === 'Today' ? 'bg-yellow-100 text-yellow-700' :
                              selectedTask.status === 'Completed' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {selectedTask.status || '—'}
                </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Approval Status</p>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              selectedTask.approvalStatus === 'Approved' ? 'bg-green-100 text-green-700' :
                              selectedTask.approvalStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {selectedTask.approvalStatus || '—'}
                            </span>
                          </div>
                          {selectedTask.hubspotTaskId && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">HubSpot Task ID</p>
                              <p className="text-sm font-medium text-gray-900 font-mono">{selectedTask.hubspotTaskId}</p>
                            </div>
                          )}
                          {selectedTask.hs_task_queue && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Queue</p>
                              <p className="text-sm font-medium text-gray-900">{selectedTask.hs_task_queue}</p>
                            </div>
                          )}
                          {selectedTask.hs_task_reminder && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Reminder</p>
                              <p className="text-sm font-medium text-gray-900">{selectedTask.hs_task_reminder}</p>
                            </div>
                          )}
                        </div>
              </div>

                      {/* Dates Section */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dates & Timeline</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Scheduled Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.scheduledDate
                                ? `${new Date(selectedTask.scheduledDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.scheduledDate).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Due Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.dueDate
                                ? `${new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.dueDate).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}`
                                : '—'}
                            </p>
                          </div>
                          {selectedTask.completedDate && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Completed Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {`${new Date(selectedTask.completedDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.completedDate).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}`}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Created Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.createdAt
                                ? `${new Date(selectedTask.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.createdAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.updatedAt
                                ? `${new Date(selectedTask.updatedAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.updatedAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}`
                                : '—'}
                            </p>
                          </div>
                        </div>
              </div>

                      {/* Description & Notes */}
                      {(selectedTask.description || selectedTask.notes) && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Description & Notes</h3>
                          {selectedTask.description && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">Description</p>
                              <p className="text-sm text-gray-900">{selectedTask.description}</p>
                  </div>
                          )}
                          {selectedTask.notes && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Notes</p>
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedTask.notes}</p>
                            </div>
                          )}
                </div>
              )}

                      {/* Related Items */}
                      {(selectedTask.relatedQuotation || selectedTask.relatedSample || selectedTask.relatedOrder || selectedTask.visitTarget) && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Related Items</h3>
                  <div className="space-y-2">
                            {selectedTask.relatedQuotation && (
                    <div className="flex items-center gap-2">
                                <FaFileAlt className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Quotation: {selectedTask.relatedQuotation?.quotationNumber || selectedTask.relatedQuotation}
                                </span>
                    </div>
                            )}
                            {selectedTask.relatedSample && (
                      <div className="flex items-center gap-2">
                                <FaFlask className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Sample: {selectedTask.relatedSample?.sampleNumber || selectedTask.relatedSample}
                                </span>
                      </div>
                    )}
                            {selectedTask.relatedOrder && (
                      <div className="flex items-center gap-2">
                                <FaShoppingCart className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Order: {selectedTask.relatedOrder?.soNumber || selectedTask.relatedOrder}
                                </span>
                      </div>
                    )}
                            {selectedTask.visitTarget && (
                              <div className="flex items-center gap-2">
                                <FaMapMarkerAlt className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Visit Target: {selectedTask.visitTarget?.name || selectedTask.visitTarget}
                                </span>
                              </div>
                            )}
                  </div>
                </div>
              )}

                      {/* Approval Information */}
                      {selectedTask.approvalStatus && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Approval Information</h3>
                          <div className="space-y-2">
                <div>
                              <p className="text-xs text-gray-500 mb-1">Approval Status</p>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                selectedTask.approvalStatus === 'Approved' ? 'bg-green-100 text-green-700' :
                                selectedTask.approvalStatus === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {selectedTask.approvalStatus}
                              </span>
                            </div>
                            {selectedTask.approvedBy && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Approved By</p>
                                <p className="text-sm text-gray-900">
                                  {selectedTask.approvedBy?.name || selectedTask.approvedBy?.email || '—'}
                  </p>
                </div>
                            )}
                            {selectedTask.approvedAt && (
                  <div>
                                <p className="text-xs text-gray-500 mb-1">Approved At</p>
                                <p className="text-sm text-gray-900">
                                  {`${new Date(selectedTask.approvedAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.approvedAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}`}
                    </p>
                  </div>
                )}
                            {selectedTask.rejectionReason && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Rejection Reason</p>
                                <p className="text-sm text-gray-900">{selectedTask.rejectionReason}</p>
              </div>
                            )}
                          </div>
                        </div>
                      )}

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
                              {selectedTask.dueDate || selectedTask.updatedAt
                                ? `${new Date(selectedTask.dueDate || selectedTask.updatedAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                  })} ${new Date(selectedTask.dueDate || selectedTask.updatedAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })} GMT+5`
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
                                    ? `${new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })} ${new Date(selectedTask.dueDate).toLocaleTimeString('en-GB', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                      })} GMT+5`
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
                      Companies ({(() => {
                        const companyName = selectedTask.associatedCompanyName || 
                          (selectedTask.customer && selectedTask.customer.company ? selectedTask.customer.company.trim() : '');
                        return companyName ? 1 : 0;
                      })()})
                    </h3>
                  </div>
                  {(() => {
                    const companyName = selectedTask.associatedCompanyName || 
                      (selectedTask.customer && selectedTask.customer.company ? selectedTask.customer.company.trim() : '');
                    const companyDomain = selectedTask.associatedCompanyDomain || '';
                    
                    if (!companyName) {
                      return <p className="text-sm text-gray-500">No companies associated</p>;
                    }
                    
                    return (
                      <div className="space-y-4">
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-semibold text-gray-600">
                                {companyName[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {companyName}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Primary</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Company Domain Name</p>
                              <p className="text-gray-900">{companyDomain || '—'}</p>
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
                    );
                  })()}

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
