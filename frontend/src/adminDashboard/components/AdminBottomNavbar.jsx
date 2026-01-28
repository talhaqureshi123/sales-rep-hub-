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
  FaFlask,
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
    { id: 'sample-tracker', label: 'Samples', icon: FaFlask },
    { id: 'hubspot-tasks', label: 'Tasks', icon: FaTasks },
    { id: 'user-management', label: 'Salesmen', icon: FaUsers },
    { id: 'customer-management', label: 'Customers', icon: FaUser },
    { id: 'shift-photos', label: 'Photos', icon: FaCamera },
    { id: 'live-tracking', label: 'Tracking', icon: FaMapMarkedAlt },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 lg:hidden">
      <div className="flex items-center justify-around h-16 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 min-w-[60px] h-full transition-colors ${
                isActive
                  ? 'text-[#e9931c]'
                  : 'text-gray-600'
              }`}
              title={tab.label}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 ${isActive ? 'text-[#e9931c]' : 'text-gray-600'}`} />
              <span className="text-[10px] sm:text-xs font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AdminBottomNavbar
