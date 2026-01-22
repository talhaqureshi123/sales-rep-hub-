import { useState, useEffect, useRef } from 'react'
import GoogleMapView from './GoogleMapView'
// import MilestoneModal from './MilestoneModal' // COMMENTED OUT - Using Visit Targets only
import NotificationToast from './NotificationToast'
// import { getMilestones, checkProximity, markMilestoneComplete } from '../services/salemanservices/milestoneService' // COMMENTED OUT - Using Visit Targets only
import { getVisitTargets, updateVisitTargetStatus, createVisitRequest, getVisitRequests } from '../services/salemanservices/visitTargetService'
import { getCurrentLocation, watchPosition, clearWatch, formatDistance, calculateDistance, PROXIMITY_DISTANCE_KM, saveLocation } from '../services/salemanservices/locationService'
import { startTracking, stopTracking, getActiveTracking } from '../services/salemanservices/trackingService'
import { getMyFollowUps } from '../services/salemanservices/followUpService'
import { getMyCustomers } from '../services/salemanservices/customerService'
import { createWorker } from 'tesseract.js'
import { FaPlay, FaStop, FaPause, FaMapMarkerAlt, FaClock, FaCheckCircle, FaCalendarAlt, FaExclamationTriangle, FaArrowRight, FaTimes, FaTasks, FaFlask } from 'react-icons/fa'
import Swal from 'sweetalert2'

const SalesTracking = () => {
  // const [milestones, setMilestones] = useState([]) // COMMENTED OUT - Using Visit Targets only
  const [visitTargets, setVisitTargets] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  // const [selectedMilestone, setSelectedMilestone] = useState(null) // COMMENTED OUT
  // const [showMilestoneModal, setShowMilestoneModal] = useState(false) // COMMENTED OUT
  const [notifications, setNotifications] = useState([])
  const [selectedVisitTarget, setSelectedVisitTarget] = useState(null)
  const [showRightPanel, setShowRightPanel] = useState(true) // Control right panel visibility
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [showVisitTargetModal, setShowVisitTargetModal] = useState(false)
  const [meterReading, setMeterReading] = useState('')
  const [capturedImage, setCapturedImage] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [visitedAreaImage, setVisitedAreaImage] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [startingKilometers, setStartingKilometers] = useState('')
  const [endingKilometers, setEndingKilometers] = useState('')
  const [endingMeterImage, setEndingMeterImage] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [isExtractingEnding, setIsExtractingEnding] = useState(false)
  const [estimatedKilometers, setEstimatedKilometers] = useState('')
  const [routeDistanceKm, setRouteDistanceKm] = useState(null) // Route distance from Google Maps
  const [countdown, setCountdown] = useState(null)
  const [showCountdown, setShowCountdown] = useState(false)
  // const [routeToMilestone, setRouteToMilestone] = useState(null) // COMMENTED OUT - Using Visit Targets only
  const [routeToVisitTarget, setRouteToVisitTarget] = useState(null)
  const [targetComments, setTargetComments] = useState('')
  const [activeTrackingId, setActiveTrackingId] = useState(null)
  const [visitRequests, setVisitRequests] = useState([])
  const [showRequestVisitModal, setShowRequestVisitModal] = useState(false)
  const [requestForm, setRequestForm] = useState({
    customerId: '',
    customerName: '',
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    priority: 'Medium',
    visitDate: '',
    latitude: '',
    longitude: '',
    notes: '',
  })
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showVisitAssignmentModal, setShowVisitAssignmentModal] = useState(false)
  const [selectedVisitsForAssignment, setSelectedVisitsForAssignment] = useState([])
  const [assignmentDate, setAssignmentDate] = useState('')
  const [assigningVisits, setAssigningVisits] = useState(false)
  const [dateFilter, setDateFilter] = useState('All') // All, Today, Tomorrow, This Week, Upcoming, Past
  const [selectedDateForView, setSelectedDateForView] = useState('') // Date selected for viewing filtered visits
  const [assignModalActiveTab, setAssignModalActiveTab] = useState('visits') // visits, followup, sample
  const [followUps, setFollowUps] = useState([])
  const [samples, setSamples] = useState([])
  const [selectedFollowUpsForAssignment, setSelectedFollowUpsForAssignment] = useState([])
  const [selectedSamplesForAssignment, setSelectedSamplesForAssignment] = useState([])
  const watchIdRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const lastLocationSentRef = useRef(null)
  const locationUpdateIntervalRef = useRef(null)

  // Get current user email (salesman)
  const getCurrentUserEmail = () => {
    return localStorage.getItem('userEmail') || 'salesman@example.com'
  }

  // Calculate distance to visit target
  const getDistanceToVisitTarget = (target) => {
    if (!userLocation) return null
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      target.latitude,
      target.longitude
    )
    return formatDistance(distance)
  }

  // Group visits by date
  const groupVisitsByDate = (targets) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const grouped = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      upcoming: [],
      past: [],
      noDate: []
    }

    targets.forEach(target => {
      if (!target.visitDate) {
        grouped.noDate.push(target)
        return
      }

      const visitDate = new Date(target.visitDate)
      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())

      if (visitDateOnly.getTime() === today.getTime()) {
        grouped.today.push(target)
      } else if (visitDateOnly.getTime() === tomorrow.getTime()) {
        grouped.tomorrow.push(target)
      } else if (visitDateOnly < today) {
        grouped.past.push(target)
      } else if (visitDateOnly <= nextWeek) {
        grouped.thisWeek.push(target)
      } else {
        grouped.upcoming.push(target)
      }
    })

    return grouped
  }

  // Filter visits based on date filter
  const getFilteredVisits = () => {
    if (dateFilter === 'All') {
      return visitTargets
    }

    const grouped = groupVisitsByDate(visitTargets)
    switch (dateFilter) {
      case 'Today':
        return grouped.today
      case 'Tomorrow':
        return grouped.tomorrow
      case 'This Week':
        return [...grouped.today, ...grouped.tomorrow, ...grouped.thisWeek]
      case 'Upcoming':
        return grouped.upcoming
      case 'Past':
        return grouped.past
      default:
        return visitTargets
    }
  }

  // Load tasks (follow-ups) - load all statuses except completed
  const loadFollowUps = async () => {
    try {
      console.log('Loading tasks (follow-ups)...')
      // Load all tasks (not just pending) so user can see all tasks
      const result = await getMyFollowUps({})
      console.log('Tasks API result:', result)
      if (result.success && result.data) {
        // Filter out completed tasks for assignment view
        const activeTasks = result.data.filter(t => t.status !== 'Completed')
        console.log('Active tasks (non-completed):', activeTasks.length)
        setFollowUps(activeTasks)
      } else {
        console.warn('No tasks found or API error:', result.message)
        setFollowUps([])
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
      setFollowUps([])
    }
  }

  // Load samples using salesman service
  const loadSamples = async () => {
    try {
      const { getMySamples } = await import('../services/salemanservices/sampleService')
      const result = await getMySamples({})
      if (result.success && result.data) {
        // Filter out converted samples for assignment view
        const activeSamples = result.data.filter(s => s.status !== 'Converted')
        setSamples(activeSamples)
      } else {
        setSamples([])
      }
    } catch (error) {
      console.error('Error loading samples:', error)
      setSamples([])
    }
  }

  // Load visit targets on component mount (Milestones commented out)
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          console.log('No token found. Please login to view data.')
          setVisitTargets([])
          return
        }
        
        // Load visit targets (approved only by backend default)
        const visitTargetsResult = await getVisitTargets()
        if (visitTargetsResult.success && visitTargetsResult.data) {
          // Filter out only targets without valid coordinates (show all statuses including completed)
          const validTargets = visitTargetsResult.data.filter(target => {
            const lat = parseFloat(target.latitude)
            const lng = parseFloat(target.longitude)
            const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
              lat >= -90 && lat <= 90 && 
              lng >= -180 && lng <= 180
            return hasValidCoords
          })
          setVisitTargets(validTargets)
        } else {
          console.warn('Failed to load visit targets:', visitTargetsResult.message || 'Unknown error')
          setVisitTargets([])
        }

        // Load my requests (pending/rejected) for visibility
        const reqs = await getVisitRequests()
        if (reqs?.success && Array.isArray(reqs.data)) {
          setVisitRequests(reqs.data)
        } else {
          setVisitRequests([])
        }
      } catch (error) {
        console.error('Error loading data:', error)
        setVisitTargets([])
        setVisitRequests([])
      }
    }
    loadData()
  }, [])

  // Check for missed visits when visitTargets change
  useEffect(() => {
    if (visitTargets.length > 0) {
      // Use a timeout to avoid checking too frequently
      const timeoutId = setTimeout(() => {
        checkMissedVisits()
      }, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [visitTargets])

  const refreshRequestsAndTargets = async () => {
    try {
      // Load all visit targets (including completed) - admin assigned and approved requests
      const visitTargetsResult = await getVisitTargets()
      if (visitTargetsResult.success && visitTargetsResult.data) {
        // Filter only by valid coordinates (show all statuses including completed)
        const validTargets = visitTargetsResult.data.filter(target => {
          const lat = parseFloat(target.latitude)
          const lng = parseFloat(target.longitude)
          const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180
          return hasValidCoords
        })
        setVisitTargets(validTargets)
      }

      // Load salesman's own visit requests (pending/rejected)
      const reqs = await getVisitRequests()
      if (reqs?.success && Array.isArray(reqs.data)) {
        setVisitRequests(reqs.data)
      } else {
        setVisitRequests([])
      }
    } catch (e) {
      console.error('refreshRequestsAndTargets error:', e)
    }
  }

  // Load customers for visit request
  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const result = await getMyCustomers({})
      if (result.success && result.data) {
        setCustomers(result.data)
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Handle customer selection - auto-fill form
  const handleCustomerSelect = (customerId) => {
    const selectedCustomer = customers.find(c => c._id === customerId)
    if (selectedCustomer) {
      // Build customer name from available fields
      const customerName = selectedCustomer.name || 
                          selectedCustomer.company || 
                          (selectedCustomer.firstName ? `${selectedCustomer.firstName}${selectedCustomer.contactPerson ? ` ${selectedCustomer.contactPerson}` : ''}` : '') ||
                          selectedCustomer.email ||
                          'Customer'
      
      setRequestForm(prev => ({
        ...prev,
        customerId: selectedCustomer._id,
        customerName: customerName,
        name: customerName, // Visit name will be customer name
        address: selectedCustomer.address || prev.address,
        city: selectedCustomer.city || prev.city,
        state: selectedCustomer.state || prev.state,
        pincode: selectedCustomer.pincode || selectedCustomer.postcode || prev.pincode,
        // Keep existing latitude/longitude or use GPS if available
        latitude: prev.latitude || (userLocation ? String(userLocation.latitude) : ''),
        longitude: prev.longitude || (userLocation ? String(userLocation.longitude) : ''),
      }))
    }
  }

  const handleSubmitVisitRequest = async () => {
    try {
      if (!requestForm.customerId || !requestForm.customerName) {
        await Swal.fire({
          icon: 'warning',
          title: 'Missing Information',
          text: 'Please select a customer',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      const lat = requestForm.latitude ? Number(requestForm.latitude) : Number(userLocation?.latitude)
      const lng = requestForm.longitude ? Number(requestForm.longitude) : Number(userLocation?.longitude)
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        await Swal.fire({
          icon: 'warning',
          title: 'Location Required',
          text: 'Please provide valid latitude/longitude or allow GPS access',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      setRequestSubmitting(true)
      const payload = {
        name: requestForm.name,
        description: requestForm.description || '',
        address: requestForm.address || '',
        city: requestForm.city || '',
        state: requestForm.state || '',
        pincode: requestForm.pincode || '',
        priority: requestForm.priority || 'Medium',
        visitDate: requestForm.visitDate || undefined,
        notes: requestForm.notes || '',
        latitude: lat,
        longitude: lng,
      }

      const result = await createVisitRequest(payload)
      if (result?.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Request Submitted!',
          text: result.message || 'Your visit request has been submitted. Admin will review and approve it.',
          confirmButtonColor: '#e9931c'
        })
        setShowRequestVisitModal(false)
        setRequestForm({
          customerId: '',
          customerName: '',
          name: '',
          description: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          priority: 'Medium',
          visitDate: '',
          latitude: '',
          longitude: '',
          notes: '',
        })
        await refreshRequestsAndTargets()
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: result?.message || 'Failed to submit visit request. Please try again.',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error('handleSubmitVisitRequest error:', e)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error submitting visit request. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setRequestSubmitting(false)
    }
  }

  // Handle visit assignment
  const handleAssignVisits = async (date) => {
    if (selectedVisitsForAssignment.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Visits Selected',
        text: 'Please select at least one visit to assign',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    if (!date) {
      await Swal.fire({
        icon: 'warning',
        title: 'Date Required',
        text: 'Please select a date',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    setAssigningVisits(true)
    try {
      const updatePromises = selectedVisitsForAssignment.map(visitId => 
        updateVisitTargetStatus(visitId, { visitDate: new Date(date).toISOString() })
      )

      const results = await Promise.all(updatePromises)
      const successCount = results.filter(r => r.success).length

      if (successCount === selectedVisitsForAssignment.length) {
        await Swal.fire({
          icon: 'success',
          title: 'Visits Assigned!',
          text: `Successfully assigned ${successCount} visit(s) to ${new Date(date).toLocaleDateString()}`,
          confirmButtonColor: '#e9931c'
        })
        setShowVisitAssignmentModal(false)
        setSelectedVisitsForAssignment([])
        setAssignmentDate('')
        
        // Reload visit targets
        const visitTargetsResult = await getVisitTargets()
        if (visitTargetsResult.success && visitTargetsResult.data) {
          const validTargets = visitTargetsResult.data.filter(target => {
            const lat = parseFloat(target.latitude)
            const lng = parseFloat(target.longitude)
            const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
              lat >= -90 && lat <= 90 && 
              lng >= -180 && lng <= 180
            return hasValidCoords
          })
          setVisitTargets(validTargets)
        }
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'Partial Success',
          text: `Failed to assign some visits. ${successCount} out of ${selectedVisitsForAssignment.length} assigned.`,
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error assigning visits:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error assigning visits. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setAssigningVisits(false)
    }
  }

  // Get user location on mount
  useEffect(() => {
    getCurrentLocation()
      .then((location) => {
        setUserLocation(location)
      })
      .catch((error) => {
        console.error('Error getting location:', error)
        // Don't show alert, just log - page should still work
        // Set a default location if geolocation fails (Delhi)
        setUserLocation({
          latitude: 28.6139,
          longitude: 77.2090,
        })
      })
  }, [])

  // Load active tracking session on mount
  useEffect(() => {
    const loadActiveTracking = async () => {
      try {
        const active = await getActiveTracking()
        if (active && (active._id || active.id)) {
          setActiveTrackingId(active._id || active.id)
        }
      } catch (error) {
        console.error('Error loading active tracking:', error)
      }
    }
    loadActiveTracking()
  }, [])

  // Auto-select nearest pending target when both location and targets are available
  // BUT only show route when tracking is started
  useEffect(() => {
    if (userLocation && visitTargets.length > 0 && !selectedVisitTarget) {
      const pendingTargets = visitTargets.filter(t => t.status === 'Pending' || t.status === 'In Progress')
      if (pendingTargets.length > 0) {
        const nearestTarget = pendingTargets.reduce((nearest, target) => {
          const nearestDist = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            parseFloat(nearest.latitude),
            parseFloat(nearest.longitude)
          )
          const targetDist = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            parseFloat(target.latitude),
            parseFloat(target.longitude)
          )
          return targetDist < nearestDist ? target : nearest
        })
        setSelectedVisitTarget(nearestTarget)
        // Only show route if tracking is started
        if (isTracking) {
          setRouteToVisitTarget({
            from: { lat: userLocation.latitude, lng: userLocation.longitude },
            to: { lat: parseFloat(nearestTarget.latitude), lng: parseFloat(nearestTarget.longitude) },
            target: nearestTarget
          })
        } else {
          // Clear route if not tracking
          setRouteToVisitTarget(null)
        }
      }
    }
  }, [userLocation, visitTargets, isTracking])

  // Watch position for real-time tracking and send location updates
  useEffect(() => {
    if (isTracking) {
      watchIdRef.current = watchPosition(
        (position) => {
          setUserLocation(position)
          checkVisitTargetProximity(position)
          
          // Send location to backend (only if logged in)
          const token = localStorage.getItem('token')
          if (token && position.latitude && position.longitude) {
            // Check if we should send location update (every 30 seconds or if location changed significantly)
            const now = Date.now()
            const lastSent = lastLocationSentRef.current
            const shouldSend = !lastSent || (now - lastSent) >= 30000 // 30 seconds
            
            if (shouldSend) {
              saveLocation(position.latitude, position.longitude, position.accuracy || null)
                .then((result) => {
                  if (result.success) {
                    lastLocationSentRef.current = now
                    console.log('Location sent to backend successfully')
                  } else {
                    console.warn('Failed to send location:', result.message)
                  }
                })
                .catch((error) => {
                  console.error('Error sending location:', error)
                })
            }
          }
        },
        (error) => {
          console.error('Error watching position:', error)
        }
      )
      
      // Also set up periodic location updates (every 30 seconds) as backup
      locationUpdateIntervalRef.current = setInterval(() => {
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          const token = localStorage.getItem('token')
          if (token) {
            saveLocation(userLocation.latitude, userLocation.longitude, userLocation.accuracy || null)
              .then((result) => {
                if (result.success) {
                  lastLocationSentRef.current = Date.now()
                  console.log('Periodic location update sent')
                }
              })
              .catch((error) => {
                console.error('Error sending periodic location:', error)
              })
          }
        }
      }, 30000) // Every 30 seconds
    } else {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
        locationUpdateIntervalRef.current = null
      }
      lastLocationSentRef.current = null
    }

    return () => {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
      }
    }
  }, [isTracking, visitTargets, userLocation])

  // Check for missed/remaining visits and show notifications
  const checkMissedVisits = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const notifiedTargets = new Set(notifications.map(n => `${n.targetId}-${n.type}`))
    
    visitTargets.forEach((target) => {
      if (target.status === 'Completed') return
      
      if (target.visitDate) {
        const visitDate = new Date(target.visitDate)
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
        const targetId = target._id || target.id
        const notificationKey = `${targetId}-warning`
        const todayNotificationKey = `${targetId}-info`
        
        // Check if visit date has passed and visit is not completed
        if (visitDateOnly < today) {
          const daysPassed = Math.floor((today - visitDateOnly) / (1000 * 60 * 60 * 24))
          
          if (!notifiedTargets.has(notificationKey)) {
            addNotification({
              message: `⚠️ Missed Visit: ${target.name} (${daysPassed} day${daysPassed > 1 ? 's' : ''} ago)`,
              type: 'warning',
              targetId: targetId,
            })
          }
        }
        // Check if visit is today and not completed
        else if (visitDateOnly.getTime() === today.getTime()) {
          if (!notifiedTargets.has(todayNotificationKey)) {
            addNotification({
              message: `📅 Today's Visit: ${target.name} - Please complete it`,
              type: 'info',
              targetId: targetId,
            })
          }
        }
      }
    })
  }

  // Check proximity to visit targets and show notifications (Real-time detection)
  const checkVisitTargetProximity = (currentLocation) => {
    if (!currentLocation || visitTargets.length === 0) return

    // Check each visit target
    visitTargets.forEach((target) => {
      // Only check pending targets
      if (target.status !== 'Pending' && target.status !== 'In Progress') return

      if (!target.latitude || !target.longitude) return

      // Calculate distance to target
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        parseFloat(target.latitude),
        parseFloat(target.longitude)
      )

      // Check if within 100 meters (0.1 km) - proximity threshold
      const PROXIMITY_THRESHOLD_KM = 0.1 // 100 meters
      const isWithinProximity = distance <= PROXIMITY_THRESHOLD_KM

      if (isWithinProximity) {
        // Check if notification already shown for this target
        const alreadyNotified = notifications.some(
          (n) => n.targetId === target._id || n.targetId === target.id
        )

        if (!alreadyNotified) {
          const distanceFormatted = formatDistance(distance)
          // Show SweetAlert
          Swal.fire({
            icon: 'success',
            title: '🎯 Visit Target Reached!',
            html: `<p><strong>Target:</strong> ${target.name}</p><p><strong>Distance:</strong> ${distanceFormatted}</p>`,
            confirmButtonColor: '#e9931c',
            timer: 3000,
            timerProgressBar: true
          })
          
          // Add notification
          addNotification({
            message: `🎯 Visit Target Reached: ${target.name} (${distanceFormatted} away)`,
            type: 'success',
            targetId: target._id || target.id,
          })
        }
      }
    })
  }

  const addNotification = (notification) => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { ...notification, id }])
  }

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  // Handle visit target click
  const handleVisitTargetClick = (target) => {
    setSelectedVisitTarget(target)
    setShowVisitTargetModal(true) // Open modal when target is clicked
  }

  // Handle mark as completed - with meter reading
  const handleMarkAsCompleted = async () => {
    if (!selectedVisitTarget) return

    // Show completion modal to get meter reading
    setShowCompletionModal(true)
  }

  // Handle complete target with meter reading
  const handleCompleteTarget = async () => {
    if (!selectedVisitTarget) return

    try {
      // Validate ending kilometers
      if (!endingKilometers || endingKilometers.trim() === '') {
        alert('Please enter ending kilometers or upload meter image')
        return
      }

      // Validate visited area image is required
      if (!visitedAreaImage) {
        alert('Please upload visited area picture. It is required to complete tracking.')
        return
      }

      // Validate ending meter image
      if (!endingMeterImage) {
        alert('Please capture ending meter image.')
        return
      }

      const start = parseFloat(startingKilometers || selectedVisitTarget.startingKilometers || 0)
      const end = parseFloat(endingKilometers)
      
      if (isNaN(end) || end <= 0) {
        alert('Invalid ending kilometers. Please enter a valid number.')
        return
      }

      if (start > 0 && end < start) {
        alert('Ending kilometers cannot be less than starting kilometers')
        return
      }

      // Calculate actual kilometers - ensure correct calculation
      let actualKm = '0'
      if (start > 0 && end > 0 && end >= start) {
        actualKm = (end - start).toFixed(2)
      } else if (routeDistanceKm) {
        actualKm = parseFloat(routeDistanceKm).toFixed(2)
      } else if (estimatedKilometers) {
        actualKm = parseFloat(estimatedKilometers).toFixed(2)
      }

      const actualKmValue = parseFloat(actualKm)
      const estimatedKmValue = estimatedKilometers
        ? parseFloat(estimatedKilometers)
        : routeDistanceKm
        ? parseFloat(routeDistanceKm)
        : actualKmValue

      if (!estimatedKmValue || Number.isNaN(estimatedKmValue) || estimatedKmValue <= 0) {
        alert('Unable to determine estimated kilometers. Please enter ending kilometers again.')
        return
      }

      // Update visit target with completion data
      const updateData = {
        status: 'Completed',
        endingKilometers: end,
        estimatedKilometers: estimatedKmValue,
        meterImage: endingMeterImage || null,
        visitedAreaImage: visitedAreaImage || null,
        comments: targetComments || selectedVisitTarget.comments || '',
      }

      if (startingKilometers) {
        updateData.startingKilometers = parseFloat(startingKilometers)
      }

      const result = await updateVisitTargetStatus(selectedVisitTarget._id || selectedVisitTarget.id, updateData)

      if (result.success) {
        // Update local state
        setVisitTargets(prev => prev.map(target => 
          target._id === selectedVisitTarget._id || target.id === selectedVisitTarget.id
            ? { ...target, status: 'Completed', completedAt: new Date(), ...updateData }
            : target
        ))
        setSelectedVisitTarget({ ...selectedVisitTarget, status: 'Completed', completedAt: new Date(), ...updateData })
        
        // Close modals
        setShowCompletionModal(false)
        setShowVisitTargetModal(false)
        
        // Show achievement modal with congratulations
        setShowAchievementModal(true)
        addNotification({
          message: `🎉 Visit Target Completed: ${selectedVisitTarget.name} | Distance: ${actualKm} km`,
          type: 'success',
        })

        // Clear form data
        setEndingKilometers('')
        setEndingMeterImage(null)
        setEstimatedKilometers('')
        setTargetComments('')
      } else {
        alert(result.message || 'Error marking target as completed')
      }
    } catch (error) {
      console.error('Error marking target as completed:', error)
      alert('Error marking target as completed')
    }
  }

  // Handle create quotation - navigate to quotation tab and open modal
  const handleCreateQuotation = () => {
    // Store visit target info in localStorage for quotation
    if (selectedVisitTarget) {
      const visitTargetData = {
        id: selectedVisitTarget._id || selectedVisitTarget.id,
        _id: selectedVisitTarget._id || selectedVisitTarget.id,
        name: selectedVisitTarget.name,
        address: selectedVisitTarget.address,
        city: selectedVisitTarget.city,
        state: selectedVisitTarget.state,
        pincode: selectedVisitTarget.pincode,
      }
      
      localStorage.setItem('quotationVisitTarget', JSON.stringify(visitTargetData))
      localStorage.setItem('openQuotationModal', 'true')
      
      // Dispatch event to open quotation modal
      const event = new CustomEvent('openQuotationModal', { 
        detail: { visitTarget: visitTargetData } 
      })
      window.dispatchEvent(event)
    }
    
    // Close visit target modal first
    setShowVisitTargetModal(false)
    
    // Navigate to quotation tab
    if (window.handleNavigateToQuotation) {
      window.handleNavigateToQuotation()
    } else {
      // Fallback: try to find parent dashboard and switch tab
      const navEvent = new CustomEvent('navigateToTab', { detail: 'quotation' })
      window.dispatchEvent(navEvent)
    }
  }

  // COMMENTED OUT - Milestone related functions
  // const handleMilestoneClick = (milestone) => {
  //   setSelectedMilestone(milestone)
  //   setShowMilestoneModal(true)
  // }

  // const handleAchievement = async (milestone) => {
  //   // ... milestone completion logic
  // }

  // const handleQuotation = (milestone) => {
  //   // ... quotation logic
  // }

  // const handleConversion = (milestone) => {
  //   // ... conversion tracking
  // }

  const handleMeterReadingChange = (e) => {
    setMeterReading(e.target.value)
  }

  const handleCaptureImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setCapturedImage(event.target.result)
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  // Handle image upload for starting kilometers
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageDataUrl = event.target.result
      setUploadedImage(imageDataUrl)
      setIsExtracting(true)

      try {
        // Initialize Tesseract worker
        const worker = await createWorker('eng')
        
        // Perform OCR on the image
        const { data: { text } } = await worker.recognize(imageDataUrl)
        
        // Extract numbers from the text (kilometers)
        const numbers = text.match(/\d+/g)
        if (numbers && numbers.length > 0) {
          // Get the largest number (likely the odometer reading)
          const largestNumber = numbers.reduce((a, b) => {
            const numA = parseInt(a)
            const numB = parseInt(b)
            return numA > numB ? a : b
          })
          setStartingKilometers(largestNumber)
        } else {
          setStartingKilometers('')
          alert('Could not extract kilometers from image. Please enter manually.')
        }
        
        await worker.terminate()
      } catch (error) {
        console.error('OCR Error:', error)
        alert('Error extracting kilometers. Please enter manually.')
        setStartingKilometers('')
      } finally {
        setIsExtracting(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle camera capture for starting speedometer
  const handleStartingSpeedometerCameraCapture = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageDataUrl = event.target.result
        setUploadedImage(imageDataUrl)
        setIsExtracting(true)

        try {
          // Initialize Tesseract worker
          const worker = await createWorker('eng')
          
          // Perform OCR on the image
          const { data: { text } } = await worker.recognize(imageDataUrl)
          
          // Extract numbers from the text (kilometers)
          const numbers = text.match(/\d+/g)
          if (numbers && numbers.length > 0) {
            // Get the largest number (likely the odometer reading)
            const largestNumber = numbers.reduce((a, b) => {
              const numA = parseInt(a)
              const numB = parseInt(b)
              return numA > numB ? a : b
            })
            setStartingKilometers(largestNumber)
          } else {
            setStartingKilometers('')
            alert('Could not extract kilometers from image. Please enter manually.')
          }
          
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          alert('Error extracting kilometers. Please enter manually.')
          setStartingKilometers('')
        } finally {
          setIsExtracting(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle visited area image upload
  const handleVisitedAreaImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageDataUrl = event.target.result
      setVisitedAreaImage(imageDataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Handle camera capture for visited area
  const handleVisitedAreaCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        const imageDataUrl = event.target.result
        setVisitedAreaImage(imageDataUrl)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle camera capture for ending meter
  const handleEndingMeterCameraCapture = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageDataUrl = event.target.result
        setEndingMeterImage(imageDataUrl)
        setIsExtractingEnding(true)

        try {
          // Initialize Tesseract worker
          const worker = await createWorker('eng')
          
          // Perform OCR on the image
          const { data: { text } } = await worker.recognize(imageDataUrl)
          
          // Extract numbers from the text (kilometers)
          const numbers = text.match(/\d+/g)
          if (numbers && numbers.length > 0) {
            // Get the largest number (likely the odometer reading)
            const largestNumber = numbers.reduce((a, b) => {
              const numA = parseInt(a)
              const numB = parseInt(b)
              return numA > numB ? a : b
            })
            setEndingKilometers(largestNumber)
            
            // Calculate distance traveled only if both values are valid
            if (startingKilometers && largestNumber) {
              const start = parseFloat(startingKilometers)
              const end = parseFloat(largestNumber)
              // Validate both are valid numbers and positive
              if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
                if (end >= start) {
                  const distance = end - start
                  setEstimatedKilometers(distance.toFixed(2))
                } else {
                  setEstimatedKilometers('')
                  alert('Ending kilometers cannot be less than starting kilometers')
                }
              } else {
                setEstimatedKilometers('')
              }
            }
          } else {
            setEndingKilometers('')
            alert('Could not extract kilometers from image. Please enter manually.')
          }
          
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          alert('Error extracting kilometers. Please enter manually.')
          setEndingKilometers('')
        } finally {
          setIsExtractingEnding(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle ending meter image upload
  const handleEndingMeterImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageDataUrl = event.target.result
      setEndingMeterImage(imageDataUrl)
      setIsExtractingEnding(true)

      try {
        // Initialize Tesseract worker
        const worker = await createWorker('eng')
        
        // Perform OCR on the image
        const { data: { text } } = await worker.recognize(imageDataUrl)
        
        // Extract numbers from the text (kilometers)
        const numbers = text.match(/\d+/g)
        if (numbers && numbers.length > 0) {
          // Get the largest number (likely the odometer reading)
          const largestNumber = numbers.reduce((a, b) => {
            const numA = parseInt(a)
            const numB = parseInt(b)
            return numA > numB ? a : b
          })
          setEndingKilometers(largestNumber)
          
          // Calculate distance traveled only if both values are valid
          if (startingKilometers && largestNumber) {
            const start = parseFloat(startingKilometers)
            const end = parseFloat(largestNumber)
            // Validate both are valid numbers and positive
            if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
              if (end >= start) {
                const distance = end - start
                setEstimatedKilometers(distance.toFixed(2))
              } else {
                setEstimatedKilometers('')
                alert('Ending kilometers cannot be less than starting kilometers')
              }
            } else {
              setEstimatedKilometers('')
            }
          }
        } else {
          setEndingKilometers('')
          alert('Could not extract kilometers from image. Please enter manually.')
        }
        
        await worker.terminate()
      } catch (error) {
        console.error('OCR Error:', error)
        alert('Error extracting kilometers. Please enter manually.')
        setEndingKilometers('')
      } finally {
        setIsExtractingEnding(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle ending kilometers manual input
  const handleEndingKilometersChange = (e) => {
    const value = e.target.value
    setEndingKilometers(value)
    
    // Calculate distance traveled only if both values are valid
    if (startingKilometers && value && value.trim() !== '') {
      const start = parseFloat(startingKilometers)
      const end = parseFloat(value)
      
      // Validate both are valid numbers
      if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
        if (end >= start) {
          const distance = end - start
          setEstimatedKilometers(distance.toFixed(2))
        } else {
          // Ending is less than starting - show warning but don't clear
          setEstimatedKilometers('')
        }
      } else {
        setEstimatedKilometers('')
      }
    } else {
      setEstimatedKilometers('')
    }
  }

  // Handle complete tracking
  const handleCompleteTracking = async () => {
    try {
      // Validate ending kilometers
      if (!endingKilometers || endingKilometers.trim() === '') {
        alert('Please enter ending kilometers or upload meter image')
        return
      }

      // Validate ending meter image
      if (!endingMeterImage) {
        alert('Please capture ending meter image.')
        return
      }

      // Validate visited area image is required
      if (!visitedAreaImage) {
        alert('Please upload visited area picture. It is required to complete tracking.')
        return
      }

      const start = parseFloat(startingKilometers)
      const end = parseFloat(endingKilometers)
      
      // Validate starting kilometers
      if (!startingKilometers || startingKilometers.trim() === '' || isNaN(start) || start <= 0) {
        alert('Invalid starting kilometers. Please check your starting reading.')
        return
      }
      
      // Validate ending kilometers
      if (isNaN(end) || end <= 0) {
        alert('Invalid ending kilometers. Please enter a valid number.')
        return
      }

      if (end < start) {
        alert('Ending kilometers cannot be less than starting kilometers')
        return
      }

      // Calculate distance - ensure correct calculation
      const distanceTraveled = end - start

      // Stop tracking in backend (if active session exists)
      let trackingId = activeTrackingId
      if (!trackingId) {
        try {
          const active = await getActiveTracking()
          trackingId = active?._id || active?.id || null
          if (trackingId) {
            setActiveTrackingId(trackingId)
          }
        } catch (error) {
          console.error('Error fetching active tracking:', error)
        }
      }

      if (trackingId) {
        try {
          const response = await stopTracking(
            trackingId,
            endingKilometers,
            endingMeterImage,
            visitedAreaImage,
            userLocation?.latitude || null,
            userLocation?.longitude || null
          )
          if (!response || !response.success) {
            console.warn('Stop tracking API call failed, continuing locally')
          }
          setActiveTrackingId(null)
        } catch (apiError) {
          console.error('Error stopping tracking:', apiError)
        }
      } else {
        console.warn('No active tracking ID found to stop')
      }

      // Stop tracking locally
      setIsTracking(false)
      setShowCompletionModal(false)
      
      // Clear form data
      setEndingKilometers('')
      setEndingMeterImage(null)
      setVisitedAreaImage(null)
      setEstimatedKilometers('')
      setRouteToVisitTarget(null)

      // Show success message
      addNotification({
        message: `✅ Tracking completed! Distance traveled: ${distanceTraveled.toFixed(2)} km`,
        type: 'success',
      })

      // TODO: Save completion data to backend if needed
    } catch (error) {
      console.error('Error completing tracking:', error)
      alert('Error completing tracking. Please try again.')
    }
  }

  // Handle start tracking with starting kilometers
  const handleStartTracking = async () => {
    try {
      // Validate inputs
      if (!startingKilometers || startingKilometers.trim() === '') {
        alert('Please enter starting kilometers')
        return
      }

      // Close modal first
      setShowStartModal(false)
      
      // Start countdown immediately
      setShowCountdown(true)
      setCountdown(5)
      setMeterReading(startingKilometers)

      // Try to save to database (but don't block if it fails)
      try {
        const response = await startTracking(
          startingKilometers,
          uploadedImage || '', // Base64 encoded image (optional)
          userLocation?.latitude || null,
          userLocation?.longitude || null,
          visitedAreaImage || null // Visited area image (optional)
        )

        if (!response || !response.success) {
          console.warn('Tracking API call failed, but continuing with local tracking')
        } else if (response?.data?._id || response?.data?.id) {
          setActiveTrackingId(response.data._id || response.data.id)
        }
      } catch (apiError) {
        console.error('Error saving tracking data to API:', apiError)
        // Continue with local tracking even if API fails
      }
      
      // Clear form data
      setUploadedImage(null)
      setVisitedAreaImage(null)
      setStartingKilometers('')
      
      // Find first pending visit target for route
      if (visitTargets && visitTargets.length > 0 && userLocation) {
        const firstPendingTarget = visitTargets.find(t => t.status === 'Pending' || t.status === 'In Progress')
        if (firstPendingTarget) {
          setRouteToVisitTarget({
            from: { lat: userLocation.latitude, lng: userLocation.longitude },
            to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
            target: firstPendingTarget
          })
        }
      }
    } catch (error) {
      console.error('Error in handleStartTracking:', error)
      alert('Error starting tracking. Please try again.')
      setShowStartModal(false)
      setShowCountdown(false)
    }
  }

  // Update route when visit targets change or user location updates
  useEffect(() => {
    if (!isTracking) return
    
    // Find first pending visit target
    const firstPendingTarget = visitTargets.find(t => t.status === 'Pending' || t.status === 'In Progress')
    
    if (firstPendingTarget && userLocation) {
      // Check if route is already set to this target
      if (!routeToVisitTarget || routeToVisitTarget.target?._id !== firstPendingTarget._id) {
        setRouteToVisitTarget({
          from: { lat: userLocation.latitude, lng: userLocation.longitude },
          to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
          target: firstPendingTarget
        })
      } else {
        // Update route origin to current location (real-time tracking)
        setRouteToVisitTarget({
          from: { lat: userLocation.latitude, lng: userLocation.longitude },
          to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
          target: firstPendingTarget
        })
      }
    } else if (!firstPendingTarget) {
      // No pending targets, clear route
      setRouteToVisitTarget(null)
    }
  }, [visitTargets, userLocation, isTracking])

  // Countdown effect
  useEffect(() => {
    if (!showCountdown || countdown === null || countdown < 0) {
      return
    }

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      
      countdownIntervalRef.current = timer
    } else if (countdown === 0) {
      // Countdown finished, start tracking
      setShowCountdown(false)
      setIsTracking(true)
      if (meterReading) {
        addNotification({
          message: `Tracking started with ${meterReading} km - Location tracking active`,
          type: 'success',
        })
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [showCountdown, countdown, meterReading])

  // Calculate map center (average of visit targets or user location)
  const getMapCenter = () => {
    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude]
    }
    if (visitTargets.length > 0) {
      const avgLat = visitTargets.reduce((sum, t) => sum + parseFloat(t.latitude), 0) / visitTargets.length
      const avgLon = visitTargets.reduce((sum, t) => sum + parseFloat(t.longitude), 0) / visitTargets.length
      return [avgLat, avgLon]
    }
    return [28.6139, 77.2090] // Default: Delhi
  }

  return (
    <>
      {/* Countdown Overlay */}
      {showCountdown && countdown !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] animate-fadeIn">
          <div className="text-center">
            <div className="text-9xl sm:text-[12rem] font-bold text-white mb-4 animate-pulse" style={{
              textShadow: '0 0 30px rgba(233, 147, 28, 0.8)',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
              {countdown}
            </div>
            <p className="text-xl sm:text-2xl text-white font-semibold" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Starting Tracking...</p>
          </div>
        </div>
      )}

      <div className="relative z-0">
        <div className="flex items-center justify-between mb-4 px-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Sales Tracking - Map View</h2>
            <p className="text-sm text-gray-600 mt-1" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              Proximity Alert: {PROXIMITY_DISTANCE_KM}km | GPS: {userLocation ? (
                <span className="inline-flex items-center gap-1">
                  <FaMapMarkerAlt className="w-4 h-4 text-green-600" />
                  <span>Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <FaClock className="w-4 h-4 text-yellow-600" />
                  <span>Getting location...</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowVisitAssignmentModal(true)
                setSelectedVisitsForAssignment(visitTargets.filter(v => v.status !== 'Completed').map(v => v._id || v.id))
              }}
              className="px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              title="Assign visits to dates"
            >
              <FaCalendarAlt className="w-5 h-5" />
              <span className="text-sm md:text-base" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Assign</span>
            </button>
            <button
              onClick={() => {
                setShowRequestVisitModal(true)
                // Load customers when modal opens
                if (customers.length === 0) {
                  loadCustomers()
                }
              }}
              className="px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 bg-[#e9931c] text-white hover:bg-[#d8820a]"
              title="Request a new visit (admin approval required)"
            >
              <FaMapMarkerAlt className="w-5 h-5" />
              <span className="hidden md:inline" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Request Visit</span>
            </button>
            <button
              onClick={() => {
                if (isTracking) {
                  // Show completion modal instead of directly stopping
                  setShowCompletionModal(true)
                } else {
                  setShowStartModal(true)
                }
              }}
              className={`px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                isTracking
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={isTracking ? 'Pause Tracking' : 'Start Tracking'}
            >
              {isTracking ? (
                <>
                  <FaPause className="w-5 h-5 md:w-5 md:h-5" />
                  <span className="hidden md:inline" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Pause Tracking</span>
                </>
              ) : (
                <>
                  <FaPlay className="w-5 h-5 md:w-5 md:h-5" />
                  <span className="hidden md:inline" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Start Tracking</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <NotificationToast
              key={notification.id}
              message={notification.message}
              type={notification.type}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
        </div>

        <div className="relative flex gap-0" style={{ height: 'calc(100vh - 200px)' }}>
          {/* Left: Map - Takes full width when panel is hidden */}
          <div className={`flex-1 transition-all duration-300 flex flex-col ${showRightPanel ? '' : ''}`} style={{ height: '100%' }}>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Visit Targets</h3>
            
            {/* Map View - Direct on Page - Full Height */}
            <div className="flex-1 w-full" style={{ minHeight: 0 }}>
              {userLocation || visitTargets.length > 0 ? (
                <GoogleMapView
                  milestones={[]}
                  visitTargets={visitTargets}
                  userLocation={userLocation}
                  onMarkerClick={handleVisitTargetClick}
                  center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : selectedVisitTarget ? { lat: parseFloat(selectedVisitTarget.latitude), lng: parseFloat(selectedVisitTarget.longitude) } : { lat: 28.6139, lng: 77.2090 }}
                  zoom={13}
                  height="100%"
                  showUserLocation={true}
                  showRadius={false}
                  routeToMilestone={routeToVisitTarget && isTracking ? {
                    from: routeToVisitTarget.from,
                    to: routeToVisitTarget.to,
                    milestone: routeToVisitTarget.target
                  } : null}
                  isTracking={isTracking}
                  selectedTarget={selectedVisitTarget}
                  onRouteInfoChange={(routeInfo) => {
                    if (routeInfo && routeInfo.distanceKm) {
                      setRouteDistanceKm(routeInfo.distanceKm)
                      // Update estimated kilometers if route is available
                      if (!estimatedKilometers || estimatedKilometers === '') {
                        setEstimatedKilometers(routeInfo.distanceKm)
                      }
                    } else {
                      setRouteDistanceKm(null)
                    }
                  }}
                />
              ) : (
                <div className="bg-white rounded-lg h-full flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-gray-600">Loading map...</p>
                    <p className="text-sm text-gray-500">Please enable location access</p>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Right Edge Trigger Zone - Always visible when panel is hidden */}
          {!showRightPanel && (
            <div
              className="fixed right-0 top-0 h-full w-8 z-50 cursor-pointer"
              onMouseEnter={() => setShowRightPanel(true)}
              style={{
                background: 'linear-gradient(to left, rgba(233, 147, 28, 0.3), transparent)',
              }}
            >
              {/* Slide Indicator */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2"
                style={{
                  width: '30px',
                  height: '120px',
                  background: 'linear-gradient(to left, rgba(233, 147, 28, 0.9), rgba(233, 147, 28, 0.7))',
                  borderTopLeftRadius: '15px',
                  borderBottomLeftRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
                }}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* Right: Visit Target Details - Slideable Panel */}
          <div
            className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-40 transition-transform duration-300 ease-in-out overflow-y-auto border-l border-gray-200 ${
              showRightPanel ? 'translate-x-0' : 'translate-x-full'
            }`}
            onMouseEnter={() => setShowRightPanel(true)}
            onMouseLeave={() => setShowRightPanel(false)}
            style={{ 
              paddingTop: '80px',
              paddingBottom: '20px',
              paddingLeft: '24px',
              paddingRight: '24px'
            }}
          >
            <div>
            {selectedVisitTarget ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Visit Target: {selectedVisitTarget.name}
                  </h3>
                  <button
                    onClick={() => setSelectedVisitTarget(null)}
                    className="text-gray-500 hover:text-gray-700"
                    title="Close Details"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Address:</span> {selectedVisitTarget.address || 'N/A'}
                  </p>
                  {selectedVisitTarget.city && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">City:</span> {selectedVisitTarget.city}
                    </p>
                  )}
                  {selectedVisitTarget.state && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">State:</span> {selectedVisitTarget.state}
                    </p>
                  )}
                  {selectedVisitTarget.pincode && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Pincode:</span> {selectedVisitTarget.pincode}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-semibold">Priority:</span> {selectedVisitTarget.priority || 'Medium'}
                  </p>
                  {selectedVisitTarget.visitDate && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Visit Date:</span> {new Date(selectedVisitTarget.visitDate).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Status:</span>{' '}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedVisitTarget.status === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedVisitTarget.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedVisitTarget.status}
                    </span>
                  </p>
                  {userLocation && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-semibold">Distance:</span> {getDistanceToVisitTarget(selectedVisitTarget)}
                    </p>
                  )}
                </div>

                {selectedVisitTarget.description && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Description:</span> {selectedVisitTarget.description}
                    </p>
                  </div>
                )}

                {selectedVisitTarget.notes && (
                  <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Notes:</span> {selectedVisitTarget.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  {selectedVisitTarget.status !== 'Completed' && (
                    <>
                      <button
                        onClick={handleCreateQuotation}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Create Quotation
                      </button>
                      <button
                        onClick={handleMarkAsCompleted}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark as Completed
                      </button>
                    </>
                  )}
                  {selectedVisitTarget.status === 'Completed' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-green-800">Visit Target Completed!</p>
                      </div>
                      <button
                        onClick={() => {
                          // Navigate to achievements
                          const event = new CustomEvent('navigateToTab', { detail: 'achievements' })
                          window.dispatchEvent(event)
                        }}
                        className="w-full mt-2 px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        View Achievements
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`transition-all duration-500 ease-in-out transform ${
                  showRightPanel
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-full opacity-0 pointer-events-none'
                }`}
                style={{
                  transitionDelay: showRightPanel ? '0.1s' : '0s'
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Visit Targets</h3>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#e9931c] bg-white"
                  >
                    <option value="All">All Dates</option>
                    <option value="Today">Today</option>
                    <option value="Tomorrow">Tomorrow</option>
                    <option value="This Week">This Week</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Past">Past</option>
                  </select>
                </div>
                
                {/* Date-wise Grouped Visit Targets */}
                {visitTargets.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-gray-600 font-medium">No visit targets assigned</p>
                    <p className="text-sm text-gray-500 mt-1">Admin will assign visit targets to you</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {visitTargets.map((target) => {
                      const targetId = target._id || target.id
                      const isSelected = selectedVisitTarget && (selectedVisitTarget._id === targetId || selectedVisitTarget.id === targetId)
                      return (
                        <div
                          key={targetId}
                          onClick={() => handleVisitTargetClick(target)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-800 text-sm">{target.name || 'Unnamed Target'}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              target.status === 'Completed'
                                ? 'bg-green-100 text-green-800'
                                : target.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {target.status}
                            </span>
                          </div>
                          
                          {target.address && (
                            <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                              <FaMapMarkerAlt className="w-3 h-3" />
                              {target.address}
                              {target.city && `, ${target.city}`}
                              {target.state && `, ${target.state}`}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {target.visitDate && (
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                <FaClock className="w-3 h-3" />
                                {new Date(target.visitDate).toLocaleDateString()}
                              </p>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              target.priority === 'High'
                                ? 'bg-red-100 text-red-700'
                                : target.priority === 'Medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {target.priority || 'Medium'}
                            </span>
                            {userLocation && (
                              <p className="text-xs text-blue-600 font-medium">
                                {getDistanceToVisitTarget(target) || 'Calculating...'}
                              </p>
                            )}
                          </div>
                          
                          {target.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{target.description}</p>
                          )}
                          
                          {target.createdBy && (
                            <p className="text-xs text-gray-400 mt-2">
                              Assigned by: {target.createdBy.name || target.createdBy.email || 'Admin'}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {visitRequests && visitRequests.length > 0 && (
                  <div className="mt-6 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm font-semibold text-gray-800 mb-2">My Visit Requests (Waiting/Rejected)</p>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {visitRequests.map((r) => (
                        <div key={r._id} className="p-2 rounded bg-white border border-gray-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-gray-800">{r.name}</div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              r.approvalStatus === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {r.approvalStatus}
                            </span>
                          </div>
                          {r.rejectionReason && (
                            <div className="text-xs text-gray-500 mt-1">Reason: {r.rejectionReason}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {visitTargets.length === 0 ? (
                  <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-gray-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600">No visit targets assigned</p>
                    <p className="text-sm text-gray-500 mt-1">Admin will assign visit targets to you</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {(() => {
                      const filteredVisits = getFilteredVisits()
                      const grouped = dateFilter === 'All' ? groupVisitsByDate(filteredVisits) : null
                      
                      // If filter is "All", show grouped by date sections
                      if (dateFilter === 'All' && grouped) {
                        const sections = [
                          { key: 'today', title: '📅 Today', visits: grouped.today, color: 'bg-blue-50 border-blue-200' },
                          { key: 'tomorrow', title: '📅 Tomorrow', visits: grouped.tomorrow, color: 'bg-green-50 border-green-200' },
                          { key: 'thisWeek', title: '📅 This Week', visits: grouped.thisWeek, color: 'bg-yellow-50 border-yellow-200' },
                          { key: 'upcoming', title: '📅 Upcoming', visits: grouped.upcoming, color: 'bg-purple-50 border-purple-200' },
                          { key: 'past', title: '📅 Past Visits', visits: grouped.past, color: 'bg-gray-50 border-gray-200' },
                          { key: 'noDate', title: '📅 No Date Assigned', visits: grouped.noDate, color: 'bg-orange-50 border-orange-200' }
                        ]

                        return sections.map(section => {
                          if (section.visits.length === 0) return null
                          
                          return (
                            <div key={section.key} className={`rounded-lg border-2 p-3 ${section.color}`}>
                              <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                {section.title} ({section.visits.length})
                              </h4>
                              <div className="space-y-2">
                                {section.visits
                                  .sort((a, b) => {
                                    // Sort by visit date
                                    if (a.visitDate && b.visitDate) {
                                      return new Date(a.visitDate) - new Date(b.visitDate)
                                    }
                                    // Then by status
                                    const statusOrder = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 }
                                    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
                                  })
                                  .map((target) => {
                        const targetId = target._id || target.id
                        const isSelected = selectedVisitTarget && (selectedVisitTarget._id === targetId || selectedVisitTarget.id === targetId)
                        return (
                          <div
                            key={targetId}
                            onClick={() => {
                              handleVisitTargetClick(target)
                              // Only show route if tracking is started
                              if (userLocation && isTracking) {
                                setRouteToVisitTarget({
                                  from: { lat: userLocation.latitude, lng: userLocation.longitude },
                                  to: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
                                  target: target
                                })
                              } else {
                                setRouteToVisitTarget(null)
                              }
                            }}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#e9931c] bg-orange-50 shadow-md'
                                : 'border-gray-200 hover:border-[#e9931c] hover:bg-orange-50'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-800">{target.name || 'Unnamed Target'}</p>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    target.status === 'Completed'
                                      ? 'bg-green-100 text-green-800'
                                      : target.status === 'In Progress'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {target.status}
                                  </span>
                                </div>
                                
                                {/* Full Address */}
                                <div className="text-sm text-gray-600 mb-2">
                                  {target.address && (
                                    <p className="flex items-center gap-1">
                                      <FaMapMarkerAlt className="w-3 h-3" />
                                      {target.address}
                                      {target.city && `, ${target.city}`}
                                      {target.state && `, ${target.state}`}
                                      {target.pincode && ` - ${target.pincode}`}
                                    </p>
                                  )}
                                  {!target.address && (target.city || target.state) && (
                                    <p>{[target.city, target.state, target.pincode].filter(Boolean).join(', ')}</p>
                                  )}
                                </div>
                                
                                {/* Visit Date */}
                                {target.visitDate && (
                                  <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                    <FaClock className="w-3 h-3" />
                                    Visit Date: {new Date(target.visitDate).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </p>
                                )}
                                
                                {/* Priority and Distance */}
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                    target.priority === 'High'
                                      ? 'bg-red-100 text-red-700'
                                      : target.priority === 'Medium'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {target.priority || 'Medium'} Priority
                                  </span>
                                  {userLocation && (
                                    <p className="text-xs font-semibold text-[#e9931c]">
                                      📍 {getDistanceToVisitTarget(target) || 'Calculating...'}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Description */}
                                {target.description && (
                                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{target.description}</p>
                                )}
                                
                                {/* Created By */}
                                {target.createdBy && (
                                  <p className="text-xs text-gray-400 mt-2">
                                    Assigned by: {target.createdBy.name || target.createdBy.email || 'Admin'}
                                  </p>
                                )}
                                
                                {/* Notes */}
                                {target.notes && (
                                  <p className="text-xs text-gray-500 mt-1 italic">Note: {target.notes}</p>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (userLocation && isTracking) {
                                    setRouteToVisitTarget({
                                      from: { lat: userLocation.latitude, lng: userLocation.longitude },
                                      to: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
                                      target: target
                                    })
                                    handleVisitTargetClick(target)
                                  } else {
                                    Swal.fire({
                                      icon: 'info',
                                      title: 'Start Tracking',
                                      text: 'Please start tracking first to see the route!',
                                      confirmButtonColor: '#e9931c'
                                    })
                                  }
                                }}
                                className={`ml-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold ${
                                  isTracking 
                                    ? 'bg-[#e9931c] text-white hover:bg-[#d8820a]' 
                                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                }`}
                                title={isTracking ? "Show Route" : "Start tracking to see route"}
                                disabled={!isTracking}
                              >
                                🗺️ Route
                              </button>
                            </div>
                          </div>
                        )
                      })}
                              </div>
                            </div>
                          )
                        }).filter(Boolean)
                      } else {
                        // Show filtered list
                        return filteredVisits
                          .sort((a, b) => {
                            // Sort by visit date
                            if (a.visitDate && b.visitDate) {
                              return new Date(a.visitDate) - new Date(b.visitDate)
                            }
                            // Then by status
                            const statusOrder = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 }
                            return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
                          })
                          .map((target) => {
                            const targetId = target._id || target.id
                            const isSelected = selectedVisitTarget && (selectedVisitTarget._id === targetId || selectedVisitTarget.id === targetId)
                            return (
                              <div
                                key={targetId}
                                onClick={() => {
                                  handleVisitTargetClick(target)
                                  if (userLocation && isTracking) {
                                    setRouteToVisitTarget({
                                      from: { lat: userLocation.latitude, lng: userLocation.longitude },
                                      to: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
                                      target: target
                                    })
                                  } else {
                                    setRouteToVisitTarget(null)
                                  }
                                }}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-[#e9931c] bg-orange-50 shadow-md'
                                    : 'border-gray-200 hover:border-[#e9931c] hover:bg-orange-50'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-semibold text-gray-800">{target.name || 'Unnamed Target'}</p>
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                        target.status === 'Completed'
                                          ? 'bg-green-100 text-green-800'
                                          : target.status === 'In Progress'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {target.status}
                                      </span>
                                    </div>
                                    
                                    {/* Full Address */}
                                    <div className="text-sm text-gray-600 mb-2">
                                      {target.address && (
                                        <p className="flex items-center gap-1">
                                          <FaMapMarkerAlt className="w-3 h-3" />
                                          {target.address}
                                          {target.city && `, ${target.city}`}
                                          {target.state && `, ${target.state}`}
                                          {target.pincode && ` - ${target.pincode}`}
                                        </p>
                                      )}
                                      {!target.address && (target.city || target.state) && (
                                        <p>{[target.city, target.state, target.pincode].filter(Boolean).join(', ')}</p>
                                      )}
                                    </div>
                                    
                                    {/* Visit Date */}
                                    {target.visitDate && (
                                      <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                        <FaClock className="w-3 h-3" />
                                        Visit Date: {new Date(target.visitDate).toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </p>
                                    )}
                                    
                                    {/* Priority and Distance */}
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                        target.priority === 'High'
                                          ? 'bg-red-100 text-red-700'
                                          : target.priority === 'Medium'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}>
                                        {target.priority || 'Medium'} Priority
                                      </span>
                                      {userLocation && (
                                        <p className="text-xs font-semibold text-[#e9931c]">
                                          📍 {getDistanceToVisitTarget(target) || 'Calculating...'}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Description */}
                                    {target.description && (
                                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{target.description}</p>
                                    )}
                                    
                                    {/* Created By */}
                                    {target.createdBy && (
                                      <p className="text-xs text-gray-400 mt-2">
                                        Assigned by: {target.createdBy.name || target.createdBy.email || 'Admin'}
                                      </p>
                                    )}
                                    
                                    {/* Notes */}
                                    {target.notes && (
                                      <p className="text-xs text-gray-500 mt-1 italic">Note: {target.notes}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (userLocation && isTracking) {
                                        setRouteToVisitTarget({
                                          from: { lat: userLocation.latitude, lng: userLocation.longitude },
                                          to: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
                                          target: target
                                        })
                                        handleVisitTargetClick(target)
                                      } else {
                                        Swal.fire({
                                          icon: 'info',
                                          title: 'Start Tracking',
                                          text: 'Please start tracking first to see the route!',
                                          confirmButtonColor: '#e9931c'
                                        })
                                      }
                                    }}
                                    className={`ml-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-semibold ${
                                      isTracking 
                                        ? 'bg-[#e9931c] text-white hover:bg-[#d8820a]' 
                                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    }`}
                                    title={isTracking ? "Show Route" : "Start tracking to see route"}
                                    disabled={!isTracking}
                                  >
                                    🗺️ Route
                                  </button>
                                </div>
                              </div>
                            )
                          })
                      }
                    })()}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Start Tracking Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-slideUp mx-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-xl sm:text-2xl">🏍️</span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight">Start Tracking</h3>
                    <p className="text-xs sm:text-sm text-orange-100 mt-0.5">Upload speedometer image</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowStartModal(false)
                    setUploadedImage(null)
                    setVisitedAreaImage(null)
                    setStartingKilometers('')
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 sm:p-2 transition-colors active:scale-95"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-700 mb-5 sm:mb-6 text-center leading-relaxed font-medium">
                📸 Upload your motorcycle speedometer/odometer image to automatically extract starting kilometers
              </p>

              {/* Image Upload Area */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3">
                  📷 Upload Speedometer Image
                </label>
                {/* Camera and Upload Buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleStartingSpeedometerCameraCapture}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="speedometer-upload"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="speedometer-upload"
                  />
                  <div
                    className="flex flex-col items-center justify-center w-full h-40 sm:h-48 md:h-56 border-2 border-dashed border-gray-300 rounded-xl"
                  >
                    {uploadedImage ? (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <img
                          src={uploadedImage}
                          alt="Speedometer"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm sm:text-base text-gray-700 font-semibold">No image selected</p>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">Use camera or upload button above</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Extracting Status */}
              {isExtracting && (
                <div className="mb-5 sm:mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-[#e9931c] border-t-transparent mb-3"></div>
                  <p className="text-sm sm:text-base font-bold text-[#e9931c] mb-1">🔍 Extracting kilometers from image...</p>
                  <p className="text-xs sm:text-sm text-gray-600">Please wait, this may take a few seconds</p>
                </div>
              )}

              {/* Current Visited Area Image Upload */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3">
                  📍 Upload Current Visited Area Picture
                </label>
                {/* Camera and Upload Buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleVisitedAreaCameraCapture}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="visited-area-upload"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleVisitedAreaImageUpload}
                    className="hidden"
                    id="visited-area-upload"
                  />
                  <div
                    className="flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed border-gray-300 rounded-xl"
                  >
                    {visitedAreaImage ? (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <img
                          src={visitedAreaImage}
                          alt="Visited Area"
                          className="max-w-full max-h-full object-cover rounded-lg shadow-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-xs sm:text-sm text-gray-700 font-semibold">No image selected</p>
                        <p className="text-xs text-gray-500 mt-1">Use camera or upload button above (Optional)</p>
                      </>
                    )}
                  </div>
                </div>
                {visitedAreaImage && (
                  <button
                    onClick={() => setVisitedAreaImage(null)}
                    className="mt-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {/* Starting Kilometers Input */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-2.5">
                  🚗 Starting Kilometers (km)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={startingKilometers}
                    onChange={(e) => setStartingKilometers(e.target.value)}
                    placeholder="Will be auto-filled from image"
                    className="w-full px-4 py-3 sm:py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c] transition-all text-base sm:text-lg font-bold placeholder:text-gray-400"
                  />
                  {startingKilometers && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <span className="text-sm sm:text-base text-gray-600 font-semibold">km</span>
                    </div>
                  )}
                </div>
                {startingKilometers && (
                  <p className="text-xs sm:text-sm text-green-600 mt-2.5 flex items-center gap-1.5 font-semibold">
                    <span className="text-base">✓</span> Kilometers extracted successfully!
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setShowStartModal(false)
                    setUploadedImage(null)
                    setVisitedAreaImage(null)
                    setStartingKilometers('')
                  }}
                  className="flex-1 px-4 py-3 sm:py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-bold text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleStartTracking()
                  }}
                  disabled={!startingKilometers || startingKilometers.trim() === '' || isExtracting}
                  className="flex-1 px-4 py-3 sm:py-3.5 bg-gradient-to-r from-[#e9931c] to-[#d8820a] text-white rounded-xl hover:from-[#d8820a] hover:to-[#c77109] active:scale-95 transition-all font-bold text-sm sm:text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isExtracting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <FaPlay className="w-5 h-5" />
                      <span>Start Tracking</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-slideUp mx-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-xl sm:text-2xl">🏁</span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight">
                      {selectedVisitTarget ? `Complete: ${selectedVisitTarget.name}` : 'Complete Tracking'}
                    </h3>
                    <p className="text-xs sm:text-sm text-orange-100 mt-0.5">Upload ending meter reading</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCompletionModal(false)
                    setEndingKilometers('')
                    setEndingMeterImage(null)
                    setEstimatedKilometers('')
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 sm:p-2 transition-colors active:scale-95"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-700 mb-5 sm:mb-6 text-center leading-relaxed font-medium">
                Please upload ending meter reading and visited area picture to complete tracking.
              </p>

              {/* Starting Kilometers Display */}
              <div className="mb-5 sm:mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-1">Starting Reading</p>
                <p className="text-2xl font-bold text-blue-700">
                  {startingKilometers && !isNaN(parseFloat(startingKilometers)) && parseFloat(startingKilometers) > 0 
                    ? `${startingKilometers} km` 
                    : 'Not set'}
                </p>
                {(!startingKilometers || isNaN(parseFloat(startingKilometers)) || parseFloat(startingKilometers) <= 0) && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Please set a valid starting reading</p>
                )}
              </div>

              {/* Ending Meter Image Upload */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3">
                  Ending Meter Reading (Upload Image) *
                </label>
                {/* Camera and Upload Buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleEndingMeterCameraCapture}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="ending-meter-upload"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEndingMeterImageUpload}
                  className="hidden"
                  id="ending-meter-upload"
                />
                <div
                  className="flex flex-col items-center justify-center w-full h-40 sm:h-48 md:h-56 border-2 border-dashed border-gray-300 rounded-xl"
                >
                  {endingMeterImage ? (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <img
                        src={endingMeterImage}
                        alt="Ending meter"
                        className="max-w-full max-h-full rounded-lg object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm sm:text-base text-gray-700 font-semibold">No image selected</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">Use camera or upload button above</p>
                    </div>
                  )}
                </div>
                {isExtractingEnding && (
                  <div className="mt-2 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-[#e9931c] border-t-transparent mb-3"></div>
                    <p className="text-sm sm:text-base font-bold text-[#e9931c] mb-1">🔍 Extracting kilometers from image...</p>
                    <p className="text-xs sm:text-sm text-gray-600">Please wait, this may take a few seconds</p>
                  </div>
                )}
              </div>

              {/* Ending Kilometers Manual Input */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-2.5">
                  Ending Kilometers (Manual Entry) *
                </label>
                <input
                  type="number"
                  value={endingKilometers}
                  onChange={handleEndingKilometersChange}
                  placeholder="Enter ending kilometers"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c] text-lg font-semibold"
                />
              </div>

              {/* Distance Traveled Display */}
              {estimatedKilometers && (
                <div className="mb-5 sm:mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">Distance Traveled</p>
                  <p className="text-2xl font-bold text-green-700">{estimatedKilometers} km</p>
                  <p className="text-xs text-green-600 mt-1">Calculated: {endingKilometers} - {startingKilometers} = {estimatedKilometers} km</p>
                </div>
              )}

              {/* Visited Area Image Upload - Required */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3">
                  Visited Area Picture * <span className="text-red-600">(Required)</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleVisitedAreaCameraCapture}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="visited-area-upload-completion"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleVisitedAreaImageUpload}
                  className="hidden"
                  id="visited-area-upload-completion"
                />
                <label
                  htmlFor="visited-area-upload-completion"
                  className={`flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                    visitedAreaImage 
                      ? 'border-green-300 bg-green-50' 
                      : 'border-red-300 bg-red-50 hover:border-[#e9931c] hover:bg-orange-50'
                  }`}
                >
                  {visitedAreaImage ? (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <img
                        src={visitedAreaImage}
                        alt="Visited area"
                        className="max-w-full max-h-full rounded-lg object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs sm:text-sm text-red-700 font-semibold">⚠️ Required: Click to upload visited area picture</p>
                      <p className="text-xs text-red-600 mt-1">This field is mandatory</p>
                    </div>
                  )}
                </label>
                {visitedAreaImage && (
                  <button
                    onClick={() => setVisitedAreaImage(null)}
                    className="mt-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setShowCompletionModal(false)
                    setEndingKilometers('')
                    setEndingMeterImage(null)
                    setEstimatedKilometers('')
                  }}
                  className="flex-1 px-4 py-3 sm:py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-bold text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedVisitTarget) {
                      handleCompleteTarget()
                    } else {
                      handleCompleteTracking()
                    }
                  }}
                  disabled={!endingKilometers || endingKilometers.trim() === '' || !endingMeterImage || !visitedAreaImage || isExtractingEnding}
                  className="flex-1 px-4 py-3 sm:py-3.5 bg-gradient-to-r from-[#e9931c] to-[#d8820a] text-white rounded-xl hover:from-[#d8820a] hover:to-[#c77109] active:scale-95 transition-all font-bold text-sm sm:text-base shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <FaCheckCircle className="w-5 h-5" />
                  <span>{selectedVisitTarget ? 'Complete Target' : 'Complete Tracking'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit Target Action Modal - Opens when target is clicked */}
      {showVisitTargetModal && selectedVisitTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slideUp">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Visit Target</h3>
                    <p className="text-sm text-orange-100 mt-0.5">{selectedVisitTarget.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowVisitTargetModal(false)
                    setSelectedVisitTarget(null)
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Target Info */}
              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Address:</span> {selectedVisitTarget.address || 'N/A'}
                  </p>
                  {selectedVisitTarget.city && selectedVisitTarget.state && (
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold">Location:</span> {selectedVisitTarget.city}, {selectedVisitTarget.state}
                    </p>
                  )}
                  {userLocation && (
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Distance:</span> {getDistanceToVisitTarget(selectedVisitTarget)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedVisitTarget.status === 'Completed'
                      ? 'bg-green-100 text-green-800'
                      : selectedVisitTarget.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedVisitTarget.status}
                  </span>
                  {selectedVisitTarget.priority && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      Priority: {selectedVisitTarget.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Comments Field */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Comments
                </label>
                <textarea
                  value={targetComments || selectedVisitTarget.comments || ''}
                  onChange={(e) => setTargetComments(e.target.value)}
                  placeholder="Add comments about this visit target..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c] transition-all resize-none"
                  rows="3"
                />
              </div>

              {/* Estimated Kilometers Display (if route is available) */}
              {routeDistanceKm && isTracking && (
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Estimated Route Distance</p>
                  <p className="text-2xl font-bold text-blue-700">{routeDistanceKm} km</p>
                  <p className="text-xs text-blue-600 mt-1">Based on best route calculation</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    handleCreateQuotation()
                    setShowVisitTargetModal(false)
                  }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Create Quotation
                </button>

                <button
                  onClick={() => {
                    setShowVisitTargetModal(false)
                    const event = new CustomEvent('navigateToTab', { detail: 'achievements' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-4 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Achievement
                </button>

                <button
                  onClick={() => {
                    setShowVisitTargetModal(false)
                    const event = new CustomEvent('navigateToTab', { detail: 'achievements' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Conversion
                </button>

                {selectedVisitTarget.status !== 'Completed' && (
                  <button
                    onClick={() => {
                      setShowVisitTargetModal(false)
                      handleMarkAsCompleted()
                    }}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Target
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setShowVisitTargetModal(false)
                  setSelectedVisitTarget(null)
                }}
                className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Modal - Shown after completion */}
      {/* Request Visit Modal */}
      {showRequestVisitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slideUp my-auto">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Request a Visit</h3>
                  <p className="text-sm text-orange-100 mt-1">Admin approval required</p>
                </div>
                <button
                  onClick={() => setShowRequestVisitModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Select Customer *</label>
                  <select
                    value={requestForm.customerId}
                    onChange={(e) => {
                      handleCustomerSelect(e.target.value)
                    }}
                    onFocus={() => {
                      if (customers.length === 0) {
                        loadCustomers()
                      }
                    }}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="">-- Select Customer --</option>
                    {loadingCustomers ? (
                      <option value="" disabled>Loading customers...</option>
                    ) : customers.length === 0 ? (
                      <option value="" disabled>No customers found. Please add customers first.</option>
                    ) : (
                      customers.map((customer) => {
                        const displayName = customer.name || 
                                          customer.company || 
                                          (customer.firstName ? `${customer.firstName}${customer.contactPerson ? ` ${customer.contactPerson}` : ''}` : '') ||
                                          customer.email ||
                                          'Customer'
                        const companyInfo = customer.company && customer.name ? ` (${customer.company})` : ''
                        return (
                          <option key={customer._id} value={customer._id}>
                            {displayName}{companyInfo}
                          </option>
                        )
                      })
                    )}
                  </select>
                  {requestForm.customerId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {requestForm.customerName}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Visit Name *</label>
                  <input
                    value={requestForm.name}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Visit name (auto-filled from customer)"
                    readOnly={!!requestForm.customerId}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <input
                    value={requestForm.description}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Optional"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                  <input
                    value={requestForm.address}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                  <input
                    value={requestForm.city}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                  <input
                    value={requestForm.state}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Pincode</label>
                  <input
                    value={requestForm.pincode}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, pincode: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Visit Date</label>
                  <input
                    type="date"
                    value={requestForm.visitDate}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, visitDate: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
                  <div className="flex gap-2">
                    <input
                      value={requestForm.latitude}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, latitude: e.target.value }))}
                      className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      placeholder={userLocation ? String(userLocation.latitude) : 'GPS needed'}
                    />
                    {userLocation && (
                      <button
                        type="button"
                        onClick={() => setRequestForm(prev => ({ ...prev, latitude: String(userLocation.latitude) }))}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                        title="Use current location"
                      >
                        📍 Use GPS
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
                  <div className="flex gap-2">
                    <input
                      value={requestForm.longitude}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, longitude: e.target.value }))}
                      className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                      placeholder={userLocation ? String(userLocation.longitude) : 'GPS needed'}
                    />
                    {userLocation && (
                      <button
                        type="button"
                        onClick={() => setRequestForm(prev => ({ ...prev, longitude: String(userLocation.longitude) }))}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                        title="Use current location"
                      >
                        📍 Use GPS
                      </button>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={requestForm.notes}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    rows="3"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 flex-shrink-0 border-t border-gray-200 mt-4">
                <button
                  onClick={() => setShowRequestVisitModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitVisitRequest}
                  disabled={requestSubmitting}
                  className="flex-1 px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50"
                >
                  {requestSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Assign Modal - Visits, Follow-up, Sample Track */}
      {showVisitAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slideUp my-auto">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <FaCalendarAlt className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Assign</h3>
                    <p className="text-sm text-blue-100 mt-0.5">Assign Visits, Tasks, or Sample Track to dates</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowVisitAssignmentModal(false)
                    setSelectedVisitsForAssignment([])
                    setSelectedFollowUpsForAssignment([])
                    setSelectedSamplesForAssignment([])
                    setAssignmentDate('')
                    setSelectedDateForView('')
                    setAssignModalActiveTab('visits')
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => {
                  setAssignModalActiveTab('visits')
                  // Refresh visits when tab is clicked
                  refreshRequestsAndTargets()
                }}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  assignModalActiveTab === 'visits'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <FaMapMarkerAlt className="w-4 h-4" />
                Visits
              </button>
              <button
                onClick={() => {
                  setAssignModalActiveTab('tasks')
                  // Load tasks (follow-ups) when tab is clicked
                  loadFollowUps()
                }}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  assignModalActiveTab === 'tasks'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <FaTasks className="w-4 h-4" />
                Tasks
              </button>
              <button
                onClick={() => {
                  setAssignModalActiveTab('sample')
                  // Load samples when tab is clicked
                  loadSamples()
                }}
                className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  assignModalActiveTab === 'sample'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                }`}
              >
                <FaFlask className="w-4 h-4" />
                Sample Track
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Calendar Date Selection - Common for all tabs */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaCalendarAlt className="text-blue-600" />
                  Select Date to View & Assign
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="date"
                    value={selectedDateForView}
                    onChange={(e) => {
                      const selectedDate = e.target.value
                      setSelectedDateForView(selectedDate)
                      setAssignmentDate(selectedDate)
                      
                      // Show notification when date is selected
                      if (selectedDate) {
                        const dateObj = new Date(selectedDate)
                        const formattedDate = dateObj.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                        
                        const tabName = assignModalActiveTab === 'visits' ? 'visits' : assignModalActiveTab === 'tasks' ? 'tasks' : 'samples'
                        
                        Swal.fire({
                          icon: 'info',
                          title: 'Date Selected',
                          text: `Showing ${tabName} for ${formattedDate}`,
                          confirmButtonColor: '#e9931c',
                          timer: 2000,
                          timerProgressBar: true,
                          toast: true,
                          position: 'top-end',
                          showConfirmButton: false
                        })
                        
                        addNotification({
                          message: `📅 Viewing ${tabName} for ${formattedDate}`,
                          type: 'info'
                        })
                      }
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  {selectedDateForView && (
                    <button
                      onClick={() => {
                        setSelectedDateForView('')
                        setAssignmentDate('')
                      }}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Clear Date"
                    >
                      <FaTimes className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              {assignModalActiveTab === 'visits' && (
                <div className="mb-4">
                  {/* Categorized Visits Display */}
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const tomorrow = new Date(today)
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    const nextWeek = new Date(today)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    
                    // Filter visits based on selectedDateForView or show all
                    let visitsToShow = visitTargets.filter(v => v.status !== 'Completed')
                    
                    if (selectedDateForView) {
                      const selectedDateObj = new Date(selectedDateForView)
                      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
                      
                      visitsToShow = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitDateOnly = new Date(new Date(v.visitDate).getFullYear(), new Date(v.visitDate).getMonth(), new Date(v.visitDate).getDate())
                        return visitDateOnly.getTime() === selectedDateOnly.getTime()
                      })
                    }
                    
                    // Categorize visits
                    const dueVisits = visitsToShow.filter(v => {
                      if (!v.visitDate) return false
                      const visitDate = new Date(v.visitDate)
                      return visitDate < today
                    })
                    
                    const todayVisits = visitsToShow.filter(v => {
                      if (!v.visitDate) return false
                      const visitDate = new Date(v.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === today.getTime()
                    })
                    
                    const tomorrowVisits = visitsToShow.filter(v => {
                      if (!v.visitDate) return false
                      const visitDate = new Date(v.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === tomorrow.getTime()
                    })
                    
                    const remainingVisits = visitsToShow.filter(v => {
                      if (!v.visitDate) return false
                      const visitDate = new Date(v.visitDate)
                      return visitDate > tomorrow && visitDate <= nextWeek
                    })
                    
                    const upcomingVisits = visitsToShow.filter(v => {
                      if (!v.visitDate) return false
                      const visitDate = new Date(v.visitDate)
                      return visitDate > nextWeek
                    })
                    
                    return (
                      <div className="space-y-4">
                        {/* Due Visits (Past) */}
                        {dueVisits.length > 0 && (
                          <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaExclamationTriangle className="text-red-600" />
                              <h4 className="font-semibold text-red-800">Due Visits ({dueVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {dueVisits.map((visit) => (
                                <div key={visit._id || visit.id} className="p-3 bg-white rounded-lg border border-red-200">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800">{visit.name}</p>
                                      <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                      <p className="text-xs text-red-600 mt-1">
                                        Due: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Today's Visits */}
                        {todayVisits.length > 0 && (
                          <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaClock className="text-blue-600" />
                              <h4 className="font-semibold text-blue-800">Today's Visits ({todayVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {todayVisits.map((visit) => (
                                <div key={visit._id || visit.id} className="p-3 bg-white rounded-lg border border-blue-200">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800">{visit.name}</p>
                                      <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                      <p className="text-xs text-blue-600 mt-1">
                                        Today: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (!isTracking) {
                                          setShowStartModal(true)
                                        }
                                      }}
                                      className="ml-2 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                                      title="Start Tracking"
                                    >
                                      <FaPlay className="w-4 h-4" />
                                      <span className="text-xs hidden sm:inline">Start</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tomorrow's Visits */}
                        {tomorrowVisits.length > 0 && (
                          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-green-600" />
                              <h4 className="font-semibold text-green-800">Tomorrow's Visits ({tomorrowVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {tomorrowVisits.map((visit) => (
                                <div key={visit._id || visit.id} className="p-3 bg-white rounded-lg border border-green-200">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800">{visit.name}</p>
                                    <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                    <p className="text-xs text-green-600 mt-1">
                                      Tomorrow: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Remaining Visits (This Week) */}
                        {remainingVisits.length > 0 && (
                          <div className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaArrowRight className="text-yellow-600" />
                              <h4 className="font-semibold text-yellow-800">This Week ({remainingVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {remainingVisits.map((visit) => (
                                <div key={visit._id || visit.id} className="p-3 bg-white rounded-lg border border-yellow-200">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800">{visit.name}</p>
                                    <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                    <p className="text-xs text-yellow-600 mt-1">
                                      Scheduled: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Upcoming Visits */}
                        {upcomingVisits.length > 0 && (
                          <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-purple-600" />
                              <h4 className="font-semibold text-purple-800">Upcoming Visits ({upcomingVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {upcomingVisits.map((visit) => (
                                <div key={visit._id || visit.id} className="p-3 bg-white rounded-lg border border-purple-200">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800">{visit.name}</p>
                                    <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                    <p className="text-xs text-purple-600 mt-1">
                                      Upcoming: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {visitsToShow.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                            <FaCalendarAlt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">
                              {selectedDateForView ? 'No visits scheduled for this date' : 'No visits available'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedDateForView ? 'Select another date or assign visits to this date' : 'Visits will appear here once assigned'}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Tasks Tab Content */}
              {assignModalActiveTab === 'tasks' && (
                <div className="mb-4">
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const tomorrow = new Date(today)
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    const nextWeek = new Date(today)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    
                    // Filter tasks based on selectedDateForView or show all
                    let tasksToShow = followUps.filter(f => f.status !== 'Completed')
                    
                    if (selectedDateForView) {
                      const selectedDateObj = new Date(selectedDateForView)
                      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
                      
                      tasksToShow = tasksToShow.filter(f => {
                        // Check dueDate first
                        if (f.dueDate) {
                          const dueDateOnly = new Date(new Date(f.dueDate).getFullYear(), new Date(f.dueDate).getMonth(), new Date(f.dueDate).getDate())
                          if (dueDateOnly.getTime() === selectedDateOnly.getTime()) return true
                        }
                        // Also check scheduledDate
                        if (f.scheduledDate) {
                          const scheduledDateOnly = new Date(new Date(f.scheduledDate).getFullYear(), new Date(f.scheduledDate).getMonth(), new Date(f.scheduledDate).getDate())
                          if (scheduledDateOnly.getTime() === selectedDateOnly.getTime()) return true
                        }
                        return false
                      })
                    }
                    
                    // Categorize tasks
                    const dueTasks = tasksToShow.filter(f => {
                      const checkDate = f.dueDate ? new Date(f.dueDate) : (f.scheduledDate ? new Date(f.scheduledDate) : null)
                      if (!checkDate) return false
                      return checkDate < today
                    })
                    
                    const todayTasks = tasksToShow.filter(f => {
                      const checkDate = f.dueDate ? new Date(f.dueDate) : (f.scheduledDate ? new Date(f.scheduledDate) : null)
                      if (!checkDate) return false
                      const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate())
                      return checkDateOnly.getTime() === today.getTime()
                    })
                    
                    const tomorrowTasks = tasksToShow.filter(f => {
                      const checkDate = f.dueDate ? new Date(f.dueDate) : (f.scheduledDate ? new Date(f.scheduledDate) : null)
                      if (!checkDate) return false
                      const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate())
                      return checkDateOnly.getTime() === tomorrow.getTime()
                    })
                    
                    const remainingTasks = tasksToShow.filter(f => {
                      const checkDate = f.dueDate ? new Date(f.dueDate) : (f.scheduledDate ? new Date(f.scheduledDate) : null)
                      if (!checkDate) return false
                      return checkDate > tomorrow && checkDate <= nextWeek
                    })
                    
                    const upcomingTasks = tasksToShow.filter(f => {
                      const checkDate = f.dueDate ? new Date(f.dueDate) : (f.scheduledDate ? new Date(f.scheduledDate) : null)
                      if (!checkDate) return false
                      return checkDate > nextWeek
                    })
                    
                    return (
                      <div className="space-y-4">
                        {/* Due Tasks (Past) */}
                        {dueTasks.length > 0 && (
                          <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaExclamationTriangle className="text-red-600" />
                              <h4 className="font-semibold text-red-800">Due Tasks ({dueTasks.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {dueTasks.map((task) => {
                                const taskDate = task.dueDate || task.scheduledDate
                                const taskType = task.type || 'Task'
                                return (
                                  <div key={task._id || task.id} className="p-3 bg-white rounded-lg border border-red-200">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-medium text-gray-800">{task.title || task.name || task.customerName || 'Task'}</p>
                                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                                            {taskType}
                                          </span>
                                        </div>
                                        {task.description && (
                                          <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                        )}
                                        {task.customerName && (
                                          <p className="text-xs text-gray-500">Customer: {task.customerName}</p>
                                        )}
                                        <p className="text-xs text-red-600 mt-1">
                                          Due: {taskDate ? new Date(taskDate).toLocaleDateString() : 'No date'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Today's Tasks */}
                        {todayTasks.length > 0 && (
                          <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaClock className="text-blue-600" />
                              <h4 className="font-semibold text-blue-800">Today's Tasks ({todayTasks.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {todayTasks.map((task) => {
                                const taskDate = task.dueDate || task.scheduledDate
                                const taskType = task.type || 'Task'
                                return (
                                  <div key={task._id || task.id} className="p-3 bg-white rounded-lg border border-blue-200">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-medium text-gray-800">{task.title || task.name || task.customerName || 'Task'}</p>
                                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                                            {taskType}
                                          </span>
                                        </div>
                                        {task.description && (
                                          <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                        )}
                                        {task.customerName && (
                                          <p className="text-xs text-gray-500">Customer: {task.customerName}</p>
                                        )}
                                        <p className="text-xs text-blue-600 mt-1">
                                          Today: {taskDate ? new Date(taskDate).toLocaleDateString() : 'No date'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tomorrow's Tasks */}
                        {tomorrowTasks.length > 0 && (
                          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-green-600" />
                              <h4 className="font-semibold text-green-800">Tomorrow's Tasks ({tomorrowTasks.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {tomorrowTasks.map((task) => {
                                const taskDate = task.dueDate || task.scheduledDate
                                const taskType = task.type || 'Task'
                                return (
                                  <div key={task._id || task.id} className="p-3 bg-white rounded-lg border border-green-200">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-gray-800">{task.title || task.name || task.customerName || 'Task'}</p>
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                                          {taskType}
                                        </span>
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                      )}
                                      {task.customerName && (
                                        <p className="text-xs text-gray-500">Customer: {task.customerName}</p>
                                      )}
                                      <p className="text-xs text-green-600 mt-1">
                                        Tomorrow: {taskDate ? new Date(taskDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Remaining Tasks (This Week) */}
                        {remainingTasks.length > 0 && (
                          <div className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaArrowRight className="text-yellow-600" />
                              <h4 className="font-semibold text-yellow-800">This Week ({remainingTasks.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {remainingTasks.map((task) => {
                                const taskDate = task.dueDate || task.scheduledDate
                                const taskType = task.type || 'Task'
                                return (
                                  <div key={task._id || task.id} className="p-3 bg-white rounded-lg border border-yellow-200">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-medium text-gray-800">{task.title || task.name || task.customerName || 'Task'}</p>
                                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                                            {taskType}
                                          </span>
                                        </div>
                                        {task.description && (
                                          <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                        )}
                                        {task.customerName && (
                                          <p className="text-xs text-gray-500">Customer: {task.customerName}</p>
                                        )}
                                        <p className="text-xs text-yellow-600 mt-1">
                                          Scheduled: {taskDate ? new Date(taskDate).toLocaleDateString() : 'No date'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Upcoming Tasks */}
                        {upcomingTasks.length > 0 && (
                          <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-purple-600" />
                              <h4 className="font-semibold text-purple-800">Upcoming Tasks ({upcomingTasks.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {upcomingTasks.map((task) => {
                                const taskDate = task.dueDate || task.scheduledDate
                                const taskType = task.type || 'Task'
                                return (
                                  <div key={task._id || task.id} className="p-3 bg-white rounded-lg border border-purple-200">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-gray-800">{task.title || task.name || task.customerName || 'Task'}</p>
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                                          {taskType}
                                        </span>
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mb-1">{task.description}</p>
                                      )}
                                      {task.customerName && (
                                        <p className="text-xs text-gray-500">Customer: {task.customerName}</p>
                                      )}
                                      <p className="text-xs text-purple-600 mt-1">
                                        Upcoming: {taskDate ? new Date(taskDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {tasksToShow.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                            <FaTasks className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">
                              {selectedDateForView ? 'No tasks for this date' : 'No tasks available'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedDateForView ? 'Select another date or assign tasks to this date' : 'Tasks will appear here once assigned'}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Sample Track Tab Content */}
              {assignModalActiveTab === 'sample' && (
                <div className="mb-4">
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const tomorrow = new Date(today)
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    const nextWeek = new Date(today)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    
                    // Filter samples based on selectedDateForView or show all
                    let samplesToShow = samples.filter(s => s.status !== 'Converted')
                    
                    if (selectedDateForView) {
                      const selectedDateObj = new Date(selectedDateForView)
                      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
                      
                      samplesToShow = samplesToShow.filter(s => {
                        if (s.visitDate) {
                          const visitDateOnly = new Date(new Date(s.visitDate).getFullYear(), new Date(s.visitDate).getMonth(), new Date(s.visitDate).getDate())
                          return visitDateOnly.getTime() === selectedDateOnly.getTime()
                        }
                        if (s.expectedDate) {
                          const expectedDateOnly = new Date(new Date(s.expectedDate).getFullYear(), new Date(s.expectedDate).getMonth(), new Date(s.expectedDate).getDate())
                          return expectedDateOnly.getTime() === selectedDateOnly.getTime()
                        }
                        return false
                      })
                    }
                    
                    // Categorize samples
                    const todaySamples = samplesToShow.filter(s => {
                      if (!s.visitDate) return false
                      const visitDate = new Date(s.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === today.getTime()
                    })
                    
                    const tomorrowSamples = samplesToShow.filter(s => {
                      if (!s.visitDate) return false
                      const visitDate = new Date(s.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === tomorrow.getTime()
                    })
                    
                    const thisWeekSamples = samplesToShow.filter(s => {
                      if (!s.visitDate) return false
                      const visitDate = new Date(s.visitDate)
                      return visitDate > tomorrow && visitDate <= nextWeek
                    })
                    
                    const upcomingSamples = samplesToShow.filter(s => {
                      if (!s.visitDate) return false
                      const visitDate = new Date(s.visitDate)
                      return visitDate > nextWeek
                    })
                    
                    const pastSamples = samplesToShow.filter(s => {
                      if (!s.visitDate) return false
                      const visitDate = new Date(s.visitDate)
                      return visitDate < today
                    })
                    
                    return (
                      <div className="space-y-4">
                        {/* Past Samples */}
                        {pastSamples.length > 0 && (
                          <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaExclamationTriangle className="text-red-600" />
                              <h4 className="font-semibold text-red-800">Past Samples ({pastSamples.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {pastSamples.map((sample) => (
                                <div key={sample._id || sample.id} className="p-3 bg-white rounded-lg border border-red-200">
                                  <p className="font-medium text-gray-800">{sample.customerName || 'Sample'}</p>
                                  <p className="text-sm text-gray-600">{sample.productName || 'No product'}</p>
                                  <p className="text-xs text-gray-500">Qty: {sample.quantity || 1}</p>
                                  <p className="text-xs text-red-600 mt-1">
                                    Visit Date: {sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'No date'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Today's Samples */}
                        {todaySamples.length > 0 && (
                          <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaClock className="text-blue-600" />
                              <h4 className="font-semibold text-blue-800">Today's Samples ({todaySamples.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {todaySamples.map((sample) => (
                                <div key={sample._id || sample.id} className="p-3 bg-white rounded-lg border border-blue-200">
                                  <p className="font-medium text-gray-800">{sample.customerName || 'Sample'}</p>
                                  <p className="text-sm text-gray-600">{sample.productName || 'No product'}</p>
                                  <p className="text-xs text-gray-500">Qty: {sample.quantity || 1}</p>
                                  <p className="text-xs text-blue-600 mt-1">
                                    Today: {sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'No date'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tomorrow's Samples */}
                        {tomorrowSamples.length > 0 && (
                          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-green-600" />
                              <h4 className="font-semibold text-green-800">Tomorrow's Samples ({tomorrowSamples.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {tomorrowSamples.map((sample) => (
                                <div key={sample._id || sample.id} className="p-3 bg-white rounded-lg border border-green-200">
                                  <p className="font-medium text-gray-800">{sample.customerName || 'Sample'}</p>
                                  <p className="text-sm text-gray-600">{sample.productName || 'No product'}</p>
                                  <p className="text-xs text-gray-500">Qty: {sample.quantity || 1}</p>
                                  <p className="text-xs text-green-600 mt-1">
                                    Tomorrow: {sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'No date'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* This Week Samples */}
                        {thisWeekSamples.length > 0 && (
                          <div className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaArrowRight className="text-yellow-600" />
                              <h4 className="font-semibold text-yellow-800">This Week ({thisWeekSamples.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {thisWeekSamples.map((sample) => (
                                <div key={sample._id || sample.id} className="p-3 bg-white rounded-lg border border-yellow-200">
                                  <p className="font-medium text-gray-800">{sample.customerName || 'Sample'}</p>
                                  <p className="text-sm text-gray-600">{sample.productName || 'No product'}</p>
                                  <p className="text-xs text-gray-500">Qty: {sample.quantity || 1}</p>
                                  <p className="text-xs text-yellow-600 mt-1">
                                    Visit Date: {sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'No date'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Upcoming Samples */}
                        {upcomingSamples.length > 0 && (
                          <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-purple-600" />
                              <h4 className="font-semibold text-purple-800">Upcoming Samples ({upcomingSamples.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {upcomingSamples.map((sample) => (
                                <div key={sample._id || sample.id} className="p-3 bg-white rounded-lg border border-purple-200">
                                  <p className="font-medium text-gray-800">{sample.customerName || 'Sample'}</p>
                                  <p className="text-sm text-gray-600">{sample.productName || 'No product'}</p>
                                  <p className="text-xs text-gray-500">Qty: {sample.quantity || 1}</p>
                                  <p className="text-xs text-purple-600 mt-1">
                                    Visit Date: {sample.visitDate ? new Date(sample.visitDate).toLocaleDateString() : 'No date'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {samplesToShow.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                            <FaFlask className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">
                              {selectedDateForView ? 'No samples for this date' : 'No samples available'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedDateForView ? 'Select another date or assign samples to this date' : 'Samples will appear here once assigned'}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowVisitAssignmentModal(false)
                    setSelectedVisitsForAssignment([])
                    setSelectedFollowUpsForAssignment([])
                    setSelectedSamplesForAssignment([])
                    setAssignmentDate('')
                    setSelectedDateForView('')
                    setAssignModalActiveTab('visits')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <FaTimes className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAchievementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slideUp">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                    <span className="text-3xl">🎉</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Visit Target Completed!</h3>
                    <p className="text-sm text-green-100 mt-0.5">Great job!</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAchievementModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">🎉</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                  {selectedVisitTarget?.name || 'Visit Target'} Completed!
                </h4>
                <p className="text-sm text-gray-600 mb-3">Congratulations! You've successfully completed this visit target.</p>
                {selectedVisitTarget?.actualKilometers && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mt-3">
                    <p className="text-sm font-semibold text-green-800">Distance Traveled</p>
                    <p className="text-2xl font-bold text-green-700">{selectedVisitTarget.actualKilometers} km</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowAchievementModal(false)
                    const event = new CustomEvent('navigateToTab', { detail: 'achievements' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-4 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  View Achievements
                </button>
                <button
                  onClick={() => setShowAchievementModal(false)}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Modal - COMMENTED OUT - Using Visit Targets only */}
      {/* {showMilestoneModal && selectedMilestone && (
        <MilestoneModal
          milestone={selectedMilestone}
          onClose={() => {
            setShowMilestoneModal(false)
            setSelectedMilestone(null)
          }}
          onQuotation={handleQuotation}
          onAchievement={handleAchievement}
          onConversion={handleConversion}
        />
      )} */}
    </>
  )
}

export default SalesTracking
