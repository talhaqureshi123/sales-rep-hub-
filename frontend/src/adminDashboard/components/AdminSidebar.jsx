import { 
  FaHome,
  FaBox, 
  FaUsers, 
  FaUser, 
  FaLink, 
  FaBullseye, 
  FaMapMarkerAlt,
  FaSignOutAlt,
  FaChartLine,
  FaCheckCircle,
  FaVideo,
  FaShoppingCart,
  FaFileInvoice,
  FaFlask,
  FaBell,
  FaCamera,
  FaMapMarkedAlt,
  FaCloud,
  FaTasks,
  FaUpload
} from 'react-icons/fa'

const AdminSidebar = ({ activePage, setActivePage, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', icon: FaHome, label: 'Dashboard' },
    { id: 'product-catalog', icon: FaBox, label: 'Product Catalog' },
    { id: 'product-videos', icon: FaVideo, label: 'Product Videos' },
    { id: 'hubspot-connect', icon: FaCloud, label: 'HubSpot Connect' },
    { id: 'hubspot-tasks', icon: FaTasks, label: 'Tasks' },
    { id: 'sales-orders', icon: FaShoppingCart, label: 'Sales Orders' },
    { id: 'quotes', icon: FaFileInvoice, label: 'Quotes' },
    { id: 'sample-tracker', icon: FaFlask, label: 'Sample Tracker' },
    { id: 'follow-up-manager', icon: FaBell, label: 'Follow-Up Manager' },
    { id: 'sales-targets', icon: FaBullseye, label: 'Sales Targets' },
    { id: 'sales-submissions', icon: FaUpload, label: 'Sales Submissions' },
    { id: 'user-management', icon: FaUsers, label: 'Salesman Management' },
    { id: 'customer-management', icon: FaUser, label: 'Customer Management' },
    { id: 'customer-allotment', icon: FaLink, label: 'Customer Allotment' },
    { id: 'assign-target', icon: FaMapMarkerAlt, label: 'Assign Target' },
    { id: 'visited-targets', icon: FaCheckCircle, label: 'Visited Targets' },
    { id: 'conversions-tracking', icon: FaChartLine, label: 'Conversions & Tracking' },
    { id: 'shift-photos', icon: FaCamera, label: 'Shift Photos' },
    { id: 'live-tracking', icon: FaMapMarkedAlt, label: 'Live Tracking' },
    // { id: 'milestone-management', icon: FaMapMarkerAlt, label: 'Milestone Management' }, // COMMENTED OUT
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
            <h2 className="text-gray-800 font-bold text-sm">Sales Rap Hub</h2>
            <p className="text-gray-600 text-xs">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full px-2 md:px-4 py-3 flex items-center justify-center md:justify-start gap-2 transition-all duration-200 rounded-md mb-2 group ${
                isActive
                  ? 'bg-[#e9931c] text-white'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-[#e9931c]'
              }`}
              title={item.label}
            >
              <Icon className={`w-6 h-6 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-700 group-hover:text-[#e9931c]'}`} />
              <span className="hidden md:inline font-medium text-sm">{item.label}</span>
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

export default AdminSidebar

