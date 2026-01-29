import { useEffect, useState, useRef } from 'react'

const NotificationToast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => {
          if (onClose) onClose()
        }, 200)
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

  // One-time slide-in only on mount; no animation on re-renders so toast stays stable (no blink)
  const animationStyle = hasAnimatedRef.current ? {} : { animation: 'notificationSlideIn 0.25s ease-out forwards' }
  if (!hasAnimatedRef.current) hasAnimatedRef.current = true

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md ${getTypeStyles()}`}
      style={{
        zIndex: 9999,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        willChange: 'auto',
        ...animationStyle,
      }}
    >
      <style>{`
        @keyframes notificationSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <span className="text-xl font-bold flex-shrink-0">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium break-words">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(() => { if (onClose) onClose() }, 200)
        }}
        className="text-white hover:text-gray-200 transition-colors flex-shrink-0 ml-2"
        aria-label="Close notification"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default NotificationToast

