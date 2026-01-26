import { useState, useEffect, useMemo } from 'react'
import { 
  FaBell, 
  FaTasks, 
  FaMapMarkerAlt, 
  FaFlask,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaCalendarAlt,
  FaUser,
  FaFilter,
  FaSearch,
  FaSpinner
} from 'react-icons/fa'
import { getMyFollowUps } from '../../services/salemanservices/followUpService'
import { getVisitTargets } from '../../services/salemanservices/visitTargetService'
import { getMySamples } from '../../services/salemanservices/sampleService'
import { markAllNotificationsAsSeen } from '../hooks/useNotificationCount'
import { useNotificationCount } from '../hooks/useNotificationCount'

const Notifications = () => {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [visits, setVisits] = useState([])
  const [samples, setSamples] = useState([])
  const [activeFilter, setActiveFilter] = useState('All') // All, Pending, Due Today, Overdue, Upcoming
  const [activeCategory, setActiveCategory] = useState('All') // All, Tasks, Visits, Samples
  const [searchTerm, setSearchTerm] = useState('')
  const { refresh: refreshNotificationCount } = useNotificationCount()

  useEffect(() => {
    loadAllNotifications()
  }, [])

  // Mark all notifications as seen when component mounts (user opened notifications page)
  useEffect(() => {
    if (!loading) {
      // Mark all current notifications as seen (update timestamp)
      markAllNotificationsAsSeen()
      
      // Refresh notification count to update badge (should become 0)
      setTimeout(() => {
        refreshNotificationCount()
      }, 500)
    }
  }, [loading, refreshNotificationCount])

  const loadAllNotifications = async () => {
    setLoading(true)
    try {
      // Load tasks (follow-ups)
      const tasksResult = await getMyFollowUps({})
      if (tasksResult.success && tasksResult.data) {
        setTasks(tasksResult.data)
      }

      // Load visits
      const visitsResult = await getVisitTargets({})
      if (visitsResult.success && visitsResult.data) {
        setVisits(visitsResult.data)
      }

      // Load samples
      const samplesResult = await getMySamples({})
      if (samplesResult.success && samplesResult.data) {
        setSamples(samplesResult.data)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Categorize notifications
  const categorizedNotifications = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const allNotifications = []

    // Process Tasks
    tasks.forEach(task => {
      if (task.status === 'Completed') return
      
      const dueDate = task.dueDate ? new Date(task.dueDate) : null
      const dueDateTime = dueDate ? new Date(dueDate) : null
      if (dueDateTime && task.dueTime) {
        const [hours, minutes] = task.dueTime.split(':')
        dueDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      }

      let category = 'Upcoming'
      if (!dueDate) {
        category = 'Pending'
      } else if (dueDateTime < now) {
        category = 'Overdue'
      } else if (dueDateTime >= now && dueDateTime <= todayEnd) {
        category = 'Due Today'
      } else {
        category = 'Upcoming'
      }

      allNotifications.push({
        id: `task-${task._id || task.id}`,
        type: 'Task',
        category,
        title: task.description || 'Task',
        customer: task.customerName || 'No customer',
        dueDate: dueDate,
        dueTime: task.dueTime,
        priority: task.priority || 'Medium',
        status: task.status,
        data: task
      })
    })

    // Process Visits
    visits.forEach(visit => {
      if (visit.status === 'Completed') return
      
      const visitDate = visit.visitDate ? new Date(visit.visitDate) : null
      let category = 'Pending'
      if (visitDate) {
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
        const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        if (visitDateOnly < todayOnly) {
          category = 'Overdue'
        } else if (visitDateOnly.getTime() === todayOnly.getTime()) {
          category = 'Due Today'
        } else {
          category = 'Upcoming'
        }
      }

      allNotifications.push({
        id: `visit-${visit._id || visit.id}`,
        type: 'Visit',
        category,
        title: visit.name || 'Visit',
        customer: visit.customerName || visit.address || 'No customer',
        dueDate: visitDate,
        priority: visit.priority || 'Medium',
        status: visit.status,
        data: visit
      })
    })

    // Process Samples
    samples.forEach(sample => {
      if (sample.status === 'Converted') return
      
      const visitDate = sample.visitDate ? new Date(sample.visitDate) : null
      const expectedDate = sample.expectedDate ? new Date(sample.expectedDate) : null
      const dueDate = expectedDate || visitDate
      
      let category = 'Pending'
      if (dueDate) {
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        if (dueDateOnly < todayOnly) {
          category = 'Overdue'
        } else if (dueDateOnly.getTime() === todayOnly.getTime()) {
          category = 'Due Today'
        } else {
          category = 'Upcoming'
        }
      }

      allNotifications.push({
        id: `sample-${sample._id || sample.id}`,
        type: 'Sample',
        category,
        title: `${sample.productName || 'Product'} - ${sample.customerName || 'Customer'}`,
        customer: sample.customerName || 'No customer',
        dueDate: dueDate,
        priority: 'Medium',
        status: sample.status,
        data: sample
      })
    })

    return allNotifications
  }, [tasks, visits, samples])

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = categorizedNotifications

    // Filter by category (Pending, Due Today, Overdue, Upcoming)
    if (activeFilter !== 'All') {
      filtered = filtered.filter(n => n.category === activeFilter)
    }

    // Filter by type (Tasks, Visits, Samples)
    if (activeCategory !== 'All') {
      filtered = filtered.filter(n => n.type === activeCategory)
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(search) ||
        n.customer.toLowerCase().includes(search)
      )
    }

    // Sort: Overdue first, then Due Today, then Upcoming, then Pending
    const sortOrder = { 'Overdue': 1, 'Due Today': 2, 'Upcoming': 3, 'Pending': 4 }
    filtered.sort((a, b) => {
      const orderA = sortOrder[a.category] || 5
      const orderB = sortOrder[b.category] || 5
      if (orderA !== orderB) return orderA - orderB
      
      // If same category, sort by date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate) - new Date(b.dueDate)
      }
      return 0
    })

    return filtered
  }, [categorizedNotifications, activeFilter, activeCategory, searchTerm])

  // Count notifications by category
  const notificationCounts = useMemo(() => {
    const counts = {
      All: categorizedNotifications.length,
      'Pending': 0,
      'Due Today': 0,
      'Overdue': 0,
      'Upcoming': 0
    }
    
    categorizedNotifications.forEach(n => {
      if (counts[n.category] !== undefined) {
        counts[n.category]++
      }
    })
    
    return counts
  }, [categorizedNotifications])

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'Task':
        return <FaTasks className="w-4 h-4" />
      case 'Visit':
        return <FaMapMarkerAlt className="w-4 h-4" />
      case 'Sample':
        return <FaFlask className="w-4 h-4" />
      default:
        return <FaBell className="w-4 h-4" />
    }
  }

  const getCategoryColor = (type) => {
    switch (type) {
      case 'Task':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'Visit':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'Sample':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'Low':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getCategoryBadgeColor = (category) => {
    switch (category) {
      case 'Overdue':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'Due Today':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'Upcoming':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'Pending':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const formatDate = (date) => {
    if (!date) return 'No date'
    const d = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    
    if (dateOnly.getTime() === today.getTime()) {
      return 'Today'
    }
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 text-[#e9931c] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#e9931c] bg-opacity-10 rounded-lg">
            <FaBell className="w-8 h-8 text-[#e9931c]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600">All your pending tasks, visits, and samples</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-[#e9931c] bg-opacity-10 rounded-lg">
          <span className="text-2xl font-bold text-[#e9931c]">{categorizedNotifications.length}</span>
          <p className="text-xs text-gray-600">Total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        {/* Category Filter */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Type:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['All', 'Tasks', 'Visits', 'Samples'].map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['All', 'Overdue', 'Due Today', 'Upcoming', 'Pending'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors relative ${
                  activeFilter === filter
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter}
                {notificationCounts[filter] > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeFilter === filter
                      ? 'bg-white text-[#e9931c]'
                      : 'bg-[#e9931c] text-white'
                  }`}>
                    {notificationCounts[filter]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
          />
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm text-center">
          <FaBell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg">No notifications found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || activeFilter !== 'All' || activeCategory !== 'All'
              ? 'Try adjusting your filters'
              : 'You\'re all caught up! No pending items.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-white rounded-lg p-4 border-2 border-gray-200 hover:border-[#e9931c] transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-lg ${getCategoryColor(notification.type)}`}>
                  {getCategoryIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{notification.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <FaUser className="w-3 h-3" />
                        <span>{notification.customer}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getCategoryBadgeColor(notification.category)}`}>
                        {notification.category}
                      </span>
                      {notification.priority && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date Info */}
                  {notification.dueDate && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FaCalendarAlt className="w-4 h-4" />
                      <span>{formatDate(notification.dueDate)}</span>
                      {notification.dueTime && (
                        <>
                          <FaClock className="w-4 h-4 ml-2" />
                          <span>{notification.dueTime}</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getCategoryColor(notification.type)}`}>
                      {getCategoryIcon(notification.type)}
                      {notification.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Notifications
