import { useState } from 'react'
import crmImage from '../assets/business-strategy-crm-solution-customer-relationship-management-concept-tiny-businessman-perform-data-analysis-modern-flat-cartoon-style-illustration-on-white-background-vector.jpg'
import { loginService } from '../services/adminservices/loginservice'

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await loginService(email, password)
      
      if (result.success) {
        // Call onLogin callback to update App state
        if (onLogin) {
          onLogin()
        }
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-row  overflow-hidden">

      {/* LEFT SIDE - LOGIN */}
      <div
        className="
          w-full 
          lg:w-2/3 
          flex 
          justify-center 
          items-center 
          px-4 
          sm:px-6 
          lg:px-10
          overflow-y-auto
        "
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10 my-auto">

          {/* LOGO */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg rotate-12 shadow-lg" style={{ backgroundColor: '#e9931c' }} />
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg -rotate-12 shadow-lg" style={{ backgroundColor: '#f5a742' }} />
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg rotate-12 shadow-lg" style={{ backgroundColor: '#d8820a' }} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6" style={{ color: '#e9931c' }}>
            LOGIN
          </h1>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label className="block text-left text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="
                  w-full 
                  px-4 
                  py-3 
                  border-2 
                  border-gray-200 
                  rounded-xl 
                  bg-gray-50 
                  focus:outline-none 
                  focus:border-[#e9931c]
                "
                required
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-left text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  w-full 
                  px-4 
                  py-3 
                  border-2 
                  border-gray-200 
                  rounded-xl 
                  bg-gray-50 
                  focus:outline-none 
                  focus:border-[#e9931c]
                "
                required
              />
            </div>

            {/* FORGOT */}
            <div className="text-right">
              <a href="#" className="text-sm font-medium text-[#e9931c] hover:underline">
                Forgot Password?
              </a>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full 
                py-3 
                rounded-xl 
                text-white 
                font-semibold 
                transition 
                hover:opacity-90
                disabled:opacity-50
                disabled:cursor-not-allowed
                flex items-center justify-center gap-2
              "
              style={{ backgroundColor: '#e9931c' }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>LOGGING IN...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>LOGIN</span>
                </>
              )}
            </button>

          </form>
        </div>
      </div>

      {/* RIGHT SIDE - IMAGE */}
      <div
        className="
          hidden 
          md:flex 
          w-full 
          lg:w-1/2 
          items-center 
          justify-center 
          p-6 
          bg-white
        "
      >
        <img
          src={crmImage}
          alt="CRM Illustration"
          className="max-w-full max-h-[500px] object-contain"
        />
      </div>

    </div>
  )
}

export default LoginPage
