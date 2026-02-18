import {
  FaHome,
  FaBox,
  FaVideo,
  FaShoppingCart,
  FaUsers,
  FaUser,
  FaLink,
  FaBullseye,
  FaChartLine,
  FaCheckCircle,
  FaFileInvoice,
  FaBell,
  FaMapMarkerAlt,
  FaCamera,
  FaMapMarkedAlt,
  FaTasks
} from 'react-icons/fa'

const AdminBottomNavbar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: FaHome },
    { id: 'product-catalog', label: 'Products', icon: FaBox },
    { id: 'product-videos', label: 'Videos', icon: FaVideo },
    { id: 'sales-orders', label: 'Orders', icon: FaShoppingCart },
    { id: 'quotes', label: 'Quotes', icon: FaFileInvoice },
    { id: 'hubspot-tasks', label: 'Tasks', icon: FaTasks },
    { id: 'user-management', label: 'Salesmen', icon: FaUsers },
    { id: 'customer-management', label: 'Customers', icon: FaUser },
    { id: 'shift-photos', label: 'Photos', icon: FaCamera },
    { id: 'live-tracking', label: 'Tracking', icon: FaMapMarkedAlt },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div
        className="flex items-center justify-between w-full h-14 min-h-[56px] sm:h-16 sm:min-h-[64px] overflow-x-auto overflow-y-hidden px-1"
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
              className={`flex flex-col items-center justify-center min-w-[56px] sm:min-w-[68px] h-full px-1 sm:px-2 transition-colors flex-shrink-0 touch-manipulation ${isActive
                ? 'text-[#e9931c]'
                : 'text-gray-600'
                }`}
              title={tab.label}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 flex-shrink-0 ${isActive ? 'text-[#e9931c]' : 'text-gray-600'}`} />
              <span className="text-[9px] sm:text-xs font-medium truncate max-w-[52px] sm:max-w-[64px]">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AdminBottomNavbar
