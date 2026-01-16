import { useState, useEffect, useRef } from 'react'
import GoogleMapView from './GoogleMapView'
// import MilestoneModal from './MilestoneModal' // COMMENTED OUT - Using Visit Targets only
import NotificationToast from './NotificationToast'
// import { getMilestones, checkProximity, markMilestoneComplete } from '../services/salemanservices/milestoneService' // COMMENTED OUT - Using Visit Targets only
import { getVisitTargets, updateVisitTargetStatus, createVisitRequest, getVisitRequests } from '../services/salemanservices/visitTargetService'
import { getCurrentLocation, watchPosition, clearWatch, formatDistance, calculateDistance, PROXIMITY_DISTANCE_KM } from '../services/salemanservices/locationService'
import { startTracking, stopTracking, getActiveTracking } from '../services/salemanservices/trackingService'
import { createWorker } from 'tesseract.js'
import { FaPlay, FaStop, FaPause, FaMapMarkerAlt, FaClock, FaCheckCircle } from 'react-icons/fa'

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
  const watchIdRef = useRef(null)
  const countdownIntervalRef = useRef(null)

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
          // Filter out targets without valid coordinates AND completed targets
          const validTargets = visitTargetsResult.data.filter(target => {
            const lat = parseFloat(target.latitude)
            const lng = parseFloat(target.longitude)
            const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
              lat >= -90 && lat <= 90 && 
              lng >= -180 && lng <= 180
            const isNotCompleted = target.status !== 'Completed'
            return hasValidCoords && isNotCompleted
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

  const refreshRequestsAndTargets = async () => {
    try {
      const visitTargetsResult = await getVisitTargets()
      if (visitTargetsResult.success && visitTargetsResult.data) {
        const validTargets = visitTargetsResult.data.filter(target => {
          const lat = parseFloat(target.latitude)
          const lng = parseFloat(target.longitude)
          const hasValidCoords = !isNaN(lat) && !isNaN(lng) && 
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180
          const isNotCompleted = target.status !== 'Completed'
          return hasValidCoords && isNotCompleted
        })
        setVisitTargets(validTargets)
      }

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

  const handleSubmitVisitRequest = async () => {
    try {
      if (!requestForm.name || !requestForm.name.trim()) {
        alert('Please enter visit name')
        return
      }

      const lat = requestForm.latitude ? Number(requestForm.latitude) : Number(userLocation?.latitude)
      const lng = requestForm.longitude ? Number(requestForm.longitude) : Number(userLocation?.longitude)
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        alert('Please provide valid latitude/longitude (or allow GPS)')
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
        alert(result.message || 'Visit request submitted')
        setShowRequestVisitModal(false)
        setRequestForm({
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
        alert(result?.message || 'Failed to submit visit request')
      }
    } catch (e) {
      console.error('handleSubmitVisitRequest error:', e)
      alert('Error submitting visit request')
    } finally {
      setRequestSubmitting(false)
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

  // Watch position for real-time tracking
  useEffect(() => {
    if (isTracking) {
      watchIdRef.current = watchPosition(
        (position) => {
          setUserLocation(position)
          checkVisitTargetProximity(position)
        },
        (error) => {
          console.error('Error watching position:', error)
        }
      )
    } else {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }

    return () => {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current)
      }
    }
  }, [isTracking, visitTargets])

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
          // Show alert
          alert(`🎯 Visit Target Reached!\n\nTarget: ${target.name}\nDistance: ${distanceFormatted}`)
          
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
              onClick={() => setShowRequestVisitModal(true)}
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
                  visitTargets={visitTargets.filter(t => t.status !== 'Completed')}
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
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Pending Visit Targets</h3>
                {visitRequests && visitRequests.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
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
                {visitTargets.filter(t => t.status === 'Pending' || t.status === 'In Progress').length === 0 ? (
                  <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-gray-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-600">No pending visit targets</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {visitTargets
                      .filter(t => t.status === 'Pending' || t.status === 'In Progress')
                      .sort((a, b) => {
                        if (!userLocation) return 0
                        const distA = calculateDistance(
                          userLocation.latitude,
                          userLocation.longitude,
                          parseFloat(a.latitude),
                          parseFloat(a.longitude)
                        )
                        const distB = calculateDistance(
                          userLocation.latitude,
                          userLocation.longitude,
                          parseFloat(b.latitude),
                          parseFloat(b.longitude)
                        )
                        return distA - distB
                      })
                      .map((target) => (
                        <div
                          key={target._id || target.id}
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
                            selectedVisitTarget?._id === target._id || selectedVisitTarget?.id === target.id
                              ? 'border-[#e9931c] bg-orange-50 shadow-md'
                              : 'border-gray-200 hover:border-[#e9931c] hover:bg-orange-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-800">{target.name}</p>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  target.status === 'In Progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {target.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{target.address || `${target.city || ''} ${target.state || ''}`.trim() || 'No address'}</p>
                              {userLocation && (
                                <p className="text-xs font-semibold text-[#e9931c]">
                                  📍 {getDistanceToVisitTarget(target)} away
                                </p>
                              )}
                              {target.priority && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Priority: <span className="font-semibold">{target.priority}</span>
                                </p>
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
                                  alert('Please start tracking first to see the route!')
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
                      ))}
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-slideUp">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl">
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

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Visit Name *</label>
                  <input
                    value={requestForm.name}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Shop / Area name"
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
                  <input
                    value={requestForm.latitude}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, latitude: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder={userLocation ? String(userLocation.latitude) : 'GPS needed'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
                  <input
                    value={requestForm.longitude}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, longitude: e.target.value }))}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder={userLocation ? String(userLocation.longitude) : 'GPS needed'}
                  />
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

              <div className="flex gap-3 pt-2">
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
