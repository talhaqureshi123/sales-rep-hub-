import { useState, useEffect } from 'react'
import { getDashboardStats } from '../../services/salemanservices/dashboardService'
import { 
  FaCalendarAlt, 
  FaChartLine, 
  FaBell, 
  FaMapMarkerAlt,
  FaFileInvoice,
  FaCheckCircle,
  FaClock,
  FaPlay,
  FaUserPlus,
  FaCamera
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

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    kpis: {
      visitsToday: 0,
      visitsThisWeek: 0,
      hotLeads: 0,
      followUpsDue: 0,
    },
    todaySchedule: [],
    recentActivity: [],
    charts: {
      daily: [],
      monthly: [],
    },
    overall: {
      totalSales: 0,
      totalQuotations: 0,
      approvedQuotations: 0,
      conversionRate: 0,
    },
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const result = await getDashboardStats()
      if (result.success && result.data) {
        setDashboardData(result.data)
      } else {
        console.error('Failed to load dashboard data:', result.message)
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

  const { kpis, todaySchedule, recentActivity, charts, overall } = dashboardData

  const handleStartYourDay = () => {
    // Navigate to sales tracking tab
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'sales-tracking' }))
  }

  const handleAddCustomer = () => {
    // Set flag to open add form
    window.shouldOpenAddCustomer = true
    // Navigate to customers tab
    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'customers' }))
  }

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard Overview</h2>
          <p className="text-gray-600">Welcome back! Here's your performance summary.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleStartYourDay}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#e9931c] to-[#d8820a] text-white rounded-lg font-semibold hover:from-[#d8820a] hover:to-[#c77109] transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <FaCamera className="w-5 h-5" />
            <span>Start Your Day</span>
          </button>
          <button
            onClick={handleAddCustomer}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <FaUserPlus className="w-5 h-5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-5 border border-blue-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Visits Today</p>
            <FaCalendarAlt className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-700">{kpis.visitsToday}</p>
          <p className="text-xs text-gray-600 mt-1">Completed visits</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-5 border border-green-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Visits This Week</p>
            <FaCalendarAlt className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-700">{kpis.visitsThisWeek}</p>
          <p className="text-xs text-gray-600 mt-1">Weekly total</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-5 border border-orange-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Hot Leads</p>
            <FaChartLine className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-orange-700">{kpis.hotLeads}</p>
          <p className="text-xs text-gray-600 mt-1">Active customers</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-5 border border-red-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Follow-ups Due</p>
            <FaBell className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-700">{kpis.followUpsDue}</p>
          <p className="text-xs text-gray-600 mt-1">Pending visits</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales & Visits Chart */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Performance (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="sales" 
                stroke="#e9931c" 
                strokeWidth={2}
                name="Sales (£)"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="visits" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Visits"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Performance (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={charts.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#e9931c" name="Sales (£)" />
              <Bar dataKey="visits" fill="#3b82f6" name="Visits" />
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
              <p className="text-sm text-gray-500 mt-2">Complete visits to see activity here</p>
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
            <p className="text-sm opacity-90">Total Sales</p>
            <p className="text-2xl font-bold">£{overall.totalSales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Total Quotations</p>
            <p className="text-2xl font-bold">{overall.totalQuotations}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Approved</p>
            <p className="text-2xl font-bold">{overall.approvedQuotations}</p>
          </div>
          <div>
            <p className="text-sm opacity-90">Conversion Rate</p>
            <p className="text-2xl font-bold">{overall.conversionRate}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

