import { useState } from 'react'

const Sidebar = ({ activeSection, setActiveSection, onLogout }) => {
  const menuItems = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'location', icon: 'map-pin', label: 'Location' },
    { id: 'users', icon: 'user', label: 'Users' },
    { id: 'menu', icon: 'list', label: 'Menu' },
    { id: 'code', icon: 'code', label: 'Code' },
  ]

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'home':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        )
      case 'map-pin':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      case 'user':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'list':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )
      case 'code':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="h-screen w-20 bg-gray-800 flex flex-col items-center py-6 shadow-lg">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{backgroundColor: '#e9931c'}}>
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex flex-col gap-4 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`p-3 rounded-lg transition-all duration-200 ${
              activeSection === item.id
                ? 'text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            style={
              activeSection === item.id
                ? { backgroundColor: '#e9931c' }
                : {}
            }
            title={item.label}
          >
            {getIcon(item.icon)}
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="mt-auto">
        <button 
          onClick={onLogout}
          className="p-3 rounded-lg text-gray-400 hover:text-white hover:bg-red-600 transition-all duration-200"
          title="Logout"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Sidebar

