import { useState, useEffect } from 'react'
import { logoutService } from '../../services/adminservices/loginservice'
import SalesTracking from '../../universalcomponents/SalesTracking'
import Achievements from '../components/Achievements'
import Quotation from '../components/quatation'
import CustomerManagement from '../components/CustomerManagement'
import Dashboard from '../components/Dashboard'
import Tasks from '../components/Tasks'
import SalesTargets from '../components/SalesTargets'
import SalesSubmissions from '../components/SalesSubmissions'
import SalesmanSidebar from '../components/SalesmanSidebar'
import BottomNavbar from '../components/BottomNavbar'

const SalesmanDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [openAddCustomer, setOpenAddCustomer] = useState(false)

  const handleLogout = () => {
    logoutService()
    if (onLogout) {
      onLogout()
    }
  }

  // Function to navigate to quotation from visit target
  window.handleNavigateToQuotation = () => {
    setActiveTab('quotation')
  }

  // Listen for navigation events
  useEffect(() => {
    const handleNavigate = (event) => {
      if (event.detail && ['dashboard', 'quotation', 'achievements', 'sales-tracking', 'customers', 'tasks', 'sales-targets', 'sales-submissions'].includes(event.detail)) {
        setActiveTab(event.detail)
        // If navigating to customers, check if we should open add form
        if (event.detail === 'customers' && (event.openAddForm || window.shouldOpenAddCustomer)) {
          setOpenAddCustomer(true)
          window.shouldOpenAddCustomer = false // Reset flag
        } else {
          setOpenAddCustomer(false)
        }
      }
    }
    window.addEventListener('navigateToTab', handleNavigate)
    return () => window.removeEventListener('navigateToTab', handleNavigate)
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'sales-tracking':
        return <SalesTracking />
      case 'quotation':
        return <Quotation key={activeTab} />
      case 'customers':
        return <CustomerManagement openAddForm={openAddCustomer} onAddFormClose={() => setOpenAddCustomer(false)} />
      case 'tasks':
        return <Tasks />
      case 'sales-targets':
        return <SalesTargets />
      case 'sales-submissions':
        return <SalesSubmissions />
      case 'achievements':
        return <Achievements />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="h-screen w-full flex bg-white overflow-hidden m-0 p-0">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <SalesmanSidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Mobile Only */}
        <div className="bg-white shadow-md px-4 py-3 flex items-center justify-between md:hidden">
          <h1 className="text-lg font-bold" style={{ color: '#e9931c' }}>
            Salesman Dashboard
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
        <div className={`flex-1 overflow-y-auto ${activeTab === 'quotation' ? 'p-0' : 'p-2 sm:p-4'} pb-20 md:pb-24 lg:pb-4`}>
          {renderContent()}
        </div>

        {/* Bottom Navbar - Mobile and Tablet Only */}
        <BottomNavbar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  )
}

export default SalesmanDashboard

