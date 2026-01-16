import { useState, useEffect } from 'react'
import AdminDashboardPage from './AdminDashboardPage'
import UserManagement from './UserManagement'
import ProductCatalog from './ProductCatalog'
import ProductVideos from './ProductVideos'
import SalesOrders from './SalesOrders'
import Quotes from './Quotes'
import SampleTracker from './SampleTracker'
import FollowUpManager from './FollowUpManager'
import SalesTargets from './SalesTargets'
// import MilestoneManagement from './MilestoneManagement' // COMMENTED OUT
import CustomerManagement from './CustomerManagement'
import CustomerAllotment from './CustomerAllotment'
import AssignTarget from './AssignTarget'
import VisitedTargets from './VisitedTargets'
import ConversionsTracking from './ConversionsTracking'
import ShiftPhotos from './ShiftPhotos'
import LiveTracking from './LiveTracking'
import HubSpotConnect from './HubSpotConnect'
import HubSpotTasks from './HubSpotTasks'
import AdminSidebar from '../components/AdminSidebar'
import AdminBottomNavbar from '../components/AdminBottomNavbar'
import { logoutService } from '../../services/adminservices/loginservice'

const AdminDashboard = ({ onLogout }) => {
  const [activePage, setActivePage] = useState('dashboard')

  const handleLogout = () => {
    logoutService()
    if (onLogout) {
      onLogout()
    }
  }

  // Listen for navigation events from dashboard
  useEffect(() => {
    const handleNavigate = (event) => {
      if (event.detail && ['dashboard', 'product-catalog', 'product-videos', 'hubspot-connect', 'hubspot-tasks', 'sales-orders', 'quotes', 'sample-tracker', 'follow-up-manager', 'sales-targets', 'user-management', 'customer-management', 'customer-allotment', 'assign-target', 'visited-targets', 'conversions-tracking', 'shift-photos', 'live-tracking'].includes(event.detail)) {
        setActivePage(event.detail)
      }
    }
    window.addEventListener('navigateToTab', handleNavigate)
    return () => window.removeEventListener('navigateToTab', handleNavigate)
  }, [])

  const renderContent = () => {
    console.log('Active page:', activePage)
    switch (activePage) {
      case 'dashboard':
        return <AdminDashboardPage />
      case 'product-catalog':
        return <ProductCatalog />
      case 'product-videos':
        return <ProductVideos />
      case 'hubspot-connect':
        return <HubSpotConnect />
      case 'hubspot-tasks':
        return <HubSpotTasks />
      case 'sales-orders':
        return <SalesOrders />
      case 'quotes':
        return <Quotes />
      case 'sample-tracker':
        return <SampleTracker />
      case 'follow-up-manager':
        return <FollowUpManager />
      case 'sales-targets':
        return <SalesTargets />
      case 'user-management':
        return <UserManagement />
      case 'customer-management':
        return <CustomerManagement />
      case 'customer-allotment':
        return <CustomerAllotment />
      case 'assign-target':
        return <AssignTarget />
      case 'visited-targets':
        return <VisitedTargets />
      case 'conversions-tracking':
        return <ConversionsTracking />
      case 'shift-photos':
        return <ShiftPhotos />
      case 'live-tracking':
        return <LiveTracking />
      // case 'milestone-management': // COMMENTED OUT
      //   return <MilestoneManagement />
      default:
        return <AdminDashboardPage />
    }
  }

  return (
    <div className="h-screen w-full flex bg-white overflow-hidden m-0 p-0">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <AdminSidebar activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Mobile Only */}
        <div className="bg-white shadow-md px-4 py-3 flex items-center justify-between md:hidden">
          <h1 className="text-lg font-bold" style={{ color: '#e9931c' }}>
            Admin Dashboard
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Main Content */}
        <div className={`flex-1 overflow-y-auto min-w-0 ${activePage === 'user-management' ? 'p-4' : 'p-4 lg:p-6'} pb-20 lg:pb-4`}>
          {renderContent()}
        </div>

        {/* Bottom Navbar - Mobile and Tablet Only */}
        <AdminBottomNavbar activeTab={activePage} setActiveTab={setActivePage} />
      </div>
    </div>
  )
}

export default AdminDashboard

