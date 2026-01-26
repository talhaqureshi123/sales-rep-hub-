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
      className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      } ${getTypeStyles()}`}
      style={{ 
        zIndex: 9999,
        pointerEvents: 'auto',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <span className="text-xl font-bold flex-shrink-0">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium break-words">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => {
            if (onClose) onClose()
          }, 300)
        }}
        className="text-white hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
        aria-label="Close notification"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default NotificationToast

