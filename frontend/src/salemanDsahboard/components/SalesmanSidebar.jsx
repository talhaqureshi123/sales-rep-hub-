import { 
  FaHome,
  FaMapMarkerAlt, 
  FaFileInvoice, 
  FaTrophy,
  FaUsers,
  FaSignOutAlt,
  FaTasks,
  FaBullseye,
  FaShoppingCart,
  FaVideo,
  FaBell,
  FaFlask
} from 'react-icons/fa'
import { useNotificationCount } from '../hooks/useNotificationCount'

const SalesmanSidebar = ({ activeTab, setActiveTab, onLogout }) => {
  const { count: notificationCount } = useNotificationCount()
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: FaHome },
    { id: 'notifications', label: 'Notifications', icon: FaBell, badge: notificationCount },
    { id: 'sales-tracking', label: 'Sales Tracking', icon: FaMapMarkerAlt },
    { id: 'quotation', label: 'Quotation', icon: FaFileInvoice },
    { id: 'customers', label: 'Customers', icon: FaUsers },
    { id: 'tasks', label: 'Tasks', icon: FaTasks },
    { id: 'sample-tracker', label: 'Sample Tracker', icon: FaFlask },
    { id: 'sales-targets', label: 'Sales Targets', icon: FaBullseye },
    { id: 'sales-orders', label: 'Sales Orders', icon: FaShoppingCart },
    { id: 'product-videos', label: 'Product Videos', icon: FaVideo },
    { id: 'achievements', label: 'Achievements', icon: FaTrophy },
  ]

  return (
    <div className="h-screen w-20 md:w-72 bg-gray-50 flex flex-col shadow-lg border-r border-gray-200 flex-shrink-0 m-0 transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: '#e9931c'}}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="hidden md:block">
            <h2 className="text-gray-800 font-bold text-sm">Sales Rep Hub</h2>
            <p className="text-gray-600 text-xs">Salesman Dashboard</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-2 md:px-4 py-3 flex items-center justify-center md:justify-start gap-2 transition-all duration-200 rounded-md mb-2 group relative ${
                isActive
                  ? 'bg-[#e9931c] text-white'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-[#e9931c]'
              }`}
              title={tab.label}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-700 group-hover:text-[#e9931c]'}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                    isActive 
                      ? 'bg-white text-[#e9931c]' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="hidden md:inline font-medium text-sm">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Logout Button at Bottom */}
      <div className="p-4 border-t border-gray-200">
        <button 
          onClick={onLogout}
          className="w-full px-2 md:px-4 py-3 flex items-center justify-center md:justify-start gap-2 md:gap-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200 group"
          title="Logout"
        >
          <FaSignOutAlt className="w-5 h-5 flex-shrink-0 group-hover:text-red-600" />
          <span className="hidden md:inline font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}

export default SalesmanSidebar

