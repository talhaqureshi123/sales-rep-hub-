import { 
  FaHome,
  FaMapMarkerAlt, 
  FaFileInvoice, 
  FaUsers,
  FaTrophy,
  FaTasks,
  FaBullseye,
  FaUpload
} from 'react-icons/fa'

const BottomNavbar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: FaHome },
    { id: 'sales-tracking', label: 'Tracking', icon: FaMapMarkerAlt },
    { id: 'quotation', label: 'Quotation', icon: FaFileInvoice },
    { id: 'customers', label: 'Customers', icon: FaUsers },
    { id: 'tasks', label: 'Tasks', icon: FaTasks },
    { id: 'sales-targets', label: 'Targets', icon: FaBullseye },
    { id: 'sales-submissions', label: 'Upload', icon: FaUpload },
    { id: 'achievements', label: 'Achievements', icon: FaTrophy },
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

export default BottomNavbar

