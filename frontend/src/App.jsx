import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import LoginPage from './universalpages/loginpage'
import SetupPassword from './universalpages/SetupPassword'
import AdminDashboard from './adminDashboard/pages/AdminDashboard'
import SalesmanDashboard from './salemanDsahboard/pages/SalesmanDashboard'
import { isAuthenticated } from './services/adminservices/loginservice'
import './App.css'

// DEVELOPMENT PURPOSE ONLY - Console warning on app load
console.warn(
  '%c⚠️ DEVELOPMENT PURPOSE ONLY ⚠️',
  'color: #facc15; font-size: 16px; font-weight: bold; background: #000; padding: 6px;'
)
console.warn('This application is running in DEVELOPMENT/TESTING mode.')
console.warn('Some features use deprecated APIs temporarily for testing purposes.')

// Inner component to handle authentication routing
const AppContent = () => {
  const location = useLocation()
  const [authenticated, setAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    // Check if user is already authenticated
    if (isAuthenticated()) {
      setAuthenticated(true)
      const role = localStorage.getItem('userRole')
      setUserRole(role)
    }
  }, [])

  const handleLogin = () => {
    setAuthenticated(true)
    const role = localStorage.getItem('userRole')
    setUserRole(role)
  }

  const handleLogout = () => {
    setAuthenticated(false)
    setUserRole(null)
  }

  // Show setup password page if on that route
  if (location.pathname === '/setup-password') {
    return <SetupPassword />
  }

  if (authenticated) {
    if (userRole === 'salesman') {
      return <SalesmanDashboard onLogout={handleLogout} />
    }
    return <AdminDashboard onLogout={handleLogout} />
  }

  return <LoginPage onLogin={handleLogin} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
