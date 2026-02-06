import { useState, useEffect } from 'react'
import { getAdminDashboard } from '../../services/adminservices/dashboardService'
import { 
  FaCalendarAlt, 
  FaChartLine, 
  FaBell, 
  FaMapMarkerAlt,
  FaFileInvoice,
  FaCheckCircle,
  FaClock,
  FaUsers,
  FaUser,
  FaBox,
  FaTasks,
  FaBullseye,
  FaArrowRight
} from 'react-icons/fa'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    kpis: {
      totalSalesmen: 0,
      totalCustomers: 0,
      completedVisits: 0,
      pendingVisits: 0,
    },
    todaySchedule: [],
    recentActivity: [],
    charts: {
      daily: [],
      monthly: [],
    },
    overall: {
      totalSalesmen: 0,
      activeSalesmen: 0,
      totalCustomers: 0,
      activeCustomers: 0,
    },
    myCreations: {
      tasks: [],
      customers: [],
      visits: [],
      salesTargets: [],
    },
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Refresh dashboard when tab/window focus or periodically so visit/task delete reflects (pending count sahi ho)
  useEffect(() => {
    const refresh = () => loadDashboardData()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onWindowFocus = () => refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onWindowFocus)
    const intervalMs = 90 * 1000
    const intervalId = setInterval(refresh, intervalMs)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
      clearInterval(intervalId)
    }
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const result = await getAdminDashboard()
      if (result.success && result.data) {
        setDashboardData(result.data)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const { kpis, todaySchedule, recentActivity, charts, overall, myCreations } = dashboardData

  const handleManageSalesmen = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'user-management' }))
  }

  const handleManageCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'customer-management' }))
  }

  const handleProductCatalog = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'product-catalog' }))
  }

  const handleViewTasks = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'hubspot-tasks' }))
  }

  const handleViewCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'customer-management' }))
  }

  const handleViewVisits = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'visited-targets' }))
  }

  const handleViewSalesTargets = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'sales-targets' }))
  }

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Overview</h2>
          <p className="text-gray-600">Welcome back! Here's your system overview.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleManageSalesmen}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#e9931c] to-[#d8820a] text-white rounded-lg font-semibold hover:from-[#d8820a] hover:to-[#c77109] transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <FaUsers className="w-5 h-5" />
            <span>Manage Salesmen</span>
          </button>
          <button
            onClick={handleManageCustomers}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <FaUser className="w-5 h-5" />
            <span>Manage Customers</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Salesmen</p>
            <FaUsers className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-700">{kpis.totalSalesmen}</p>
          <p className="text-xs text-gray-600 mt-1">{overall.activeSalesmen} active</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Customers</p>
            <FaUser className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700">{kpis.totalCustomers}</p>
          <p className="text-xs text-gray-600 mt-1">{overall.activeCustomers} active</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border border-orange-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Completed Visits</p>
            <FaCheckCircle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-orange-700">{kpis.completedVisits}</p>
          <p className="text-xs text-gray-600 mt-1">Total completed</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-5 border border-red-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Pending Visit Targets</p>
            <FaBell className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-700">{kpis.pendingVisits}</p>
          <p className="text-xs text-gray-600 mt-1">Awaiting completion</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Visits Chart */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Visits (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="visits" 
                stroke="#e9931c" 
                strokeWidth={2}
                name="Visits"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Visits Chart */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Visits (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={charts.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="visits" fill="#e9931c" name="Visits" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Schedule and Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Today's Schedule</h3>
            <FaClock className="w-5 h-5 text-gray-400" />
          </div>
          {todaySchedule.length === 0 ? (
            <div className="text-center py-8">
              <FaCalendarAlt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No visits scheduled for today</p>
              <p className="text-sm text-gray-500 mt-2">All caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedule.map((schedule, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <FaMapMarkerAlt className="w-5 h-5 text-[#e9931c] mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{schedule.name}</p>
                    <p className="text-sm text-gray-600">{schedule.address || schedule.city || 'Location'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        schedule.priority === 'High' ? 'bg-red-100 text-red-700' :
                        schedule.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {schedule.priority}
                      </span>
                      {schedule.visitDate && (
                        <span className="text-xs text-gray-500">
                          {new Date(schedule.visitDate).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
            <FaChartLine className="w-5 h-5 text-gray-400" />
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <FaCheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No recent activity</p>
              <p className="text-sm text-gray-500 mt-2">Completed visits will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {activity.type === 'visit' ? (
                    <FaMapMarkerAlt className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  ) : (
                    <FaFileInvoice className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{activity.title}</p>
                    <p className="text-sm text-gray-600">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Overall Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm opacity-90">Total Salesmen</p>
            <p className="text-2xl font-bold">{overall.totalSalesmen}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Active Salesmen</p>
            <p className="text-2xl font-bold">{overall.activeSalesmen}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Total Customers</p>
            <p className="text-2xl font-bold">{overall.totalCustomers}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Active Customers</p>
            <p className="text-2xl font-bold">{overall.activeCustomers}</p>
          </div>
        </div>
      </div>

      {/* My Creations Section */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">My Creations</h3>
            <p className="text-sm text-gray-600 mt-1">Items created by you</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My Tasks */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaTasks className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">My Tasks</h4>
              </div>
              <button
                onClick={handleViewTasks}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <FaArrowRight className="w-3 h-3" />
              </button>
            </div>
            {(!myCreations || !myCreations.tasks || myCreations.tasks.length === 0) ? (
              <p className="text-sm text-gray-500">No tasks created</p>
            ) : (
              <div className="space-y-2">
                {(myCreations?.tasks || []).map((task, index) => (
                  <div key={task._id || index} className="bg-white rounded p-2 border border-blue-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{task.title || task.customerName || 'Task'}</p>
                    <p className="text-xs text-gray-500">{task.type || 'Task'}</p>
                    {task.dueDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Customers */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaUser className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-800">My Customers</h4>
              </div>
              <button
                onClick={handleViewCustomers}
                className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <FaArrowRight className="w-3 h-3" />
              </button>
            </div>
            {(!myCreations || !myCreations.customers || myCreations.customers.length === 0) ? (
              <p className="text-sm text-gray-500">No customers created</p>
            ) : (
              <div className="space-y-2">
                {(myCreations?.customers || []).map((customer, index) => (
                  <div key={customer._id || index} className="bg-white rounded p-2 border border-green-100">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {customer.name || customer.firstName || customer.company || 'Customer'}
                    </p>
                    {customer.email && (
                      <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                    )}
                    {customer.phone && (
                      <p className="text-xs text-gray-400 mt-1">{customer.phone}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Visits */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt className="w-5 h-5 text-orange-600" />
                <h4 className="font-semibold text-gray-800">My Visits</h4>
              </div>
              <button
                onClick={handleViewVisits}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <FaArrowRight className="w-3 h-3" />
              </button>
            </div>
            {(!myCreations || !myCreations.visits || myCreations.visits.length === 0) ? (
              <p className="text-sm text-gray-500">No visits created</p>
            ) : (
              <div className="space-y-2">
                {(myCreations?.visits || []).map((visit, index) => (
                  <div key={visit._id || index} className="bg-white rounded p-2 border border-orange-100">
                    <p className="text-sm font-medium text-gray-800 truncate">{visit.name || 'Visit'}</p>
                    <p className="text-xs text-gray-500 truncate">{visit.address || visit.city || 'Location'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        visit.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        visit.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {visit.status || 'Pending'}
                      </span>
                      {visit.visitDate && (
                        <p className="text-xs text-gray-400">
                          {new Date(visit.visitDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Sales Targets */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaBullseye className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-gray-800">My Sales Targets</h4>
              </div>
              <button
                onClick={handleViewSalesTargets}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
              >
                View All
                <FaArrowRight className="w-3 h-3" />
              </button>
            </div>
            {(!myCreations || !myCreations.salesTargets || myCreations.salesTargets.length === 0) ? (
              <p className="text-sm text-gray-500">No sales targets created</p>
            ) : (
              <div className="space-y-2">
                {(myCreations?.salesTargets || []).map((target, index) => (
                  <div key={target._id || index} className="bg-white rounded p-2 border border-purple-100">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {target.salesman?.name || 'Salesman'} - {target.period || 'Period'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Target: £{Number(target.targetAmount || 0).toFixed(2)}
                    </p>
                    {target.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                        target.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        target.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {target.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboardPage
