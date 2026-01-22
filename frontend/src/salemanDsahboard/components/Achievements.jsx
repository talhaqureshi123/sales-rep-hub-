import { useState, useEffect } from 'react'
import { getAchievementStats } from '../../services/salemanservices/achievementService'

const Achievements = () => {
  const [achievements, setAchievements] = useState([])
  const [stats, setStats] = useState({
    totalSales: 0,
    monthlySales: 0,
    monthlyTarget: 150000,
    conversionRate: 0,
    completedTargets: 0,
    totalTargets: 0,
    totalCustomers: 0,
    activeCustomers: 0,
  })
  const [grpa, setGrpa] = useState({
    rank: 0,
    totalSalesmen: 0,
    percentage: 0,
    score: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAchievementData()
  }, [])

  const loadAchievementData = async () => {
    try {
      setLoading(true)
      const result = await getAchievementStats()
      if (result.success && result.data) {
        setStats({
          totalSales: result.data.stats.totalSales || 0,
          monthlySales: result.data.stats.monthlySales || 0,
          monthlyTarget: result.data.stats.monthlyTarget || 150000,
          conversionRate: result.data.stats.conversionRate || 0,
          completedTargets: result.data.stats.completedTargets || 0,
          totalTargets: result.data.stats.totalTargets || 0,
          totalCustomers: result.data.stats.totalCustomers || 0,
          activeCustomers: result.data.stats.activeCustomers || 0,
        })
        setGrpa(result.data.grpa || {
          rank: 0,
          totalSalesmen: 0,
          percentage: 0,
          score: 0,
        })
        setAchievements(result.data.achievements || [])
      } else {
        console.error('Failed to load achievement data:', result.message)
      }
    } catch (error) {
      console.error('Error loading achievement data:', error)
    } finally {
      setLoading(false)
    }
  }

  const progressPercentage = stats.totalTargets > 0 
    ? (stats.completedTargets / stats.totalTargets) * 100 
    : 0
  const salesProgress = stats.monthlyTarget > 0 
    ? (stats.monthlySales / stats.monthlyTarget) * 100 
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading achievements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Achievements & Conversion Tracking</h2>

        {/* GRPA Card */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 sm:p-6 border-2 border-purple-200 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-bold text-purple-800 mb-1">GRPA (Group Real Performance Award)</h3>
              <p className="text-xs sm:text-sm text-purple-600">Your performance ranking in the group</p>
            </div>
            <div className="text-left sm:text-right w-full sm:w-auto">
              <div className="text-2xl sm:text-3xl font-bold text-purple-700">
                #{grpa.rank || 'N/A'}
              </div>
              <p className="text-xs text-purple-600 mt-1">
                Rank out of {grpa.totalSalesmen || 0}
              </p>
              <div className="mt-2">
                <div className="bg-purple-200 rounded-full h-2 w-full sm:w-32">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${Math.min(grpa.percentage || 0, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-purple-600 mt-1">{grpa.percentage || 0}% Performance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 sm:p-4 border border-blue-200">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Monthly Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-700">₹{stats.monthlySales.toLocaleString()}</p>
            <div className="mt-2">
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min(salesProgress, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {salesProgress.toFixed(1)}% of ₹{stats.monthlyTarget.toLocaleString()} target
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 sm:p-4 border border-green-200">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Conversion Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.conversionRate}%</p>
            <p className="text-[10px] sm:text-xs text-gray-600 mt-2">Average conversion rate</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 sm:p-4 border border-orange-200">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Visit Targets Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-700">
              {stats.completedTargets}/{stats.totalTargets}
            </p>
            <div className="mt-2">
              <div className="w-full bg-orange-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">{progressPercentage.toFixed(1)}% completed</p>
            </div>
          </div>
        </div>

        {/* Achievements List */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Recent Achievements</h3>
          {achievements.length === 0 ? (
            <div className="bg-white rounded-lg p-8 border border-gray-200 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <p className="text-gray-600 font-medium">No achievements yet</p>
              <p className="text-sm text-gray-500 mt-2">Complete visit targets and get quotations approved to see achievements here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="bg-white rounded-lg p-4 border-l-4 border-[#e9931c] border-r border-t border-b border-gray-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{achievement.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Date: {achievement.date}</p>
                  </div>
                  <div className="text-right">
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {achievement.conversion}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Conversion</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {/* Performance Chart Placeholder */}
        <div className="mt-4 sm:mt-6 bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Performance Chart</h3>
          <div className="h-64 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-600">Conversion & Sales Chart</p>
              <p className="text-sm text-gray-500">Visual representation of performance</p>
            </div>
          </div>
        </div>
      </div>
  )
}

export default Achievements

