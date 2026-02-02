import { 
  FaHome,
  FaMapMarkerAlt, 
  FaFileInvoice, 
  FaUsers,
  FaTrophy,
  FaTasks,
  FaBullseye,
  FaShoppingCart,
  FaVideo,
  FaBell
} from 'react-icons/fa'
import { useNotificationCount } from '../hooks/useNotificationCount'

const BottomNavbar = ({ activeTab, setActiveTab }) => {
  const { count: notificationCount } = useNotificationCount()
  
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: FaHome },
    { id: 'notifications', label: 'Notifications', icon: FaBell, badge: notificationCount },
    { id: 'sales-tracking', label: 'Tracking', icon: FaMapMarkerAlt },
    { id: 'quotation', label: 'Quotation', icon: FaFileInvoice },
    { id: 'customers', label: 'Customers', icon: FaUsers },
    { id: 'tasks', label: 'Tasks', icon: FaTasks },
    { id: 'sales-targets', label: 'Targets', icon: FaBullseye },
    { id: 'sales-orders', label: 'Orders', icon: FaShoppingCart },
    { id: 'product-videos', label: 'Videos', icon: FaVideo },
    { id: 'achievements', label: 'Achievements', icon: FaTrophy },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div
        className="flex items-center h-14 min-h-[56px] sm:h-16 sm:min-h-[64px] overflow-x-auto overflow-y-hidden gap-0 pl-2 pr-2"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="tablist"
        aria-label="Bottom navigation"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] sm:min-w-[72px] h-full px-1 sm:px-2 transition-colors flex-shrink-0 relative touch-manipulation ${
                isActive
                  ? 'text-[#e9931c]'
                  : 'text-gray-600'
              }`}
              title={tab.label}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 flex-shrink-0 ${isActive ? 'text-[#e9931c]' : 'text-gray-600'}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-red-500 text-white">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] sm:text-xs font-medium truncate max-w-[52px] sm:max-w-[68px]">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNavbar

