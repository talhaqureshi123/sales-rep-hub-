import { useEffect, useState } from 'react'

const NotificationToast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => {
          if (onClose) onClose()
        }, 300) // Wait for fade out animation
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white'
      case 'warning':
        return 'bg-yellow-500 text-white'
      case 'error':
        return 'bg-red-500 text-white'
      default:
        return 'bg-blue-500 text-white'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'warning':
        return '⚠'
      case 'error':
        return '✕'
      default:
        return 'ℹ'
    }
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      } ${getTypeStyles()}`}
    >
      <span className="text-xl font-bold">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => {
            if (onClose) onClose()
          }, 300)
        }}
        className="text-white hover:text-gray-200 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default NotificationToast

