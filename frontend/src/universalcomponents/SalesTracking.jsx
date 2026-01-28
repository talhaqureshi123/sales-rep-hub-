import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  const [rightPanelTab, setRightPanelTab] = useState('visits') // 'visits', 'tasks', 'samples'
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [showVisitTargetModal, setShowVisitTargetModal] = useState(false)
  const [meterReading, setMeterReading] = useState('')
  const [capturedImage, setCapturedImage] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [visitedAreaImage, setVisitedAreaImage] = useState(null) // Single image for backward compatibility
  const [visitedAreaImages, setVisitedAreaImages] = useState([]) // Array for multiple images
  const [isExtracting, setIsExtracting] = useState(false)
  const [startingKilometers, setStartingKilometers] = useState('')
  const [endingKilometers, setEndingKilometers] = useState('')
  const [endingMeterImage, setEndingMeterImage] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [isExtractingEnding, setIsExtractingEnding] = useState(false)
  const [estimatedKilometers, setEstimatedKilometers] = useState('')
  const [showShiftEndModal, setShowShiftEndModal] = useState(false) // Modal for ending meter when all visits done
  const [shiftEndingKilometers, setShiftEndingKilometers] = useState('') // Ending kilometers for shift end
  const [shiftEndingMeterImage, setShiftEndingMeterImage] = useState(null) // Ending meter image for shift end
  const [isExtractingShiftEnd, setIsExtractingShiftEnd] = useState(false)
  const [showShiftPhotoCollage, setShowShiftPhotoCollage] = useState(false) // Show shift photo collage
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
    targetName: '', // Add target name field
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
  const [dateFilter, setDateFilter] = useState('Today') // All, Today, Tomorrow, This Week, Upcoming, Past
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
  const lastMapLocationRef = useRef(null) // Store last location sent to map
  const locationUpdateThrottleRef = useRef(null) // Throttle location updates to map

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
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + 7)
    endOfWeek.setHours(23, 59, 59, 999)

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

      try {
        const visitDate = new Date(target.visitDate)
        // Handle invalid dates
        if (isNaN(visitDate.getTime())) {
          grouped.noDate.push(target)
          return
        }
        
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
        visitDateOnly.setHours(0, 0, 0, 0)

        const todayTime = today.getTime()
        const tomorrowTime = tomorrow.getTime()
        const endOfWeekTime = endOfWeek.getTime()
        const visitTime = visitDateOnly.getTime()

        if (visitTime === todayTime) {
          grouped.today.push(target)
        } else if (visitTime === tomorrowTime) {
          grouped.tomorrow.push(target)
        } else if (visitTime < todayTime) {
          grouped.past.push(target)
        } else if (visitTime > tomorrowTime && visitTime <= endOfWeekTime) {
          // This week includes dates after tomorrow up to end of week (7 days from today)
          grouped.thisWeek.push(target)
        } else if (visitTime > endOfWeekTime) {
          grouped.upcoming.push(target)
        } else {
          // Fallback: should not happen, but add to thisWeek if between today and end of week
          grouped.thisWeek.push(target)
        }
      } catch (e) {
        console.error('Error parsing visit date:', e, target)
        grouped.noDate.push(target)
      }
    })

    return grouped
  }

  // Filter visits based on date filter
  const filteredVisits = useMemo(() => {
    if (!visitTargets || visitTargets.length === 0) return []
    
    let filtered = []
    
    if (dateFilter === 'All') {
      filtered = visitTargets
    } else {
      const grouped = groupVisitsByDate(visitTargets)
      switch (dateFilter) {
        case 'Today':
          filtered = grouped.today
          break
        case 'Tomorrow':
          filtered = grouped.tomorrow
          break
        case 'This Week':
          // This Week includes: Today + Tomorrow + Rest of this week (next 7 days)
          filtered = [...grouped.today, ...grouped.tomorrow, ...grouped.thisWeek]
          break
        case 'Upcoming':
          filtered = grouped.upcoming
          break
        case 'Past':
          filtered = grouped.past
          break
        default:
          filtered = visitTargets
      }
    }
    
    // Sort by visitDate (includes time) - earliest first
    return filtered.sort((a, b) => {
      if (!a.visitDate && !b.visitDate) return 0
      if (!a.visitDate) return 1
      if (!b.visitDate) return -1
      const dateA = new Date(a.visitDate)
      const dateB = new Date(b.visitDate)
      if (isNaN(dateA.getTime())) return 1
      if (isNaN(dateB.getTime())) return -1
      return dateA.getTime() - dateB.getTime()
    })
  }, [visitTargets, dateFilter])
  
  // Keep function for backward compatibility
  const getFilteredVisits = () => filteredVisits

  // Get today's visits center for map
  const getTodayVisitsCenter = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayVisits = visitTargets.filter(v => {
      if (!v.visitDate) return false
      const visitDate = new Date(v.visitDate)
      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
      return visitDateOnly.getTime() === today.getTime()
    })
    
    if (todayVisits.length === 0) return null
    
    // Calculate center of all today's visits
    let totalLat = 0
    let totalLng = 0
    let count = 0
    
    todayVisits.forEach(visit => {
      if (visit.latitude && visit.longitude) {
        totalLat += parseFloat(visit.latitude)
        totalLng += parseFloat(visit.longitude)
        count++
      }
    })
    
    if (count === 0) return null
    
    return {
      lat: totalLat / count,
      lng: totalLng / count
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
          
          // Ensure visitDate is properly formatted
          const processedTargets = validTargets.map(target => {
            if (target.visitDate) {
              // Ensure visitDate is a valid Date object
              const visitDate = new Date(target.visitDate)
              if (!isNaN(visitDate.getTime())) {
                return { ...target, visitDate: visitDate.toISOString() }
              }
            }
            return target
          })
          
          setVisitTargets(processedTargets)
          console.log(`✅ Loaded ${processedTargets.length} visit targets with dates`)
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
        // Ensure visitDate is properly formatted
        const processedTargets = validTargets.map(target => {
          if (target.visitDate) {
            const visitDate = new Date(target.visitDate)
            if (!isNaN(visitDate.getTime())) {
              return { ...target, visitDate: visitDate.toISOString() }
            }
          }
          return target
        })
        
        setVisitTargets(processedTargets)
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
        targetName: requestForm.targetName || requestForm.name, // Add target name to payload
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
        customerName: requestForm.customerName || '', // Add customer name to payload
        customerId: requestForm.customerId || '', // Add customer ID for reference
      }

      const result = await createVisitRequest(payload)
      if (result?.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Request Submitted!',
          text: result.message || 'Your visit request has been submitted. Admin will review and approve it.',
          confirmButtonColor: '#e9931c',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: true
        })
        setShowRequestVisitModal(false)
        setRequestForm({
          customerId: '',
          customerName: '',
          name: '',
          targetName: '',
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

  // Get user location on mount and refresh periodically
  useEffect(() => {
    let retryCount = 0
    const MAX_RETRIES = 5
    
    const fetchLocation = () => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser')
        addNotification({
          message: '⚠️ Location services are not supported by your browser',
          type: 'warning',
        })
        return
      }
      
      getCurrentLocation()
        .then((location) => {
          if (location && location.latitude && location.longitude) {
            setUserLocation(location)
            console.log('Location updated:', location)
            retryCount = 0 // Reset retry count on success
          } else {
            console.warn('Invalid location received:', location)
            retryLocation()
          }
        })
        .catch((error) => {
          console.error('Error getting location:', error)
          retryLocation()
        })
    }
    
    const retryLocation = () => {
      if (retryCount < MAX_RETRIES && !userLocation) {
        retryCount++
        const delay = Math.min(5000 * retryCount, 30000) // Exponential backoff, max 30s
        console.log(`Retrying location fetch (attempt ${retryCount}/${MAX_RETRIES}) in ${delay/1000}s...`)
        setTimeout(() => {
          if (!userLocation) {
            fetchLocation()
          }
        }, delay)
      } else if (retryCount >= MAX_RETRIES && !userLocation) {
        console.error('Failed to get location after multiple retries')
        addNotification({
          message: '⚠️ Unable to get your location. Please check browser permissions and try refreshing the page.',
          type: 'warning',
        })
      }
    }
    
    // Get location immediately
    fetchLocation()
    
    // Refresh location every 30 seconds when not tracking
    const locationRefreshInterval = setInterval(() => {
      if (!isTracking && !userLocation) {
        fetchLocation()
      }
    }, 30000)
    
    return () => clearInterval(locationRefreshInterval)
  }, [])

  // Load active tracking session on mount - Only restore if pending visits exist
  useEffect(() => {
    const loadActiveTracking = async () => {
      try {
        // First load visit targets to check if any pending visits exist
        const visitTargetsResult = await getVisitTargets()
        let hasPendingVisits = false
        
        if (visitTargetsResult.success && visitTargetsResult.data) {
          hasPendingVisits = visitTargetsResult.data.some(t => 
            t.status === 'Pending' || t.status === 'In Progress'
          )
        }
        
        // Only restore tracking if there are pending visits
        if (!hasPendingVisits) {
          console.log('No pending visits found, skipping tracking restoration')
          // Stop any active tracking in backend if no visits
          try {
            const active = await getActiveTracking()
            if (active && (active._id || active.id)) {
              console.log('Stopping active tracking - no pending visits')
              await stopTracking(active._id || active.id, active.startingKilometers || '0', null, null, null, null)
            }
          } catch (error) {
            console.error('Error stopping tracking:', error)
          }
          return
        }
        
        // If pending visits exist, restore tracking
        const active = await getActiveTracking()
        if (active && (active._id || active.id)) {
          setActiveTrackingId(active._id || active.id)
          // Restore tracking state when active tracking is found AND pending visits exist
          setIsTracking(true)
          // Restore starting kilometers and meter reading
          if (active.startingKilometers) {
            setStartingKilometers(active.startingKilometers.toString())
            setMeterReading(active.startingKilometers.toString())
          }
          console.log('Active tracking restored:', active._id || active.id)
        }
      } catch (error) {
        console.error('Error loading active tracking:', error)
      }
    }
    loadActiveTracking()
  }, [])

  // Restore route when tracking is restored and location/targets are available
  useEffect(() => {
    if (isTracking && visitTargets.length > 0 && !routeToVisitTarget) {
      // Wait for user location if not available
      if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
        console.log('Waiting for user location to restore route...')
        // Try to get location again
        getCurrentLocation()
          .then((location) => {
            if (location && location.latitude && location.longitude) {
              setUserLocation(location)
            }
          })
          .catch((error) => {
            console.error('Error getting location for route restoration:', error)
          })
        return
      }
      
      // Find first pending visit target for route (prioritize today's visits)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayPendingTarget = visitTargets.find(t => {
        if (t.status !== 'Pending' && t.status !== 'In Progress') return false
        if (!t.visitDate) return false
        const visitDate = new Date(t.visitDate)
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
        return visitDateOnly.getTime() === today.getTime()
      })
      
      // If no today's visit, find any pending target
      const firstPendingTarget = todayPendingTarget || visitTargets.find(t => t.status === 'Pending' || t.status === 'In Progress')
      
      if (firstPendingTarget && firstPendingTarget.latitude && firstPendingTarget.longitude) {
        setRouteToVisitTarget({
          from: { lat: userLocation.latitude, lng: userLocation.longitude },
          to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
          target: firstPendingTarget
        })
        console.log('Route restored for tracking:', firstPendingTarget.name)
      }
    }
  }, [isTracking, userLocation, visitTargets, routeToVisitTarget])

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
          // Only update location if it changed significantly (more than 10 meters) or first update
          const shouldUpdateLocation = () => {
            if (!lastMapLocationRef.current) return true
            
            const lastLoc = lastMapLocationRef.current
            const distance = calculateDistance(
              lastLoc.latitude,
              lastLoc.longitude,
              position.latitude,
              position.longitude
            )
            
            // Update if moved more than 10 meters (to reduce map flickering)
            return distance > 10
          }
          
          // Throttle location updates to map (max once per 2 seconds)
          const now = Date.now()
          const lastUpdate = locationUpdateThrottleRef.current || 0
          const timeSinceLastUpdate = now - lastUpdate
          
          if (shouldUpdateLocation() && timeSinceLastUpdate >= 2000) {
            setUserLocation(position)
            lastMapLocationRef.current = position
            locationUpdateThrottleRef.current = now
          }
          
          // Always check proximity (uses position directly, not state)
          checkVisitTargetProximity(position)
          
          // Send location to backend (only if logged in)
          const token = localStorage.getItem('token')
          if (token && position.latitude && position.longitude) {
            // Check if we should send location update (every 30 seconds or if location changed significantly)
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
      lastMapLocationRef.current = null
      locationUpdateThrottleRef.current = null
    }

    return () => {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
      }
    }
  }, [isTracking]) // Removed visitTargets and userLocation from dependencies to prevent unnecessary re-renders

  // Check for missed/remaining visits and show notifications
  const checkMissedVisits = () => {
    // Removed all visit completion alerts as per requirement
    // No notifications will be shown for today's visits or missed visits
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
    if (!target || !target.latitude || !target.longitude) return
    
    setSelectedVisitTarget(target)
    setShowVisitTargetModal(true) // Open modal when target is clicked
    
    // Update map to center on clicked visit ONLY if tracking is NOT active
    // If tracking is active, don't update map center (user requirement)
    if (!isTracking) {
      // Map center will update via useMemo when selectedVisitTarget changes
    } else {
      // When tracking is active, only update route if needed, but don't change map center
      if (userLocation) {
        setRouteToVisitTarget({
          from: { lat: userLocation.latitude, lng: userLocation.longitude },
          to: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
          target: target
        })
      }
    }
  }

  // Handle mark as completed - with meter reading
  const handleMarkAsCompleted = async () => {
    if (!selectedVisitTarget) return

    // Show completion modal to get meter reading
    // Clear ending kilometers for individual visit completion (not required)
    setEndingKilometers('')
    setEndingMeterImage(null)
    setShowCompletionModal(true)
  }

  // Handle complete target with meter reading
  const handleCompleteTarget = async () => {
    if (!selectedVisitTarget) return

    try {
      // Validate visited area image is required for each visit (check both single and array)
      if (!visitedAreaImage && (!visitedAreaImages || visitedAreaImages.length === 0)) {
        await Swal.fire({
          icon: 'warning',
          title: 'Visited Area Picture Required',
          text: 'Please upload at least one visited area picture. It is required to complete this visit.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // For individual visit completion, ending kilometers are NOT required
      // They are only required at shift end (after all visits are completed)
      // Use route distance or estimated kilometers for calculation

      const start = parseFloat(startingKilometers || selectedVisitTarget.startingKilometers || 0)
      
      // Calculate actual kilometers using route distance or estimated
      let actualKm = '0'
      let estimatedKmValue = 0
      
      // Use route distance if available
      if (routeDistanceKm) {
        const routeKm = typeof routeDistanceKm === 'number' ? routeDistanceKm : parseFloat(routeDistanceKm)
        if (!isNaN(routeKm) && routeKm > 0) {
          actualKm = routeKm.toFixed(2)
          estimatedKmValue = routeKm
        }
      }
      
      // If no route distance, use estimated kilometers
      if (estimatedKmValue === 0 && estimatedKilometers) {
        const estKm = parseFloat(estimatedKilometers)
        if (!isNaN(estKm) && estKm > 0) {
          actualKm = estKm.toFixed(2)
          estimatedKmValue = estKm
        }
      }
      
      // If still no value, use 0 (will be calculated later at shift end)
      if (estimatedKmValue === 0) {
        estimatedKmValue = 0
        actualKm = '0'
      }

      // Update visit target with completion data
      // Note: meterImage (ending meter) will be saved only at shift end, not per visit
      // endingKilometers will be set at shift end, not per visit
      // IMPORTANT: Do NOT send endingKilometers field at all for individual visits
      // Backend validation checks if endingKilometers < startingKilometers, and null would trigger it
      // Combine single image and array images (remove duplicates)
      const allVisitedImages = []
      if (visitedAreaImage && !allVisitedImages.includes(visitedAreaImage)) {
        allVisitedImages.push(visitedAreaImage)
      }
      if (Array.isArray(visitedAreaImages) && visitedAreaImages.length > 0) {
        visitedAreaImages.forEach(img => {
          if (img && !allVisitedImages.includes(img)) {
            allVisitedImages.push(img)
          }
        })
      }

      const updateData = {
        status: 'Completed',
        // endingKilometers: NOT INCLUDED - will be set at shift end only
        estimatedKilometers: estimatedKmValue,
        // meterImage: NOT INCLUDED - will be saved only at shift end
        visitedAreaImage: allVisitedImages[0] || null, // First image for backward compatibility
        visitedAreaImages: allVisitedImages.length > 0 ? allVisitedImages : undefined, // Array of multiple images
        comments: targetComments || selectedVisitTarget.comments || '',
      }

      if (startingKilometers) {
        updateData.startingKilometers = parseFloat(startingKilometers)
      }

      const result = await updateVisitTargetStatus(selectedVisitTarget._id || selectedVisitTarget.id, updateData)

      if (result.success) {
        // Update local state
        const updatedTargets = visitTargets.map(target => 
          target._id === selectedVisitTarget._id || target.id === selectedVisitTarget.id
            ? { ...target, status: 'Completed', completedAt: new Date(), ...updateData }
            : target
        )
        setVisitTargets(updatedTargets)
        
        // Store completed visit data for display
        const completedVisitData = {
          ...selectedVisitTarget,
          status: 'Completed',
          completedAt: new Date(),
          ...updateData,
          actualKilometers: actualKm
        }
        setSelectedVisitTarget(completedVisitData)
        
        // Find next pending visit for automatic route setting
        const todayForNext = new Date()
        todayForNext.setHours(0, 0, 0, 0)
        const todayPendingTarget = updatedTargets.find(t => {
          if (t.status !== 'Pending' && t.status !== 'In Progress') return false
          if (t._id === selectedVisitTarget._id || t.id === selectedVisitTarget.id) return false // Exclude just completed
          if (!t.visitDate) return false
          const visitDate = new Date(t.visitDate)
          const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
          return visitDateOnly.getTime() === todayForNext.getTime()
        })
        
        const nextPendingTarget = todayPendingTarget || updatedTargets.find(t => 
          (t.status === 'Pending' || t.status === 'In Progress') && 
          (t._id !== selectedVisitTarget._id && t.id !== selectedVisitTarget.id)
        )
        
        // Set ending kilometers as starting kilometers for next visit
        // Use route distance + starting kilometers if available, otherwise keep current starting
        if (startingKilometers) {
          const startKm = parseFloat(startingKilometers)
          if (!isNaN(startKm) && estimatedKmValue > 0) {
            const nextStartKm = startKm + estimatedKmValue
            setStartingKilometers(nextStartKm.toFixed(2))
            setMeterReading(nextStartKm.toFixed(2))
          }
        }
        
        // Auto-set route to next visit if available
        if (nextPendingTarget && userLocation && isTracking) {
          setRouteToVisitTarget({
            from: { lat: userLocation.latitude, lng: userLocation.longitude },
            to: { lat: parseFloat(nextPendingTarget.latitude), lng: parseFloat(nextPendingTarget.longitude) },
            target: nextPendingTarget
          })
        }
        
        // Close modals but keep completion modal open to show continue option
        setShowVisitTargetModal(false)
        
        // Show success SweetAlert for visit completion
        await Swal.fire({
          icon: 'success',
          title: '🎉 Visit Completed!',
          html: `
            <div class="text-center">
              <p class="text-lg mb-2"><strong>${selectedVisitTarget.name}</strong></p>
              <p class="text-sm text-gray-600 mb-2">Distance: <strong>${actualKm} km</strong></p>
              <p class="text-xs text-gray-500">Visit marked as completed successfully!</p>
            </div>
          `,
          confirmButtonColor: '#e9931c',
          timer: 3000,
          timerProgressBar: true
        })
        
        // Also add notification
        addNotification({
          message: `🎉 Visit Completed: ${selectedVisitTarget.name} | Distance: ${actualKm} km`,
          type: 'success',
        })

        // Check if all visits are completed
        const todayForCheck = new Date()
        todayForCheck.setHours(0, 0, 0, 0)
        const allTodayVisits = updatedTargets.filter(t => {
          if (!t.visitDate) return false
          const visitDate = new Date(t.visitDate)
          const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
          return visitDateOnly.getTime() === todayForCheck.getTime()
        })
        const completedTodayVisits = allTodayVisits.filter(t => t.status === 'Completed')
        const pendingTodayVisits = allTodayVisits.filter(t => t.status === 'Pending' || t.status === 'In Progress')
        
        // If all today's visits are completed, show shift end modal
        if (pendingTodayVisits.length === 0 && completedTodayVisits.length > 0) {
          // Close completion modal
          setShowCompletionModal(false)
          // Calculate ending kilometers from starting + estimated for shift end
          // This will be updated when user uploads ending meter image at shift end
          if (startingKilometers && estimatedKmValue > 0) {
            const startKm = parseFloat(startingKilometers)
            if (!isNaN(startKm)) {
              const calculatedEnd = startKm + estimatedKmValue
              setShiftEndingKilometers(calculatedEnd.toFixed(2))
            }
          }
          // Show shift end modal for ending meter image
          setShowShiftEndModal(true)
        } else {
          // Clear ending form data but keep completion modal open for continue
          // Make sure ending kilometers are cleared for next visit
          setEndingKilometers('')
          setEndingMeterImage(null)
          setVisitedAreaImage(null)
          setVisitedAreaImages([])
          setEstimatedKilometers('')
          setTargetComments('')
          // Keep completion modal open to show continue option
        }
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Error marking target as completed',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error marking target as completed:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error marking target as completed. Please try again.',
        confirmButtonColor: '#e9931c'
      })
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
          // Filter to reasonable odometer readings (typically 4-7 digits, 1000-999999)
          const validNumbers = numbers
            .map(n => parseInt(n))
            .filter(n => n >= 1000 && n <= 999999) // Reasonable odometer range
          
          if (validNumbers.length > 0) {
            // Get the largest valid number (likely the odometer reading)
            const largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
            setStartingKilometers(largestNumber)
          } else {
            // If no valid numbers in range, try all numbers but prefer longer ones
            const allNumbers = numbers.map(n => parseInt(n))
            const largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
            setStartingKilometers(largestNumber)
          }
        } else {
          setStartingKilometers('')
          Swal.fire({
            icon: 'warning',
            title: 'OCR Failed',
            text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
            confirmButtonColor: '#e9931c',
            timer: 3000,
            timerProgressBar: true
          })
        }
        
        await worker.terminate()
      } catch (error) {
        console.error('OCR Error:', error)
        Swal.fire({
          icon: 'error',
          title: 'OCR Error',
          text: 'Error extracting kilometers from image. Please try again.',
          confirmButtonColor: '#e9931c'
        })
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
            // Filter to reasonable odometer readings (typically 4-7 digits, 1000-999999)
            const validNumbers = numbers
              .map(n => parseInt(n))
              .filter(n => n >= 1000 && n <= 999999) // Reasonable odometer range
            
            if (validNumbers.length > 0) {
              // Get the largest valid number (likely the odometer reading)
              const largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
              setStartingKilometers(largestNumber)
            } else {
              // If no valid numbers in range, try all numbers but prefer longer ones
              const allNumbers = numbers.map(n => parseInt(n))
              const largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
              setStartingKilometers(largestNumber)
            }
          } else {
            setStartingKilometers('')
            Swal.fire({
              icon: 'warning',
              title: 'OCR Failed',
              text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
              confirmButtonColor: '#e9931c',
              timer: 3000,
              timerProgressBar: true
            })
          }
          
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          Swal.fire({
            icon: 'error',
            title: 'OCR Error',
            text: 'Error extracting kilometers from image. Please try again.',
            confirmButtonColor: '#e9931c'
          })
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
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Handle multiple files
    const newImages = []
    let loadedCount = 0

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageDataUrl = event.target.result
        newImages.push(imageDataUrl)
        loadedCount++

        // When all files are loaded, update state
        if (loadedCount === files.length) {
          setVisitedAreaImages(prev => [...prev, ...newImages])
          // Also set first image as visitedAreaImage for backward compatibility
          if (newImages.length > 0 && !visitedAreaImage) {
            setVisitedAreaImage(newImages[0])
          }
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // Handle camera capture for visited area
  const handleVisitedAreaCameraCapture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true // Allow multiple images
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = (e) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      const newImages = []
      let loadedCount = 0

      files.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageDataUrl = event.target.result
          newImages.push(imageDataUrl)
          loadedCount++

          if (loadedCount === files.length) {
            setVisitedAreaImages(prev => [...prev, ...newImages])
            if (newImages.length > 0 && !visitedAreaImage) {
              setVisitedAreaImage(newImages[0])
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }
    input.click()
  }

  // Handle camera capture for ending meter
  // NOTE: This should NOT be used for individual visits - only for shift end
  const handleEndingMeterCameraCapture = async () => {
    // Only allow if we're in shift end modal, not individual visit completion
    // If we have a selectedVisitTarget and we're in completion modal (not shift end), don't process
    if (selectedVisitTarget && showCompletionModal && !showShiftEndModal) {
      // Don't process ending meter image for individual visits
      setEndingMeterImage(null)
      setEndingKilometers('')
      Swal.fire({
        icon: 'info',
        title: 'Ending Meter Not Required',
        text: 'Ending meter image is only required at shift end (after all visits are completed). For individual visits, only visited area picture is needed.',
        confirmButtonColor: '#e9931c',
        timer: 3000,
        timerProgressBar: true
      })
      return
    }

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
            // Filter to reasonable odometer readings (typically 4-7 digits, 1000-999999)
            const validNumbers = numbers
              .map(n => parseInt(n))
              .filter(n => n >= 1000 && n <= 999999) // Reasonable odometer range
            
            let largestNumber
            if (validNumbers.length > 0) {
              // Get the largest valid number (likely the odometer reading)
              largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
            } else {
              // If no valid numbers in range, try all numbers but prefer longer ones
              const allNumbers = numbers.map(n => parseInt(n))
              largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
            }
            
            // Only set ending kilometers if we're in shift end mode
            // For individual visits, don't set ending kilometers at all - clear everything
            if (showShiftEndModal) {
              setShiftEndingKilometers(largestNumber)
            } else {
              // For individual visits, clear ending kilometers and image
              setEndingKilometers('')
              setEndingMeterImage(null)
              // Show info message
              Swal.fire({
                icon: 'info',
                title: 'Ending Meter Not Required',
                text: 'Ending meter image is only required at shift end. For individual visits, only visited area picture is needed.',
                confirmButtonColor: '#e9931c',
                timer: 3000,
                timerProgressBar: true
              })
            }
          } else {
            if (showShiftEndModal) {
              setShiftEndingKilometers('')
            } else {
              setEndingKilometers('')
            }
            Swal.fire({
              icon: 'warning',
              title: 'OCR Failed',
              text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
              confirmButtonColor: '#e9931c',
              timer: 3000,
              timerProgressBar: true
            })
          }
          
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          Swal.fire({
            icon: 'error',
            title: 'OCR Error',
            text: 'Error extracting kilometers from image. Please try again.',
            confirmButtonColor: '#e9931c'
          })
          if (showShiftEndModal) {
            setShiftEndingKilometers('')
          } else {
            setEndingKilometers('')
          }
        } finally {
          setIsExtractingEnding(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle ending meter image upload
  // NOTE: This should NOT be used for individual visits - only for shift end
  // For individual visits, ending meter image is not required
  const handleEndingMeterImageUpload = async (e) => {
    // Only allow if we're in shift end modal, not individual visit completion
    // If we have a selectedVisitTarget and we're in completion modal (not shift end), don't process
    if (selectedVisitTarget && showCompletionModal && !showShiftEndModal) {
      // Don't process ending meter image for individual visits
      setEndingMeterImage(null)
      setEndingKilometers('')
      Swal.fire({
        icon: 'info',
        title: 'Ending Meter Not Required',
        text: 'Ending meter image is only required at shift end (after all visits are completed). For individual visits, only visited area picture is needed.',
        confirmButtonColor: '#e9931c',
        timer: 3000,
        timerProgressBar: true
      })
      return
    }

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
          // Filter to reasonable odometer readings (typically 4-7 digits, 1000-999999)
          const validNumbers = numbers
            .map(n => parseInt(n))
            .filter(n => n >= 1000 && n <= 999999) // Reasonable odometer range
          
          let largestNumber
          if (validNumbers.length > 0) {
            // Get the largest valid number (likely the odometer reading)
            largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
          } else {
            // If no valid numbers in range, try all numbers but prefer longer ones
            const allNumbers = numbers.map(n => parseInt(n))
            largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
          }
            // Only set ending kilometers if we're in shift end mode
            // For individual visits, don't set ending kilometers at all - clear everything
            if (showShiftEndModal) {
              setShiftEndingKilometers(largestNumber)
            } else {
              // For individual visits, clear ending kilometers and image
              setEndingKilometers('')
              setEndingMeterImage(null)
              // Show info message
              Swal.fire({
                icon: 'info',
                title: 'Ending Meter Not Required',
                text: 'Ending meter image is only required at shift end. For individual visits, only visited area picture is needed.',
                confirmButtonColor: '#e9931c',
                timer: 3000,
                timerProgressBar: true
              })
            }
          
          // Calculate distance only for shift end
          if (showShiftEndModal && startingKilometers && largestNumber) {
            const start = parseFloat(startingKilometers)
            const end = parseFloat(largestNumber)
            if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
              if (end >= start) {
                const distance = end - start
                // This is for shift end, not individual visit
              }
            }
          }
        } else {
          if (showShiftEndModal) {
            setShiftEndingKilometers('')
          } else {
            setEndingKilometers('')
          }
          Swal.fire({
            icon: 'warning',
            title: 'OCR Failed',
            text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
            confirmButtonColor: '#e9931c',
            timer: 3000,
            timerProgressBar: true
          })
        }
        
        await worker.terminate()
      } catch (error) {
        console.error('OCR Error:', error)
        Swal.fire({
          icon: 'error',
          title: 'OCR Error',
          text: 'Error extracting kilometers from image. Please try again.',
          confirmButtonColor: '#e9931c'
        })
        if (showShiftEndModal) {
          setShiftEndingKilometers('')
        } else {
          setEndingKilometers('')
        }
      } finally {
        setIsExtractingEnding(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle ending kilometers manual input
  // NOTE: This should NOT be used for individual visits - only for shift end
  // For individual visits, ending kilometers are not required
  const handleEndingKilometersChange = (e) => {
    // Only allow if we're in shift end modal, not individual visit completion
    if (selectedVisitTarget && showCompletionModal && !showShiftEndModal) {
      // Don't allow manual entry for individual visits - clear the value
      e.target.value = ''
      setEndingKilometers('')
      Swal.fire({
        icon: 'info',
        title: 'Ending Kilometers Not Required',
        text: 'Ending kilometers are only required at shift end (after all visits are completed). For individual visits, only visited area picture is needed.',
        confirmButtonColor: '#e9931c',
        timer: 3000,
        timerProgressBar: true
      })
      return
    }

    const value = e.target.value
    if (showShiftEndModal) {
      setShiftEndingKilometers(value)
    } else {
      // Only set if not in individual visit completion mode
      if (!selectedVisitTarget || !showCompletionModal) {
        setEndingKilometers(value)
      } else {
        // Clear for individual visits
        setEndingKilometers('')
      }
    }
    
    // Calculate distance traveled only if both values are valid (for shift end)
    if (showShiftEndModal && startingKilometers && value && value.trim() !== '') {
      const start = parseFloat(startingKilometers)
      const end = parseFloat(value)
      
      // Validate both are valid numbers
      if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
        if (end >= start) {
          const distance = end - start
          // This is for shift end calculation
        } else {
          // Ending is less than starting - validation will happen at shift end
        }
      }
    }
  }

  // Handle shift end - when all visits are completed
  const handleShiftEnd = async () => {
    try {
      // Validate ending kilometers - must be extracted from image
      if (!shiftEndingKilometers || shiftEndingKilometers.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: 'Ending Kilometers Required',
          text: 'Please upload ending meter image to extract kilometers. Manual entry is not allowed.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Validate ending meter image is required at shift end
      if (!shiftEndingMeterImage) {
        await Swal.fire({
          icon: 'warning',
          title: 'Ending Meter Image Required',
          text: 'Please upload ending meter image. It is required to complete the shift.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      const start = parseFloat(startingKilometers || meterReading || '0')
      const end = parseFloat(shiftEndingKilometers)
      
      if (isNaN(end) || end <= 0) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Ending Kilometers',
          text: 'Invalid ending kilometers. Please enter a valid number.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      if (start > 0 && end < start) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Kilometers',
          text: 'Ending kilometers cannot be less than starting kilometers.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Calculate total distance for the shift
      const totalDistance = start > 0 ? (end - start).toFixed(2) : '0'

      // Get all completed visits for today to collect images
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const completedVisits = visitTargets.filter(t => {
        if (t.status !== 'Completed') return false
        if (!t.visitDate) return false
        const visitDate = new Date(t.visitDate)
        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
        return visitDateOnly.getTime() === today.getTime()
      })

      // Stop tracking in backend
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
            shiftEndingKilometers,
            shiftEndingMeterImage,
            null, // Visited area image not needed at shift end
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
      }

      // Stop tracking locally
      setIsTracking(false)
      setShowShiftEndModal(false)
      
      // Clear form data
      setShiftEndingKilometers('')
      setShiftEndingMeterImage(null)
      setRouteToVisitTarget(null)
      
      // Show success SweetAlert for shift completion
      const result = await Swal.fire({
        icon: 'success',
        title: '✅ Shift Completed!',
        html: `
          <div class="text-center">
            <p class="text-lg mb-2">Great work today!</p>
            <p class="text-sm text-gray-600 mb-2">Total Distance: <strong>${totalDistance} km</strong></p>
            <p class="text-sm text-gray-600 mb-2">Visits Completed: <strong>${completedVisits.length}</strong></p>
            <p class="text-xs text-gray-500 mt-3">All shift photos are saved in the collage.</p>
          </div>
        `,
        confirmButtonColor: '#e9931c',
        confirmButtonText: 'View Photos',
        showCancelButton: true,
        cancelButtonText: 'Close',
        cancelButtonColor: '#6b7280'
      })
      
      // Show shift photo collage if user clicked "View Photos"
      if (result.isConfirmed) {
        setShowShiftPhotoCollage(true)
      }

      // Also add notification
      addNotification({
        message: `✅ Shift completed! Total distance: ${totalDistance} km | ${completedVisits.length} visits completed`,
        type: 'success',
      })
    } catch (error) {
      console.error('Error completing shift:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error completing shift. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  // Handle shift ending meter image upload
  const handleShiftEndingMeterImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageDataUrl = event.target.result
      setShiftEndingMeterImage(imageDataUrl)
      setIsExtractingShiftEnd(true)

      try {
        const worker = await createWorker('eng')
        const { data: { text } } = await worker.recognize(imageDataUrl)
        const numbers = text.match(/\d+/g)
        if (numbers && numbers.length > 0) {
          const validNumbers = numbers
            .map(n => parseInt(n))
            .filter(n => n >= 1000 && n <= 999999)
          
          let largestNumber
          if (validNumbers.length > 0) {
            largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
          } else {
            const allNumbers = numbers.map(n => parseInt(n))
            largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
          }
            setShiftEndingKilometers(largestNumber)
          } else {
            setShiftEndingKilometers('')
            Swal.fire({
              icon: 'warning',
              title: 'OCR Failed',
              text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
              confirmButtonColor: '#e9931c',
              timer: 3000,
              timerProgressBar: true
            })
          }
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          Swal.fire({
            icon: 'error',
            title: 'OCR Error',
            text: 'Error extracting kilometers from image. Please try again.',
            confirmButtonColor: '#e9931c'
          })
          setShiftEndingKilometers('')
      } finally {
        setIsExtractingShiftEnd(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle shift ending meter camera capture
  const handleShiftEndingMeterCameraCapture = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageDataUrl = event.target.result
        setShiftEndingMeterImage(imageDataUrl)
        setIsExtractingShiftEnd(true)

        try {
          const worker = await createWorker('eng')
          const { data: { text } } = await worker.recognize(imageDataUrl)
          const numbers = text.match(/\d+/g)
          if (numbers && numbers.length > 0) {
            const validNumbers = numbers
              .map(n => parseInt(n))
              .filter(n => n >= 1000 && n <= 999999)
            
            let largestNumber
            if (validNumbers.length > 0) {
              largestNumber = validNumbers.reduce((a, b) => a > b ? a : b).toString()
            } else {
              const allNumbers = numbers.map(n => parseInt(n))
              largestNumber = allNumbers.reduce((a, b) => a > b ? a : b).toString()
            }
            setShiftEndingKilometers(largestNumber)
          } else {
            setShiftEndingKilometers('')
            Swal.fire({
              icon: 'warning',
              title: 'OCR Failed',
              text: 'Could not extract kilometers from image. Please try again or upload a clearer image.',
              confirmButtonColor: '#e9931c',
              timer: 3000,
              timerProgressBar: true
            })
          }
          await worker.terminate()
        } catch (error) {
          console.error('OCR Error:', error)
          Swal.fire({
            icon: 'error',
            title: 'OCR Error',
            text: 'Error extracting kilometers from image. Please try again.',
            confirmButtonColor: '#e9931c'
          })
          setShiftEndingKilometers('')
        } finally {
          setIsExtractingShiftEnd(false)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle complete tracking
  const handleCompleteTracking = async () => {
    try {
      // Validate ending kilometers - must be extracted from image
      if (!endingKilometers || endingKilometers.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: 'Ending Kilometers Required',
          text: 'Please upload ending meter image to extract kilometers. Manual entry is not allowed.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Ending meter image NOT required for individual visits - only at shift end

      // Validate visited area image is required
      if (!visitedAreaImage) {
        await Swal.fire({
          icon: 'warning',
          title: 'Visited Area Picture Required',
          text: 'Please upload visited area picture. It is required to complete tracking.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      const start = parseFloat(startingKilometers)
      const end = parseFloat(endingKilometers)
      
      // Validate starting kilometers
      if (!startingKilometers || startingKilometers.trim() === '' || isNaN(start) || start <= 0) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Starting Kilometers',
          text: 'Invalid starting kilometers. Please check your starting reading.',
          confirmButtonColor: '#e9931c'
        })
        return
      }
      
      // Validate ending kilometers
      if (isNaN(end) || end <= 0) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Ending Kilometers',
          text: 'Invalid ending kilometers. Please enter a valid number.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      if (end < start) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Kilometers',
          text: 'Ending kilometers cannot be less than starting kilometers.',
          confirmButtonColor: '#e9931c'
        })
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

      // Show success SweetAlert
      await Swal.fire({
        icon: 'success',
        title: '✅ Tracking Completed!',
        html: `
          <div class="text-center">
            <p class="text-lg mb-2">Tracking session ended</p>
            <p class="text-sm text-gray-600">Distance Traveled: <strong>${distanceTraveled.toFixed(2)} km</strong></p>
          </div>
        `,
        confirmButtonColor: '#e9931c',
        timer: 3000,
        timerProgressBar: true
      })

      // Also add notification
      addNotification({
        message: `✅ Tracking completed! Distance traveled: ${distanceTraveled.toFixed(2)} km`,
        type: 'success',
      })

      // TODO: Save completion data to backend if needed
    } catch (error) {
      console.error('Error completing tracking:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error completing tracking. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  // Handle start tracking with starting kilometers
  const handleStartTracking = async () => {
    try {
      // Validate inputs
      if (!startingKilometers || startingKilometers.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: 'Starting Kilometers Required',
          text: 'Please enter starting kilometers to begin tracking.',
          confirmButtonColor: '#e9931c'
        })
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
          null // Visited area image removed from starting - only for ending
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
      setStartingKilometers('')
      
      // Try to get location if not available
      if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
        console.log('Location not available, attempting to fetch...')
        try {
          const location = await getCurrentLocation()
          if (location && location.latitude && location.longitude) {
            setUserLocation(location)
            console.log('Location fetched successfully:', location)
          }
        } catch (error) {
          console.error('Failed to fetch location:', error)
        }
      }
      
      // Find first pending visit target for route (prioritize today's visits)
      // Wait for location if not available yet
      const waitForLocationAndSetRoute = async () => {
        let attempts = 0
        const maxAttempts = 15 // Increased attempts
        
        // Get current location state
        let currentLocation = userLocation
        
        // If no location, try to fetch it
        while ((!currentLocation || !currentLocation.latitude || !currentLocation.longitude) && attempts < maxAttempts) {
          try {
            currentLocation = await getCurrentLocation()
            if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
              setUserLocation(currentLocation)
              break
            }
          } catch (error) {
            console.error(`Location fetch attempt ${attempts + 1} failed:`, error)
          }
          await new Promise(resolve => setTimeout(resolve, 1000))
          attempts++
        }
        
        // Use the fetched location or wait for state update
        const finalLocation = currentLocation || userLocation
        
        if (visitTargets && visitTargets.length > 0) {
          // First try to find today's pending visits
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayPendingTarget = visitTargets.find(t => {
            if (t.status !== 'Pending' && t.status !== 'In Progress') return false
            if (!t.visitDate) return false
            const visitDate = new Date(t.visitDate)
            const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
            return visitDateOnly.getTime() === today.getTime()
          })
          
          // If no today's visit, find any pending target
          const firstPendingTarget = todayPendingTarget || visitTargets.find(t => t.status === 'Pending' || t.status === 'In Progress')
          
          if (firstPendingTarget && firstPendingTarget.latitude && firstPendingTarget.longitude) {
            // Wait a bit more for location state to update if we just fetched it
            if (!finalLocation || !finalLocation.latitude || !finalLocation.longitude) {
              // Try one more time after a short delay
              setTimeout(() => {
                const stateLocation = userLocation
                if (stateLocation && stateLocation.latitude && stateLocation.longitude) {
                  setRouteToVisitTarget({
                    from: { lat: stateLocation.latitude, lng: stateLocation.longitude },
                    to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
                    target: firstPendingTarget
                  })
                  console.log('Route set to:', firstPendingTarget.name)
                }
              }, 2000)
            } else {
              setRouteToVisitTarget({
                from: { lat: finalLocation.latitude, lng: finalLocation.longitude },
                to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
                target: firstPendingTarget
              })
              console.log('Route set to:', firstPendingTarget.name)
            }
          } else {
            console.warn('No pending visit target found for route')
          }
        }
      }
      
      waitForLocationAndSetRoute()
    } catch (error) {
      console.error('Error in handleStartTracking:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error starting tracking. Please try again.',
        confirmButtonColor: '#e9931c'
      })
      setShowStartModal(false)
      setShowCountdown(false)
    }
  }

  // Auto-pause tracking if no pending visits available
  useEffect(() => {
    if (!isTracking) return
    
    // Check if there are any pending or in-progress visits
    const pendingVisits = visitTargets.filter(t => t.status === 'Pending' || t.status === 'In Progress')
    
    // If no pending visits and tracking is active, automatically pause tracking
    if (pendingVisits.length === 0) {
      console.log('No pending visits found, auto-pausing tracking...')
      
      // Stop tracking
      setIsTracking(false)
      setRouteToVisitTarget(null)
      
      // Stop location watching
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
        locationUpdateIntervalRef.current = null
      }
      
      // Show notification
      addNotification({
        message: '⏸️ Tracking paused automatically - No pending visits available',
        type: 'warning',
      })
      
      // Stop tracking in backend
      if (activeTrackingId) {
        stopTracking(activeTrackingId, meterReading || startingKilometers || '0', null, null, userLocation?.latitude || null, userLocation?.longitude || null)
          .then(() => {
            setActiveTrackingId(null)
            console.log('Tracking stopped in backend - no pending visits')
          })
          .catch((error) => {
            console.error('Error stopping tracking in backend:', error)
          })
      } else {
        // Try to get active tracking and stop it
        getActiveTracking()
          .then((active) => {
            if (active && (active._id || active.id)) {
              return stopTracking(active._id || active.id, active.startingKilometers || '0', null, null, null, null)
            }
          })
          .then(() => {
            console.log('Active tracking stopped from backend')
          })
          .catch((error) => {
            console.error('Error stopping active tracking:', error)
          })
      }
    }
  }, [visitTargets, isTracking])

  // Update route when visit targets change or user location updates
  useEffect(() => {
    if (!isTracking) return
    
    // Wait for user location if not available
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.log('Waiting for user location to generate route...')
      return
    }
    
    // Find first pending visit target (prioritize today's visits)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayPendingTarget = visitTargets.find(t => {
      if (t.status !== 'Pending' && t.status !== 'In Progress') return false
      if (!t.visitDate) return false
      const visitDate = new Date(t.visitDate)
      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
      return visitDateOnly.getTime() === today.getTime()
    })
    
    const firstPendingTarget = todayPendingTarget || visitTargets.find(t => t.status === 'Pending' || t.status === 'In Progress')
    
    if (firstPendingTarget && firstPendingTarget.latitude && firstPendingTarget.longitude) {
      const targetId = firstPendingTarget._id || firstPendingTarget.id
      
      // Check if route is already set to this target and location hasn't changed significantly
      if (routeToVisitTarget && routeToVisitTarget.target?._id === targetId) {
        // Only update if location changed significantly (more than 50 meters)
        const currentFrom = routeToVisitTarget.from
        const distance = calculateDistance(
          currentFrom.lat,
          currentFrom.lng,
          userLocation.latitude,
          userLocation.longitude
        )
        
        // Update route origin only if moved more than 50 meters (to reduce map flickering)
        if (distance > 50) {
          setRouteToVisitTarget({
            from: { lat: userLocation.latitude, lng: userLocation.longitude },
            to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
            target: firstPendingTarget
          })
        }
      } else {
        // Set new route
        setRouteToVisitTarget({
          from: { lat: userLocation.latitude, lng: userLocation.longitude },
          to: { lat: parseFloat(firstPendingTarget.latitude), lng: parseFloat(firstPendingTarget.longitude) },
          target: firstPendingTarget
        })
        console.log('Route generated to:', firstPendingTarget.name)
      }
    } else if (!firstPendingTarget) {
      // No pending targets, clear route
      setRouteToVisitTarget(null)
    }
  }, [visitTargets, userLocation, isTracking]) // Removed routeToVisitTarget from dependencies to prevent loops

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
        // Show success SweetAlert
        Swal.fire({
          icon: 'success',
          title: '🚀 Tracking Started!',
          html: `
            <div class="text-center">
              <p class="text-lg mb-2">Location tracking is now active</p>
              <p class="text-sm text-gray-600">Starting Kilometers: <strong>${meterReading} km</strong></p>
            </div>
          `,
          confirmButtonColor: '#e9931c',
          timer: 3000,
          timerProgressBar: true
        })
        
        // Also add notification
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

  // Memoize map center calculation (must be at top level, not in JSX)
  const mapCenter = useMemo(() => {
    // If tracking is active, don't update center on visit click - keep user location
    if (isTracking && userLocation && userLocation.latitude && userLocation.longitude) {
      return { lat: userLocation.latitude, lng: userLocation.longitude }
    }
    
    // Priority: selectedVisitTarget (when clicked) > userLocation > today's visits center > default
    if (selectedVisitTarget && selectedVisitTarget.latitude && selectedVisitTarget.longitude) {
      return { lat: parseFloat(selectedVisitTarget.latitude), lng: parseFloat(selectedVisitTarget.longitude) }
    }
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      return { lat: userLocation.latitude, lng: userLocation.longitude }
    }
    const todayCenter = getTodayVisitsCenter()
    if (todayCenter && todayCenter.lat && todayCenter.lng) {
      return todayCenter
    }
    return { lat: 28.6139, lng: 77.2090 }
  }, [
    isTracking, // Add isTracking to dependencies
    selectedVisitTarget?._id || selectedVisitTarget?.id,
    selectedVisitTarget?.latitude,
    selectedVisitTarget?.longitude,
    userLocation?.latitude,
    userLocation?.longitude,
    visitTargets.length
  ])

  // Memoize route info change handler (must be at top level, not in JSX)
  const handleRouteInfoChange = useCallback((routeInfo) => {
    if (routeInfo && routeInfo.distanceKm) {
      // Ensure distanceKm is a number
      const distance = typeof routeInfo.distanceKm === 'number' 
        ? routeInfo.distanceKm 
        : !isNaN(parseFloat(routeInfo.distanceKm)) 
          ? parseFloat(routeInfo.distanceKm) 
          : null
      
      if (distance !== null) {
        setRouteDistanceKm(distance)
        // Update estimated kilometers if route is available
        if (!estimatedKilometers || estimatedKilometers === '') {
          setEstimatedKilometers(distance.toString())
        }
      } else {
        setRouteDistanceKm(null)
      }
    } else {
      setRouteDistanceKm(null)
    }
  }, [estimatedKilometers])

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
              Proximity Alert: {PROXIMITY_DISTANCE_KM}km |               GPS: {userLocation && userLocation.latitude && userLocation.longitude ? (
                <span>Active ({userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)})</span>
              ) : (
                <span>Getting location...</span>
              )}
              {isTracking && (routeDistanceKm || estimatedKilometers) && (
                <span className="ml-3 inline-flex items-center gap-1">
                  <span className="text-[#e9931c] font-semibold">
                    Est. Distance: {routeDistanceKm && typeof routeDistanceKm === 'number' ? `${routeDistanceKm.toFixed(2)} km` : routeDistanceKm && !isNaN(parseFloat(routeDistanceKm)) ? `${parseFloat(routeDistanceKm).toFixed(2)} km` : estimatedKilometers ? `${estimatedKilometers} km` : 'Calculating...'}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowRequestVisitModal(true)
                // Load customers when modal opens
                if (customers.length === 0) {
                  loadCustomers()
                }
              }}
              className="px-2 md:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 bg-gray-600 text-white hover:bg-gray-700"
              title="Request a new visit (admin approval required)"
            >
              <FaMapMarkerAlt className="w-4 h-4" />
              <span className="hidden md:inline text-sm" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Request Visit</span>
            </button>
            <button
              onClick={() => {
                if (isTracking) {
                  // Show completion modal instead of directly stopping
                  // Clear ending kilometers for individual visit completion (not required)
    setEndingKilometers('')
    setEndingMeterImage(null)
    setShowCompletionModal(true)
                } else {
                  setShowStartModal(true)
                }
              }}
              className={`px-2 md:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                isTracking
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title={isTracking ? 'Pause Tracking' : 'Start Tracking'}
            >
              {isTracking ? (
                <>
                  <FaPause className="w-4 h-4" />
                  <span className="hidden md:inline text-sm" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Pause Tracking</span>
                </>
              ) : (
                <>
                  <FaPlay className="w-4 h-4" />
                  <span className="hidden md:inline text-sm" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Start Tracking</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="fixed top-4 right-4 z-[9998] space-y-2" style={{ pointerEvents: 'none' }}>
          {notifications.map((notification, index) => (
            <div
              key={notification.id}
              style={{
                marginTop: index > 0 ? '8px' : '0',
                pointerEvents: 'auto',
              }}
            >
              <NotificationToast
                message={notification.message}
                type={notification.type}
                onClose={() => removeNotification(notification.id)}
                duration={5000}
              />
            </div>
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
                  visitTargets={visitTargets.filter(target => 
                    target.status !== 'Completed' && target.status !== 'completed'
                  )}
                  userLocation={userLocation}
                  onMarkerClick={handleVisitTargetClick}
                  center={mapCenter}
                  zoom={11}
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
                  onRouteInfoChange={handleRouteInfoChange}
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
              {/* Tabs */}
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
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4 bg-gray-50 rounded-t-lg">
                  <button
                    onClick={() => setRightPanelTab('visits')}
                    className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                      rightPanelTab === 'visits'
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                  >
                    <FaMapMarkerAlt className="w-4 h-4" />
                    Visits
                  </button>
                  <button
                    onClick={() => {
                      setRightPanelTab('tasks')
                      if (followUps.length === 0) {
                        loadFollowUps()
                      }
                    }}
                    className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                      rightPanelTab === 'tasks'
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                  >
                    <FaTasks className="w-4 h-4" />
                    Tasks
                  </button>
                  <button
                    onClick={() => {
                      setRightPanelTab('samples')
                      if (samples.length === 0) {
                        loadSamples()
                      }
                    }}
                    className={`flex-1 px-4 py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                      rightPanelTab === 'samples'
                        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                  >
                    <FaFlask className="w-4 h-4" />
                    Samples
                  </button>
                </div>

                {/* Tab Content */}
                {rightPanelTab === 'visits' && (
                  <>
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
                {(() => {
                  const filtered = getFilteredVisits()
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <p className="text-gray-600 font-medium">
                          {dateFilter !== 'All' 
                            ? `No visit targets for ${dateFilter}` 
                            : 'No visit targets assigned'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {dateFilter !== 'All' 
                            ? 'Try selecting a different date filter' 
                            : 'Admin will assign visit targets to you'}
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                      {filtered.map((target) => {
                      const targetId = target._id || target.id
                      const isSelected = selectedVisitTarget && (selectedVisitTarget._id === targetId || selectedVisitTarget.id === targetId)
                      return (
                        <div
                          key={targetId}
                          onClick={() => {
                            handleVisitTargetClick(target)
                            // Update map center on visit click
                            if (target.latitude && target.longitude) {
                              setSelectedVisitTarget(target)
                              // Map will automatically center on selectedVisitTarget
                            }
                          }}
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
                  )
                })()}
                
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
                                    // Sort by visit date (includes time) - earliest first
                                    if (a.visitDate && b.visitDate) {
                                      return new Date(a.visitDate) - new Date(b.visitDate)
                                    }
                                    if (!a.visitDate && !b.visitDate) {
                                      // Then by status if no date
                                      const statusOrder = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 }
                                      return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
                                    }
                                    if (!a.visitDate) return 1
                                    if (!b.visitDate) return -1
                                    return 0
                                  })
                                  .map((target) => {
                        const targetId = target._id || target.id
                        const isSelected = selectedVisitTarget && (selectedVisitTarget._id === targetId || selectedVisitTarget.id === targetId)
                        return (
                          <div
                            key={targetId}
                            onClick={() => {
                              // handleVisitTargetClick already handles map update and route
                              handleVisitTargetClick(target)
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
                                    ? 'bg-gray-600 text-white hover:bg-gray-700' 
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
                            // Sort by visit date (includes time) - earliest first
                            if (a.visitDate && b.visitDate) {
                              return new Date(a.visitDate) - new Date(b.visitDate)
                            }
                            if (!a.visitDate && !b.visitDate) {
                              // Then by status if no date
                              const statusOrder = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 }
                              return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4)
                            }
                            if (!a.visitDate) return 1
                            if (!b.visitDate) return -1
                            return 0
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
                                        ? 'bg-gray-600 text-white hover:bg-gray-700' 
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
                  </>
                )}

                {rightPanelTab === 'tasks' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-700">Tasks (Follow-ups)</h3>
                    </div>
                    {followUps.length === 0 ? (
                      <div className="text-center py-8">
                        <FaTasks className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">No tasks assigned</p>
                        <p className="text-sm text-gray-500 mt-1">Tasks will appear here once assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                        {followUps
                          .filter(f => f.status !== 'Completed')
                          .sort((a, b) => {
                            if (a.dueDate && b.dueDate) {
                              return new Date(a.dueDate) - new Date(b.dueDate)
                            }
                            return 0
                          })
                          .map((task) => (
                            <div
                              key={task._id || task.id}
                              className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-800">{task.customerName || 'No Customer'}</p>
                                  <p className="text-sm text-gray-600 mt-1">{task.type || 'Follow-up'}</p>
                                  {task.dueDate && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Due: {new Date(task.dueDate).toLocaleDateString()}
                                    </p>
                                  )}
                                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold ${
                                    task.status === 'Completed'
                                      ? 'bg-green-100 text-green-800'
                                      : task.status === 'Today'
                                      ? 'bg-blue-100 text-blue-800'
                                      : task.status === 'Overdue'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {task.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {rightPanelTab === 'samples' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-700">Sample Tracker</h3>
                    </div>
                    {samples.length === 0 ? (
                      <div className="text-center py-8">
                        <FaFlask className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">No samples assigned</p>
                        <p className="text-sm text-gray-500 mt-1">Samples will appear here once assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                        {samples
                          .filter(s => s.status !== 'Completed')
                          .sort((a, b) => {
                            if (a.visitDate && b.visitDate) {
                              return new Date(a.visitDate) - new Date(b.visitDate)
                            }
                            return 0
                          })
                          .map((sample) => (
                            <div
                              key={sample._id || sample.id}
                              onClick={() => {
                                // Update map if sample has location
                                if (sample.latitude && sample.longitude) {
                                  setSelectedVisitTarget({
                                    latitude: sample.latitude,
                                    longitude: sample.longitude,
                                    name: sample.customerName || 'Sample Location',
                                    _id: sample._id || sample.id
                                  })
                                  // Map will automatically center on selectedVisitTarget
                                }
                              }}
                              className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-800">{sample.customerName || 'No Customer'}</p>
                                  {sample.product && (
                                    <p className="text-sm text-gray-600 mt-1">Product: {sample.product.name || sample.product}</p>
                                  )}
                                  {sample.visitDate && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Visit Date: {new Date(sample.visitDate).toLocaleDateString()}
                                    </p>
                                  )}
                                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-semibold ${
                                    sample.status === 'Completed'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {sample.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Tracking Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-slideUp mx-auto">
            {/* Modal Header - Removed colored header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">Start Tracking</h3>
              <button
                onClick={() => {
                  setShowStartModal(false)
                  setUploadedImage(null)
                  setStartingKilometers('')
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-1.5 sm:p-2 transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="speedometer-upload"
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all text-sm font-medium placeholder:text-gray-400"
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
          setVisitedAreaImages([])
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
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5"
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
            {/* Modal Header - Removed colored header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                {selectedVisitTarget ? `Complete: ${selectedVisitTarget.name}` : 'Complete Tracking'}
              </h3>
              <button
                onClick={() => {
                  setShowCompletionModal(false)
                  setEndingKilometers('')
                  setEndingMeterImage(null)
                  setEstimatedKilometers('')
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-1.5 sm:p-2 transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

              {/* Estimated Kilometers Display */}
              {(routeDistanceKm || estimatedKilometers) && (
                <div className="mb-5 sm:mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">Estimated Distance</p>
                  <p className="text-2xl font-bold text-green-700">
                    {routeDistanceKm && typeof routeDistanceKm === 'number' ? `${routeDistanceKm.toFixed(2)} km` : routeDistanceKm && !isNaN(parseFloat(routeDistanceKm)) ? `${parseFloat(routeDistanceKm).toFixed(2)} km` : estimatedKilometers ? `${estimatedKilometers} km` : 'Calculating...'}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Based on route calculation</p>
                </div>
              )}

              {/* Ending Meter Image Upload - REMOVED for individual visits */}
              {/* Ending meter image will be required only when all visits are completed (shift end modal) */}

              {/* Ending Kilometers - NOT SHOWN for individual visits (only at shift end) */}
              {/* Individual visits don't need ending kilometers - only visited area image */}

              {/* Distance Traveled Display - Only Current Visit */}
              {selectedVisitTarget && selectedVisitTarget.status === 'Completed' && selectedVisitTarget.actualKilometers ? (
                <div className="mb-5 sm:mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">This Visit Distance</p>
                  <p className="text-2xl font-bold text-green-700">{selectedVisitTarget.actualKilometers} km</p>
                  <p className="text-xs text-green-600 mt-1">Distance traveled for this visit only</p>
                </div>
              ) : estimatedKilometers && routeDistanceKm ? (
                <div className="mb-5 sm:mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">Estimated Distance</p>
                  <p className="text-2xl font-bold text-green-700">{estimatedKilometers} km</p>
                  <p className="text-xs text-green-600 mt-1">Based on route calculation</p>
                </div>
              ) : null}

              {/* Remaining Visits Count */}
              {selectedVisitTarget && selectedVisitTarget.status === 'Completed' && (
                (() => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const remainingVisits = visitTargets.filter(t => {
                    if (t.status === 'Completed') return false
                    if (t.status !== 'Pending' && t.status !== 'In Progress') return false
                    if (!t.visitDate) return false
                    const visitDate = new Date(t.visitDate)
                    const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                    return visitDateOnly.getTime() === today.getTime()
                  })
                  const nextVisit = remainingVisits.find(t => {
                    if (!t.visitDate) return false
                    const visitDate = new Date(t.visitDate)
                    const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                    return visitDateOnly.getTime() === today.getTime()
                  }) || remainingVisits[0]
                  
                  return remainingVisits.length > 0 ? (
                    <div className="mb-5 sm:mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <p className="text-sm font-semibold text-blue-800 mb-1">Remaining Visits</p>
                      <p className="text-2xl font-bold text-blue-700">{remainingVisits.length}</p>
                      {nextVisit && (
                        <p className="text-xs text-blue-600 mt-1">Next: {nextVisit.name}</p>
                      )}
                    </div>
                  ) : null
                })()
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
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="visited-area-upload-completion"
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleVisitedAreaImageUpload}
                  className="hidden"
                  id="visited-area-upload-completion"
                />
                <label
                  htmlFor="visited-area-upload-completion"
                  className={`flex flex-col items-center justify-center w-full h-32 sm:h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                    (visitedAreaImage || (visitedAreaImages && visitedAreaImages.length > 0))
                      ? 'border-green-300 bg-green-50' 
                      : 'border-red-300 bg-red-50 hover:border-[#e9931c] hover:bg-orange-50'
                  }`}
                >
                  {(visitedAreaImage || (visitedAreaImages && visitedAreaImages.length > 0)) ? (
                    <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
                      {visitedAreaImages && visitedAreaImages.length > 1 ? (
                        <div className="grid grid-cols-2 gap-1 w-full h-full">
                          {visitedAreaImages.slice(0, 4).map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Visited area ${idx + 1}`}
                              className="w-full h-full rounded object-cover"
                            />
                          ))}
                          {visitedAreaImages.length > 4 && (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded text-xs font-semibold">
                              +{visitedAreaImages.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          src={visitedAreaImage || (visitedAreaImages && visitedAreaImages[0])}
                          alt="Visited area"
                          className="max-w-full max-h-full rounded-lg object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs sm:text-sm text-red-700 font-semibold">⚠️ Required: Click to upload visited area picture(s)</p>
                      <p className="text-xs text-red-600 mt-1">You can upload multiple images</p>
                    </div>
                  )}
                </label>
                {(visitedAreaImage || (visitedAreaImages && visitedAreaImages.length > 0)) && (
                  <button
                    onClick={() => {
                      setVisitedAreaImage(null)
          setVisitedAreaImages([])
                      setVisitedAreaImages([])
                    }}
                    className="mt-2 text-xs sm:text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                {selectedVisitTarget && selectedVisitTarget.status === 'Completed' ? (
                  // Show Continue button after completion
                  (() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const remainingVisits = visitTargets.filter(t => {
                      if (t.status === 'Completed') return false
                      if (t.status !== 'Pending' && t.status !== 'In Progress') return false
                      if (!t.visitDate) return false
                      const visitDate = new Date(t.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === today.getTime()
                    })
                    const nextVisit = remainingVisits.find(t => {
                      if (!t.visitDate) return false
                      const visitDate = new Date(t.visitDate)
                      const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                      return visitDateOnly.getTime() === today.getTime()
                    }) || remainingVisits[0]
                    
                    return (
                      <>
                        <button
                          onClick={() => {
                            setShowCompletionModal(false)
                            setShowAchievementModal(true)
                          }}
                          className="flex-1 px-4 py-3 sm:py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-bold text-sm sm:text-base"
                        >
                          Close
                        </button>
                        {nextVisit && isTracking ? (
                          <button
                            onClick={() => {
                              // Set next visit as selected
                              setSelectedVisitTarget(nextVisit)
                              // Set ending kilometers as starting for next visit
                              if (selectedVisitTarget.endingKilometers) {
                                setStartingKilometers(selectedVisitTarget.endingKilometers.toString())
                                setMeterReading(selectedVisitTarget.endingKilometers.toString())
                              }
                              // Set route to next visit
                              if (userLocation) {
                                setRouteToVisitTarget({
                                  from: { lat: userLocation.latitude, lng: userLocation.longitude },
                                  to: { lat: parseFloat(nextVisit.latitude), lng: parseFloat(nextVisit.longitude) },
                                  target: nextVisit
                                })
                              }
                              // Close completion modal
                              setShowCompletionModal(false)
                              // Open next visit modal
                              setShowVisitTargetModal(true)
                              addNotification({
                                message: `📍 Next Visit: ${nextVisit.name} | Starting from ${selectedVisitTarget.endingKilometers || 'current'} km`,
                                type: 'info',
                              })
                            }}
                            className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium shadow-lg flex items-center justify-center gap-1.5"
                          >
                            <FaArrowRight className="w-4 h-4" />
                            <span>Continue to Next Visit</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowCompletionModal(false)
                              setShowAchievementModal(true)
                            }}
                            className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium shadow-lg flex items-center justify-center gap-1.5"
                          >
                            <FaCheckCircle className="w-5 h-5" />
                            <span>Done</span>
                          </button>
                        )}
                      </>
                    )
                  })()
                ) : (
                  // Show normal complete button before completion
                  <>
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
                      disabled={
                        selectedVisitTarget 
                          ? (!visitedAreaImage || isExtractingEnding) // For individual visit: only visited area image required
                          : (!endingKilometers || endingKilometers.trim() === '' || !visitedAreaImage || isExtractingEnding) // For complete tracking: both required
                      }
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5"
                    >
                      <FaCheckCircle className="w-5 h-5" />
                      <span>{selectedVisitTarget ? 'Complete Target' : 'Complete Tracking'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit Target Action Modal - Opens when target is clicked */}
      {showVisitTargetModal && selectedVisitTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto animate-slideUp my-auto">
            {/* Header removed - simple border */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800">{selectedVisitTarget.name}</h3>
              <button
                onClick={() => {
                  setShowVisitTargetModal(false)
                  setSelectedVisitTarget(null)
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all resize-none text-sm"
                  rows="3"
                />
              </div>

              {/* Estimated Kilometers Display (if route is available) */}
              {routeDistanceKm && isTracking && (
                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Estimated Route Distance</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {typeof routeDistanceKm === 'number' ? `${routeDistanceKm.toFixed(2)} km` : !isNaN(parseFloat(routeDistanceKm)) ? `${parseFloat(routeDistanceKm).toFixed(2)} km` : `${routeDistanceKm} km`}
                  </p>
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
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Create Quotation
                </button>

                <button
                  onClick={() => {
                    // Store visit target customer info for sales upload form auto-fill
                    if (selectedVisitTarget) {
                      const visitTargetData = {
                        customerName: selectedVisitTarget.name || selectedVisitTarget.customerName || '',
                        customerEmail: selectedVisitTarget.email || selectedVisitTarget.customerEmail || '',
                        customerPhone: selectedVisitTarget.phone || selectedVisitTarget.customerPhone || '',
                        deliveryAddress: selectedVisitTarget.address || selectedVisitTarget.deliveryAddress || '',
                        visitTargetId: selectedVisitTarget._id || selectedVisitTarget.id
                      }
                      localStorage.setItem('salesOrderVisitTarget', JSON.stringify(visitTargetData))
                      localStorage.setItem('openSalesOrderForm', 'true')
                      localStorage.setItem('salesOrderFromAchievement', 'true')
                    }
                    setShowVisitTargetModal(false)
                    // Navigate to Sales Orders tab
                    const event = new CustomEvent('navigateToTab', { detail: 'sales-orders' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-3 py-2 bg-[#e9931c] text-white rounded-lg text-sm font-medium hover:bg-[#d8830a] transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Create Sales Order
                </button>

                {selectedVisitTarget.status !== 'Completed' && (
                  <button
                    onClick={() => {
                      setShowVisitTargetModal(false)
                      handleMarkAsCompleted()
                    }}
                    className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="w-full mt-4 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
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
            {/* Header removed - simple border */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-800">Request a Visit</h3>
              <button
                onClick={() => setShowRequestVisitModal(false)}
                className="text-gray-500 hover:text-gray-700 rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Target Name</label>
                  <input
                    value={requestForm.targetName}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, targetName: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter target name (optional)"
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
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
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
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
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
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
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
            {/* Header removed - simple border */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-800">Assign</h3>
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
                className="text-gray-500 hover:text-gray-700 rounded-full p-2 transition-colors"
              >
                <FaTimes className="w-6 h-6" />
              </button>
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
                className={`flex-1 px-4 py-3 font-semibold transition-colors items-center justify-center gap-2 ${
                  assignModalActiveTab === 'tasks'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600 flex'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100 flex'
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
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaCalendarAlt className="text-blue-600" />
                  Select Date to View & Assign
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="date"
                    value={selectedDateForView}
                    onChange={async (e) => {
                      const selectedDate = e.target.value
                      setSelectedDateForView(selectedDate)
                      setAssignmentDate(selectedDate)
                      
                      // When date is selected, refresh visits from database to get all visits (including completed) for that date
                      if (selectedDate && assignModalActiveTab === 'visits') {
                        try {
                          // Fetch all visits (including completed) from database
                          const visitTargetsResult = await getVisitTargets({})
                          if (visitTargetsResult.success && visitTargetsResult.data) {
                            // Filter only targets with valid coordinates
                            const validTargets = visitTargetsResult.data.filter(target => {
                              const lat = parseFloat(target.latitude)
                              const lng = parseFloat(target.longitude)
                              const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
                                lat >= -90 && lat <= 90 && 
                                lng >= -180 && lng <= 180
                              return hasValidCoords
                            })
                            setVisitTargets(validTargets)
                            console.log('Refreshed visits from database for date:', selectedDate, 'Total visits:', validTargets.length)
                          }
                        } catch (error) {
                          console.error('Error refreshing visits:', error)
                        }
                      }
                      
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
                          text: `Showing ${tabName} for ${formattedDate} (including previous visits)`,
                          confirmButtonColor: '#e9931c',
                          timer: 2000,
                          timerProgressBar: true,
                          toast: true,
                          position: 'top-end',
                          showConfirmButton: false
                        })
                        
                        addNotification({
                          message: `📅 Viewing ${tabName} for ${formattedDate} (including previous)`,
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
                    // When date is selected, show ALL visits (including completed) for that date
                    // When no date selected, show only non-completed visits
                    let visitsToShow = visitTargets.filter(v => {
                      if (selectedDateForView) {
                        // When date is selected, show all visits (including completed) for that date
                        return true
                      } else {
                        // When no date selected, filter out completed visits
                        const status = (v.status || '').toLowerCase()
                        return status !== 'completed'
                      }
                    })
                    
                    if (selectedDateForView) {
                      const selectedDateObj = new Date(selectedDateForView + 'T00:00:00') // Add time to avoid timezone issues
                      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
                      
                      visitsToShow = visitsToShow.filter(v => {
                        if (!v.visitDate) {
                          // If visit has no date but is assigned to salesman, show it when date is selected
                          // This allows assigning visits to a date
                          return true
                        }
                        
                        // Parse visit date properly
                        const visitDate = new Date(v.visitDate)
                        // Handle timezone issues by comparing date parts only
                        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                        
                        // Compare dates
                        const dateMatch = visitDateOnly.getTime() === selectedDateOnly.getTime()
                        
                        // Also check if date string matches (for different formats)
                        const visitDateStr = visitDate.toISOString().split('T')[0]
                        const selectedDateStr = selectedDateForView
                        const stringMatch = visitDateStr === selectedDateStr
                        
                        return dateMatch || stringMatch
                      })
                      
                      // Debug log
                      console.log('Selected date:', selectedDateForView)
                      console.log('Total visits:', visitTargets.length)
                      console.log('Filtered visits for date:', visitsToShow.length)
                      console.log('Visits data:', visitsToShow.map(v => ({
                        name: v.name,
                        visitDate: v.visitDate,
                        status: v.status
                      })))
                    }
                    
                    // Categorize visits - if date is selected, show all visits for that date in one section
                    let dueVisits = [] // Past due, non-completed visits
                    let todayVisits = []
                    let tomorrowVisits = []
                    let remainingVisits = []
                    let upcomingVisits = []
                    let unassignedVisits = []
                    let completedVisits = [] // Completed visits (separate section)
                    
                    if (selectedDateForView) {
                      // When a specific date is selected, show all visits for that date (including completed/previous)
                      // Also include visits without dates (for assignment)
                      const selectedDateObj = new Date(selectedDateForView + 'T00:00:00')
                      const selectedDateOnly = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate())
                      
                      visitsToShow.forEach(v => {
                        const visitStatus = (v.status || '').toLowerCase()
                        const isCompleted = visitStatus === 'completed'
                        
                        if (!v.visitDate) {
                          // Visits without date - show in a separate section for assignment (only if not completed)
                          if (!isCompleted) {
                            unassignedVisits.push(v)
                          }
                        } else {
                          const visitDate = new Date(v.visitDate)
                          const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                          
                          if (visitDateOnly.getTime() === selectedDateOnly.getTime()) {
                            // Visit matches selected date - categorize by status first, then by relative date
                            if (isCompleted) {
                              // Completed visits go to separate "Completed" section
                              completedVisits.push(v)
                            } else if (visitDate < today) {
                              // Past due, non-completed visits
                              dueVisits.push(v)
                            } else if (visitDateOnly.getTime() === today.getTime()) {
                              todayVisits.push(v)
                            } else if (visitDateOnly.getTime() === tomorrow.getTime()) {
                              tomorrowVisits.push(v)
                            } else if (visitDate > tomorrow && visitDate <= nextWeek) {
                              remainingVisits.push(v)
                            } else {
                              upcomingVisits.push(v)
                            }
                          }
                        }
                      })
                    } else {
                      // No date selected - categorize normally
                      dueVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        const isCompleted = visitStatus === 'completed'
                        if (isCompleted) return false // Exclude completed visits from due
                        const visitDate = new Date(v.visitDate)
                        return visitDate < today
                      })
                      
                      // Separate completed visits
                      completedVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        return visitStatus === 'completed'
                      })
                      
                      todayVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        if (visitStatus === 'completed') return false // Exclude completed
                        const visitDate = new Date(v.visitDate)
                        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                        return visitDateOnly.getTime() === today.getTime()
                      })
                      
                      tomorrowVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        if (visitStatus === 'completed') return false // Exclude completed
                        const visitDate = new Date(v.visitDate)
                        const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                        return visitDateOnly.getTime() === tomorrow.getTime()
                      })
                      
                      remainingVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        if (visitStatus === 'completed') return false // Exclude completed
                        const visitDate = new Date(v.visitDate)
                        return visitDate > tomorrow && visitDate <= nextWeek
                      })
                      
                      upcomingVisits = visitsToShow.filter(v => {
                        if (!v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        if (visitStatus === 'completed') return false // Exclude completed
                        const visitDate = new Date(v.visitDate)
                        return visitDate > nextWeek
                      })
                      
                      // Visits without dates (only non-completed)
                      unassignedVisits = visitsToShow.filter(v => {
                        if (v.visitDate) return false
                        const visitStatus = (v.status || '').toLowerCase()
                        return visitStatus !== 'completed'
                      })
                    }
                    
                    // Sort visits within each category by date (recent first, today first)
                    const sortVisitsByDate = (visits) => {
                      return [...visits].sort((a, b) => {
                        if (!a.visitDate && !b.visitDate) return 0
                        if (!a.visitDate) return 1
                        if (!b.visitDate) return -1
                        return new Date(b.visitDate) - new Date(a.visitDate) // Recent first (descending)
                      })
                    }
                    
                    return (
                      <div className="space-y-4">
                        {/* Today's Visits - Show First */}
                        {sortVisitsByDate(todayVisits).length > 0 && (
                          <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaClock className="text-blue-600" />
                              <h4 className="font-semibold text-blue-800">Today's Visits ({todayVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(todayVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={(e) => {
                                    if (e.target.closest('button')) return
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800">{visit.name}</p>
                                      <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                      <p className="text-xs text-blue-600 mt-1">
                                        Today: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
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

                        {/* Due Visits (Past) */}
                        {sortVisitsByDate(dueVisits).length > 0 && (
                          <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaExclamationTriangle className="text-red-600" />
                              <h4 className="font-semibold text-red-800">Due Visits ({dueVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(dueVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={() => {
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                                >
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

                        {/* Completed Visits */}
                        {sortVisitsByDate(completedVisits).length > 0 && (
                          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCheckCircle className="text-green-600" />
                              <h4 className="font-semibold text-green-800">Completed Visits ({completedVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(completedVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={() => {
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-green-200 cursor-pointer hover:bg-green-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800">{visit.name}</p>
                                      <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                      <p className="text-xs text-green-600 mt-1">
                                        Completed: {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <FaCheckCircle className="text-green-600" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tomorrow's Visits */}
                        {sortVisitsByDate(tomorrowVisits).length > 0 && (
                          <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-green-600" />
                              <h4 className="font-semibold text-green-800">Tomorrow's Visits ({tomorrowVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(tomorrowVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={() => {
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-green-200 cursor-pointer hover:bg-green-50 transition-colors"
                                >
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
                        {sortVisitsByDate(remainingVisits).length > 0 && (
                          <div className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaArrowRight className="text-yellow-600" />
                              <h4 className="font-semibold text-yellow-800">This Week ({remainingVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(remainingVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={() => {
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-50 transition-colors"
                                >
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
                        {sortVisitsByDate(upcomingVisits).length > 0 && (
                          <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-purple-600" />
                              <h4 className="font-semibold text-purple-800">Upcoming Visits ({upcomingVisits.length})</h4>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {sortVisitsByDate(upcomingVisits).map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  onClick={() => {
                                    if (visit.latitude && visit.longitude) {
                                      handleVisitTargetClick(visit)
                                    }
                                  }}
                                  className="p-3 bg-white rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-50 transition-colors"
                                >
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

                        {/* Unassigned Visits (for date assignment) */}
                        {unassignedVisits.length > 0 && selectedDateForView && (
                          <div className="border-2 border-orange-200 bg-orange-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <FaCalendarAlt className="text-orange-600" />
                              <h4 className="font-semibold text-orange-800">Unassigned Visits ({unassignedVisits.length})</h4>
                              <span className="text-xs text-orange-600 ml-auto">Select to assign to {new Date(selectedDateForView).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {unassignedVisits.map((visit) => (
                                <div 
                                  key={visit._id || visit.id} 
                                  className="p-3 bg-white rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedVisitsForAssignment.includes(visit._id || visit.id)}
                                          onChange={(e) => {
                                            const visitId = visit._id || visit.id
                                            if (e.target.checked) {
                                              setSelectedVisitsForAssignment(prev => [...prev, visitId])
                                            } else {
                                              setSelectedVisitsForAssignment(prev => prev.filter(id => id !== visitId))
                                            }
                                          }}
                                          className="w-4 h-4 text-[#e9931c] border-gray-300 rounded focus:ring-[#e9931c]"
                                        />
                                        <div className="flex-1">
                                          <p className="font-medium text-gray-800">{visit.name}</p>
                                          <p className="text-sm text-gray-600">{visit.address || 'No address'}</p>
                                          <p className="text-xs text-orange-600 mt-1">No date assigned - Click to assign</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {visitsToShow.length === 0 && unassignedVisits.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                            <FaCalendarAlt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">
                              {selectedDateForView ? `No visits scheduled for ${new Date(selectedDateForView).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No visits available'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedDateForView ? (
                                <>
                                  Select another date or assign visits to this date.
                                  <br />
                                  <span className="text-xs text-gray-400 mt-2 block">
                                    Total visits: {visitTargets.length} | 
                                    Without date: {visitTargets.filter(v => !v.visitDate && (v.status || '').toLowerCase() !== 'completed').length} |
                                    Approved: {visitTargets.filter(v => (v.approvalStatus || 'Approved') === 'Approved' && (v.status || '').toLowerCase() !== 'completed').length}
                                  </span>
                                </>
                              ) : (
                                'Visits will appear here once assigned'
                              )}
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
                    // Store visit target customer info for Sales Order form pre-fill
                    if (selectedVisitTarget) {
                      const visitTargetData = {
                        customerName: selectedVisitTarget.name || selectedVisitTarget.customerName || '',
                        customerEmail: selectedVisitTarget.email || selectedVisitTarget.customerEmail || '',
                        customerPhone: selectedVisitTarget.phone || selectedVisitTarget.customerPhone || '',
                        deliveryAddress: selectedVisitTarget.address || selectedVisitTarget.deliveryAddress || '',
                        visitTargetId: selectedVisitTarget._id || selectedVisitTarget.id
                      }
                      localStorage.setItem('salesOrderVisitTarget', JSON.stringify(visitTargetData))
                      localStorage.setItem('openSalesOrderForm', 'true')
                    }
                    setShowAchievementModal(false)
                    // Navigate to Sales Orders tab
                    const event = new CustomEvent('navigateToTab', { detail: 'sales-orders' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-3 py-2 bg-[#e9931c] text-white rounded-lg text-sm font-medium hover:bg-[#d8830a] transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Create Sales Order
                </button>
                <button
                  onClick={() => {
                    setShowAchievementModal(false)
                    const event = new CustomEvent('navigateToTab', { detail: 'achievements' })
                    window.dispatchEvent(event)
                  }}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Shift End Modal - When all visits are completed */}
      {showShiftEndModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-slideUp mx-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                Shift End - Upload Ending Meter Reading
              </h3>
              <button
                onClick={() => {
                  setShowShiftEndModal(false)
                  setShiftEndingKilometers('')
                  setShiftEndingMeterImage(null)
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-1.5 sm:p-2 transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 max-h-[75vh] sm:max-h-[70vh] overflow-y-auto">
              <p className="text-sm sm:text-base text-gray-700 mb-5 sm:mb-6 text-center leading-relaxed font-medium">
                All visits completed! Please upload ending meter reading to complete the shift.
              </p>

              {/* Starting Kilometers Display */}
              <div className="mb-5 sm:mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-1">Starting Reading</p>
                <p className="text-2xl font-bold text-blue-700">
                  {startingKilometers && !isNaN(parseFloat(startingKilometers)) && parseFloat(startingKilometers) > 0 
                    ? `${startingKilometers} km` 
                    : meterReading || 'Not set'}
                </p>
              </div>

              {/* Ending Meter Image Upload */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3">
                  Ending Meter Reading (Upload Image) *
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={handleShiftEndingMeterCameraCapture}
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="shift-ending-meter-upload"
                    className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload
                  </label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleShiftEndingMeterImageUpload}
                  className="hidden"
                  id="shift-ending-meter-upload"
                />
                <div className="flex flex-col items-center justify-center w-full h-40 sm:h-48 md:h-56 border-2 border-dashed border-gray-300 rounded-xl">
                  {shiftEndingMeterImage ? (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <img
                        src={shiftEndingMeterImage}
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
                {isExtractingShiftEnd && (
                  <div className="mt-2 p-4 bg-orange-50 border-2 border-orange-200 rounded-xl text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-[#e9931c] border-t-transparent mb-3"></div>
                    <p className="text-sm sm:text-base font-bold text-[#e9931c] mb-1">🔍 Extracting kilometers from image...</p>
                    <p className="text-xs sm:text-sm text-gray-600">Please wait, this may take a few seconds</p>
                  </div>
                )}
              </div>

              {/* Ending Kilometers - Auto-extracted from image only */}
              {shiftEndingKilometers && (
                <div className="mb-5 sm:mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-sm font-semibold text-blue-800 mb-1">Extracted Ending Kilometers</p>
                  <p className="text-2xl font-bold text-blue-700">{shiftEndingKilometers} km</p>
                  <p className="text-xs text-blue-600 mt-1">Extracted from meter image</p>
                </div>
              )}

              {/* Total Distance Display */}
              {shiftEndingKilometers && startingKilometers && (
                <div className="mb-5 sm:mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-green-800 mb-1">Total Shift Distance</p>
                  <p className="text-2xl font-bold text-green-700">
                    {(() => {
                      const start = parseFloat(startingKilometers || meterReading || '0')
                      const end = parseFloat(shiftEndingKilometers)
                      if (!isNaN(start) && !isNaN(end) && end >= start) {
                        return `${(end - start).toFixed(2)} km`
                      }
                      return 'Calculating...'
                    })()}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Total distance for all visits today</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setShowShiftEndModal(false)
                    setShiftEndingKilometers('')
                    setShiftEndingMeterImage(null)
                  }}
                  className="flex-1 px-4 py-3 sm:py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-bold text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShiftEnd}
                  disabled={!shiftEndingKilometers || shiftEndingKilometers.trim() === '' || !shiftEndingMeterImage || isExtractingShiftEnd}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5"
                >
                  <FaCheckCircle className="w-5 h-5" />
                  <span>Complete Shift</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Photo Collage Modal */}
      {showShiftPhotoCollage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-slideUp mx-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800">
                Shift Photo Collage - All Proof Images
              </h3>
              <button
                onClick={() => {
                  setShowShiftPhotoCollage(false)
                }}
                className="text-gray-500 hover:text-gray-700 rounded-full p-1.5 sm:p-2 transition-colors"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Collage */}
            <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const completedVisits = visitTargets.filter(t => {
                  if (t.status !== 'Completed') return false
                  if (!t.visitDate) return false
                  const visitDate = new Date(t.visitDate)
                  const visitDateOnly = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate())
                  return visitDateOnly.getTime() === today.getTime()
                })

                const allImages = []
                
                // Add starting meter image if available
                if (uploadedImage) {
                  allImages.push({ type: 'Starting Meter', image: uploadedImage, visitName: 'Shift Start' })
                }
                
                // Add visited area images from all completed visits
                completedVisits.forEach((visit, index) => {
                  if (visit.visitedAreaImage) {
                    allImages.push({ 
                      type: 'Visited Area', 
                      image: visit.visitedAreaImage, 
                      visitName: visit.name || `Visit ${index + 1}` 
                    })
                  }
                })
                
                // Add ending meter image
                if (shiftEndingMeterImage) {
                  allImages.push({ type: 'Ending Meter', image: shiftEndingMeterImage, visitName: 'Shift End' })
                }

                return (
                  <div className="space-y-4">
                    <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-800">
                        Total Images: {allImages.length} | Completed Visits: {completedVisits.length}
                      </p>
                    </div>
                    
                    {allImages.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {allImages.map((item, index) => (
                          <div key={index} className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                            <div className="p-2 bg-gray-100 border-b border-gray-200">
                              <p className="text-xs font-semibold text-gray-700">{item.type}</p>
                              <p className="text-xs text-gray-600 truncate">{item.visitName}</p>
                            </div>
                            <div className="aspect-square bg-white flex items-center justify-center p-2">
                              <img
                                src={item.image}
                                alt={`${item.type} - ${item.visitName}`}
                                className="max-w-full max-h-full object-contain rounded"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No images available</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => {
                    setShowShiftPhotoCollage(false)
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors text-sm font-medium"
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
