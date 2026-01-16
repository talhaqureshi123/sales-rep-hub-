import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

const SetupPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [userInfo, setUserInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [step, setStep] = useState('otp') // 'otp' or 'password'
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
      verifyToken(tokenParam)
    } else {
      setVerifying(false)
      setErrors({ token: 'No token provided' })
    }
  }, [searchParams])

  const verifyToken = async (tokenValue) => {
    try {
      const response = await fetch(`/api/auth/verify-setup-token/${tokenValue}`)
      const data = await response.json()

      if (data.success) {
        setUserInfo(data.data)
        // OTP is automatically sent when token is verified
        if (data.data.otp && process.env.NODE_ENV === 'development') {
          console.log('✅ OTP (Development only):', data.data.otp)
          console.log('📧 OTP also sent to email:', data.data.email)
        }
        // Set step to OTP verification
        setStep('otp')
      } else {
        setErrors({ token: data.message || 'Invalid or expired token' })
      }
    } catch (error) {
      console.error('Error verifying token:', error)
      setErrors({ token: 'Error verifying token' })
    } finally {
      setVerifying(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    // OTP must be verified before setting password
    if (!otpVerified) {
      newErrors.submit = 'Please verify OTP first'
      setErrors(newErrors)
      return false
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle OTP verification
  const handleVerifyOTP = async (e) => {
    e.preventDefault()

    if (!otp || otp.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit OTP' })
      return
    }

    setVerifyingOtp(true)
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          otp,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOtpVerified(true)
        setStep('password')
        setErrors({})
        // Store verified OTP for password setup
        console.log('✅ OTP verified successfully')
      } else {
        setErrors({ otp: data.message || 'Invalid OTP' })
        setOtp('') // Clear OTP on error
      }
    } catch (error) {
      console.error('Error verifying OTP:', error)
      setErrors({ otp: 'Network error. Please try again.' })
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Handle resend OTP
  const handleResendOTP = async () => {
    setSendingOtp(true)
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.success) {
        alert('OTP resent successfully! Please check your email.')
        if (data.data.otp && process.env.NODE_ENV === 'development') {
          console.log('New OTP (Development only):', data.data.otp)
        }
        setOtp('')
        setErrors({})
      } else {
        alert(data.message || 'Failed to resend OTP')
      }
    } catch (error) {
      console.error('Error resending OTP:', error)
      alert('Network error. Please try again.')
    } finally {
      setSendingOtp(false)
    }
  }

  // Handle password setup
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          otp, // Include OTP for verification
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Password set successfully! You can now login.')
        // Redirect to login page
        navigate('/')
      } else {
        setErrors({ submit: data.message || 'Failed to set password' })
      }
    } catch (error) {
      console.error('Error setting password:', error)
      setErrors({ submit: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e9931c] mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying token...</p>
          </div>
        </div>
      </div>
    )
  }

  if (errors.token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid Token</h2>
            <p className="text-gray-600 mb-6">{errors.token}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // OTP Verification Step
  if (step === 'otp' && userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl p-4 sm:p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#e9931c] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Verify Your Email</h2>
              {userInfo && (
                <p className="mt-2 text-sm sm:text-base text-gray-600 break-words px-2">
                  OTP sent to <span className="font-semibold">{userInfo.email}</span>
                </p>
              )}
              <p className="mt-2 text-xs sm:text-sm text-gray-500 px-2">
                Please enter the 6-digit OTP sent to your email
              </p>
              {process.env.NODE_ENV === 'development' && userInfo && (
                <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 sm:p-3 mx-2">
                  <p className="text-xs text-yellow-800">
                    <strong>Development Mode:</strong> Check browser console for OTP
                  </p>
                </div>
              )}
            </div>

            {/* OTP Form */}
            <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-6">
              {/* OTP Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Enter OTP *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtp(value)
                      if (errors.otp) {
                        setErrors({ ...errors, otp: '' })
                      }
                    }}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 rounded-lg focus:outline-none transition-all text-center text-xl sm:text-2xl font-bold tracking-widest ${
                      errors.otp
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-200 focus:border-[#e9931c]'
                    }`}
                    placeholder="000000"
                    maxLength={6}
                    required
                    disabled={verifyingOtp}
                  />
                </div>
                {errors.otp && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.otp}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Enter the 6-digit code from your email</p>
              </div>

              {/* Resend OTP */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={sendingOtp}
                  className="text-xs sm:text-sm text-[#e9931c] hover:text-[#d8820a] font-medium disabled:opacity-50"
                >
                  {sendingOtp ? 'Sending...' : "Didn't receive OTP? Resend"}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={verifyingOtp || otp.length !== 6}
                className={`w-full py-2.5 sm:py-3 px-4 rounded-lg text-sm sm:text-base font-semibold text-white transition-all ${
                  verifyingOtp || otp.length !== 6
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#e9931c] hover:bg-[#d8820a] hover:shadow-lg active:scale-95'
                }`}
              >
                {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Password Setup Step
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="bg-white rounded-lg sm:rounded-xl shadow-xl p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Set Your Password</h2>
            {userInfo && (
              <p className="mt-2 text-sm sm:text-base text-gray-600">
                Welcome, <span className="font-semibold">{userInfo.name}</span>
              </p>
            )}
            {otpVerified && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 mx-2">
                <p className="text-xs sm:text-sm text-green-700">✓ Email verified successfully</p>
              </div>
            )}
            <p className="mt-2 text-xs sm:text-sm text-gray-500 px-2">
              Please create a secure password and complete your profile
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                    errors.password
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#e9931c]'
                  }`}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-lg focus:outline-none transition-all ${
                    errors.confirmPassword
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-[#e9931c]'
                  }`}
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Phone Field - Optional */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all"
                  placeholder="Enter your phone number"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Address Field - Optional */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Address (Optional)
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all resize-none"
                placeholder="Enter your address"
                disabled={loading}
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                <p className="text-xs sm:text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 sm:py-3 px-4 rounded-lg text-sm sm:text-base font-semibold text-white transition-all active:scale-95 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#e9931c] hover:bg-[#d8820a] hover:shadow-lg'
              }`}
            >
              {loading ? 'Setting Password...' : 'Set Password'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs sm:text-sm text-gray-500">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-[#e9931c] hover:text-[#d8820a] font-medium"
              >
                Login here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SetupPassword

