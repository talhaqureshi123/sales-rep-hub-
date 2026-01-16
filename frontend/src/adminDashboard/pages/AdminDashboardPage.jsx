import { useState, useEffect } from 'react'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers } from '../../services/adminservices/customerService'
import { getVisitTargets } from '../../services/adminservices/visitTargetService'
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
  FaBox
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
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load salesmen
      const salesmenResult = await getUsers({ role: 'salesman' })
      const salesmen = salesmenResult.success && salesmenResult.data ? salesmenResult.data : []
      
      // Load customers
      const customersResult = await getCustomers()
      const customers = customersResult.success && customersResult.data ? customersResult.data : []
      
      // Load visit targets
      const visitTargetsResult = await getVisitTargets()
      const visitTargets = visitTargetsResult.success && visitTargetsResult.data ? visitTargetsResult.data : []
      
      // Calculate stats
      const activeSalesmen = salesmen.filter(s => s.status === 'Active').length
      const activeCustomers = customers.filter(c => c.status === 'Active').length
      const completedVisits = visitTargets.filter(vt => vt.status === 'Completed').length
      const pendingVisits = visitTargets.filter(vt => vt.status === 'Pending').length
      
      // Today's schedule (pending visit targets for today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todaySchedule = visitTargets
        .filter(vt => {
          if (vt.status !== 'Pending') return false
          if (!vt.visitDate) return false
          const visitDate = new Date(vt.visitDate)
          visitDate.setHours(0, 0, 0, 0)
          return visitDate.getTime() === today.getTime()
        })
        .slice(0, 5)
        .map(vt => ({
          name: vt.name,
          address: vt.address || vt.city || 'Location',
          priority: vt.priority || 'Medium',
          visitDate: vt.visitDate,
        }))

      // Recent activity (completed visit targets)
      const recentActivity = visitTargets
        .filter(vt => vt.status === 'Completed' && vt.completedAt)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, 5)
        .map(vt => ({
          type: 'visit',
          title: `Visit Completed: ${vt.name}`,
          description: vt.address || vt.city || 'Location',
          date: vt.completedAt,
        }))

      // Generate chart data (last 7 days)
      const dailyData = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        
        const dayVisits = visitTargets.filter(vt => {
          if (!vt.completedAt) return false
          const completed = new Date(vt.completedAt)
          completed.setHours(0, 0, 0, 0)
          return completed.getTime() === date.getTime()
        }).length

        dailyData.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          visits: dayVisits,
          customers: 0, // Can be enhanced later
        })
      }

      // Generate monthly data (last 6 months)
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthName = date.toLocaleDateString('en-US', { month: 'short' })
        
        const monthVisits = visitTargets.filter(vt => {
          if (!vt.completedAt) return false
          const completed = new Date(vt.completedAt)
          return completed.getMonth() === date.getMonth() && 
                 completed.getFullYear() === date.getFullYear()
        }).length

        monthlyData.push({
          month: monthName,
          visits: monthVisits,
          customers: 0, // Can be enhanced later
        })
      }
      
      setDashboardData({
        kpis: {
          totalSalesmen: salesmen.length,
          totalCustomers: customers.length,
          completedVisits,
          pendingVisits,
        },
        todaySchedule,
        recentActivity,
        charts: {
          daily: dailyData,
          monthly: monthlyData,
        },
        overall: {
          totalSalesmen: salesmen.length,
          activeSalesmen,
          totalCustomers: customers.length,
          activeCustomers,
        },
      })
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

  const { kpis, todaySchedule, recentActivity, charts, overall } = dashboardData

  const handleManageSalesmen = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'user-management' }))
  }

  const handleManageCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'customer-management' }))
  }

  const handleProductCatalog = () => {
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'product-catalog' }))
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
            <p className="text-sm text-gray-600">Pending Visits</p>
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
    </div>
  )
}

export default AdminDashboardPage
