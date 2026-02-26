import { useEffect, useState, useRef } from 'react'

const SLIDE_IN_DURATION = 250
const SLIDE_OUT_DURATION = 220

const NotificationToast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  const [phase, setPhase] = useState('visible') // 'visible' | 'exiting'
  const hasAnimatedInRef = useRef(false)
  const closeTimeoutRef = useRef(null)

  // Auto-dismiss after duration (real-time pop then leave)
  useEffect(() => {
    if (duration <= 0 || phase !== 'visible') return
    const t = setTimeout(() => {
      setPhase('exiting')
    }, duration)
    return () => clearTimeout(t)
  }, [duration, phase])

  // After slide-out animation, remove from list (mobile/tablet friendly)
  useEffect(() => {
    if (phase !== 'exiting') return
    closeTimeoutRef.current = setTimeout(() => {
      if (onClose) onClose()
    }, SLIDE_OUT_DURATION)
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [phase, onClose])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

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

  const isExiting = phase === 'exiting'
  const animationName = isExiting ? 'notificationSlideOut' : (hasAnimatedInRef.current ? 'none' : 'notificationSlideIn')
  const animationDuration = isExiting ? SLIDE_OUT_DURATION / 1000 : SLIDE_IN_DURATION / 1000
  if (!hasAnimatedInRef.current && !isExiting) hasAnimatedInRef.current = true

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-md ${getTypeStyles()}`}
      style={{
        zIndex: 9999,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        animation: animationName !== 'none' ? `${animationName} ${animationDuration}s ease-out forwards` : undefined,
      }}
    >
      <style>{`
        @keyframes notificationSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes notificationSlideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
      <span className="text-xl font-bold flex-shrink-0">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium break-words">{message}</p>
      <button
        type="button"
        onClick={() => {
          if (phase === 'exiting') return
          setPhase('exiting')
        }}
        className="text-white hover:text-gray-200 active:opacity-80 transition-colors flex-shrink-0 ml-2 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center -my-1 -mr-1"
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

