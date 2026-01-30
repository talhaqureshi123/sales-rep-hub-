import { useEffect, useRef, useState } from 'react'

const GoogleMapView = ({
  milestones = [],
  visitTargets = [],
  userLocation = null,
  onMarkerClick,
  onUserLocationClick, // Handler for user location marker click
  center = { lat: 28.6139, lng: 77.2090 }, // Default: Delhi
  zoom = 11, // Reduced from 13 - wider default view
  height = '400px',
  showUserLocation = true,
  showRadius = true,
  routeToMilestone = null,
  isTracking = false,
  selectedTarget = null, // Selected visit target for centering
  onRouteInfoChange = null, // Callback to pass route info to parent
}) => {
  const mapRef = useRef(null)
  const [map, setMap] = useState(null)
  const [directionsService, setDirectionsService] = useState(null)
  const [directionsRenderer, setDirectionsRenderer] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [showRouteInfoCard, setShowRouteInfoCard] = useState(true) // close button hides the route info card
  const [mapError, setMapError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const markersRef = useRef([])
  const lastBoundsKeyRef = useRef('')
  const trackingCenterSetRef = useRef(false) // When tracking, set center only once to avoid map blinking
  const prevIsTrackingRef = useRef(false)
  const lastSelectedTargetIdRef = useRef(null) // When user clicks a different visit, allow map to center on it
  const userHasManuallyMovedMapRef = useRef(false) // Once user zooms/pans, don't override until they click a visit or start tracking
  const userMarkerRef = useRef(null) // Keep user marker ref to update position in place during tracking (avoids blink)
  const markerLibraryRef = useRef(null) // Cache Advanced Marker library
  const lastUserInteractionRef = useRef(0) // When user zooms/pans, don't override their view for a few seconds

  const getMarkerLibrary = async () => {
    if (!window.google?.maps?.importLibrary) return null
    if (!markerLibraryRef.current) {
      markerLibraryRef.current = await window.google.maps.importLibrary('marker')
    }
    return markerLibraryRef.current
  }

  const createCircleMarkerContent = (fillColor, size = 14) => {
    const div = document.createElement('div')
    div.style.width = `${size}px`
    div.style.height = `${size}px`
    div.style.borderRadius = '50%'
    div.style.background = fillColor
    div.style.border = '3px solid white'
    div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'
    div.style.pointerEvents = 'none'
    return div
  }

  // Visit target marker: pin icon (visit-icon.png) so it shows clearly on map
  const createVisitPinContent = (size = 32) => {
    const div = document.createElement('div')
    div.style.width = `${size}px`
    div.style.height = `${size}px`
    div.style.display = 'flex'
    div.style.alignItems = 'center'
    div.style.justifyContent = 'center'
    div.style.pointerEvents = 'none'
    const img = document.createElement('img')
    img.src = '/visit-icon.png'
    img.alt = 'Visit'
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'contain'
    img.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'
    div.appendChild(img)
    return div
  }

  // Reset show route card when route is cleared so next route shows the card again
  useEffect(() => {
    if (!routeToMilestone) setShowRouteInfoCard(true)
  }, [routeToMilestone])

  // Initialize Google Maps
  useEffect(() => {
    let checkInterval = null
    let timeoutId = null
    let isInitialized = false

    function initializeMap() {
      if (isInitialized) {
        console.log('Map already initialized')
        return
      }

      if (!mapRef.current) {
        console.log('Map ref not ready, will retry...')
        setTimeout(initializeMap, 200)
        return
      }
      
      if (!window.google || !window.google.maps) {
        console.log('Google Maps API not loaded yet, waiting...')
        return
      }

      try {
        console.log('Initializing map...')
        isInitialized = true
        
        // Custom map styles for clean, professional look
        const customMapStyle = [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#e8f4f8' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }]
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }]
          },
          {
            featureType: 'road.arterial',
            elementType: 'geometry',
            stylers: [{ color: '#fafafa' }]
          },
          {
            featureType: 'road.local',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }]
          },
          {
            featureType: 'administrative',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#666666' }]
          },
          {
            featureType: 'administrative',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#ffffff' }]
          }
        ]

        // Create map instance with custom styling. mapId required for Advanced Markers (DEMO_MAP_ID for testing).
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center: center,
          zoom: zoom,
          mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement; use your Map ID in production
          mapTypeId: 'roadmap',
          styles: customMapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_CENTER,
            style: window.google.maps.ZoomControlStyle.DEFAULT
          },
          streetViewControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_TOP
          },
          mapTypeControl: false,
          gestureHandling: 'greedy', // Scroll wheel zooms; pinch/double-tap zoom on mobile
          clickableIcons: false, // Disable POI clicks
          keyboardShortcuts: true,
          draggable: true,
          scrollwheel: true,
          disableDoubleClickZoom: false,
        })

        // Listen for map errors
        window.google.maps.event.addListenerOnce(mapInstance, 'tilesloaded', () => {
          console.log('Map tiles loaded successfully')
          setMap(mapInstance)
          setMapError(null)
          setIsLoading(false)
        })

        // Listen for errors
        window.google.maps.event.addListenerOnce(mapInstance, 'error', (error) => {
          console.error('Map error:', error)
          if (error && error.message && error.message.includes('BillingNotEnabled')) {
            setMapError('BillingNotEnabledMapError')
          } else {
            setMapError('Failed to load Google Maps. Please check your API key and billing.')
          }
          setIsLoading(false)
        })

        // Set map immediately (will show error if billing not enabled)
        setMap(mapInstance)
        setIsLoading(false)

        // Check for billing error after a delay
        setTimeout(() => {
          try {
            if (mapInstance && mapInstance.getCenter()) {
              // Map is working
              setMapError(null)
            }
          } catch (err) {
            // Silent check - error will be shown by event listener
          }
        }, 2000)

        // Initialize Directions Service
        const directionsServiceInstance = new window.google.maps.DirectionsService()
        setDirectionsService(directionsServiceInstance)

        // Initialize Directions Renderer – route path style (clean orange line + arrows)
        const ROUTE_STROKE_COLOR = '#ea580c'
        const ROUTE_STROKE_WEIGHT = 6
        const ROUTE_ARROW_REPEAT = '80px'
        const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: ROUTE_STROKE_COLOR,
            strokeWeight: ROUTE_STROKE_WEIGHT,
            strokeOpacity: 0.95,
            zIndex: 1000,
            icons: [{
              icon: {
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4.5,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                fillColor: ROUTE_STROKE_COLOR,
                fillOpacity: 1,
              },
              offset: '100%',
              repeat: ROUTE_ARROW_REPEAT,
            }],
          },
        })
        setDirectionsRenderer(directionsRendererInstance)
      } catch (error) {
        console.error('Error initializing Google Maps:', error)
        setMapError(`Error: ${error.message || 'Failed to initialize Google Maps. Please check your API key.'}`)
        setMap(null)
        setIsLoading(false)
        isInitialized = false
      }
    }

    // Listen for Google Maps loaded event
    const handleMapsLoaded = () => {
      console.log('Google Maps loaded event received')
      setTimeout(initializeMap, 100)
    }

    const handleMapsError = () => {
      console.error('Google Maps error event received')
      setMapError('Google Maps API authentication failed. Check your API key.')
      setIsLoading(false)
    }

    window.addEventListener('googleMapsLoaded', handleMapsLoaded)
    window.addEventListener('googleMapsError', handleMapsError)

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded')
      setTimeout(initializeMap, 200)
    } else if (window.googleMapsLoaded) {
      console.log('Google Maps loaded flag set')
      setTimeout(initializeMap, 200)
    } else {
      // Wait for Google Maps to load
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      
      if (existingScript) {
        console.log('Google Maps script found, waiting for load...')
        // Check periodically
        checkInterval = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkInterval)
            setTimeout(initializeMap, 200)
          }
        }, 300)
        
        timeoutId = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval)
          if (!window.google || !window.google.maps) {
            setMapError('Google Maps API failed to load. Please check your API key and billing.')
            setIsLoading(false)
          }
        }, 20000)
      } else {
        setMapError('Google Maps script not found in HTML. Please check index.html')
        setIsLoading(false)
      }
    }

    return () => {
      window.removeEventListener('googleMapsLoaded', handleMapsLoaded)
      window.removeEventListener('googleMapsError', handleMapsError)
      if (checkInterval) clearInterval(checkInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, []) // Only run once on mount

  // Track user zoom/pan – once they move/zoom the map, don't override until they click a visit or start tracking
  useEffect(() => {
    if (!map) return
    const onUserInteraction = () => {
      lastUserInteractionRef.current = Date.now()
      userHasManuallyMovedMapRef.current = true // Zoom/pan = user chose view; keep it
    }
    const listeners = [
      window.google.maps.event.addListener(map, 'zoom_changed', onUserInteraction),
      window.google.maps.event.addListener(map, 'dragend', onUserInteraction),
    ]
    return () => {
      listeners.forEach((l) => window.google.maps.event.removeListener(l))
    }
  }, [map])

  // Minimum zoom so map never goes too far out (avoids grey blank map when sidebar selection has far-apart points)
  const MIN_ZOOM = 12
  const ZOOM_SPECIFIC_PLACE = 14 // Closer zoom when user selects a specific target

  // When user clicks a different visit (selectedTarget changes), allow map to center on it
  const selectedTargetId = selectedTarget ? (selectedTarget._id || selectedTarget.id)?.toString() : null
  useEffect(() => {
    if (selectedTargetId && selectedTargetId !== lastSelectedTargetIdRef.current) {
      lastSelectedTargetIdRef.current = selectedTargetId
      trackingCenterSetRef.current = false
      userHasManuallyMovedMapRef.current = false // Allow one center update to show the clicked visit
    }
    if (!selectedTargetId) lastSelectedTargetIdRef.current = null
  }, [selectedTargetId])

  // Update map center - Show both user location and selected target (debounce bounds to reduce blinking)
  // When tracking is on: set center only ONCE so map does not blink/shiver on every GPS update
  // Once user zooms/pans to check road, view stays – no snap back until they click a visit or start tracking
  const centerTimeoutRef = useRef(null)
  useEffect(() => {
    if (!map) return
    // Once user has zoomed/panned, never override their view until they click a visit or start tracking
    if (userHasManuallyMovedMapRef.current) return
    if (!isTracking) {
      trackingCenterSetRef.current = false
      prevIsTrackingRef.current = false
    }
    // When user just clicked Start Tracking (false -> true), allow one center update and reset manual flag so map sets correctly
    if (isTracking && !prevIsTrackingRef.current) {
      trackingCenterSetRef.current = false
      prevIsTrackingRef.current = true
      userHasManuallyMovedMapRef.current = false
    }
    // Once center is set during tracking, do not run any branch – keeps map stable (no blink)
    // Exception: when user clicks a visit (selectedTarget changed), we reset trackingCenterSetRef above so map moves
    if (isTracking && trackingCenterSetRef.current) {
      if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      centerTimeoutRef.current = null
      return
    }

    // Priority 1: If we have both user location and selected target - center on selected target with closer zoom (specific place)
    if (userLocation && selectedTarget && selectedTarget.latitude && selectedTarget.longitude) {
      if (isTracking && trackingCenterSetRef.current) return () => {} // No re-center on every GPS update – avoids blink
      if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      const selLat = parseFloat(selectedTarget.latitude)
      const selLng = parseFloat(selectedTarget.longitude)
      map.setCenter({ lat: selLat, lng: selLng })
      map.setZoom(ZOOM_SPECIFIC_PLACE)
      if (isTracking) trackingCenterSetRef.current = true
      const t = setTimeout(() => {
        if (map.getZoom() < MIN_ZOOM) map.setZoom(MIN_ZOOM)
      }, 150)
      return () => clearTimeout(t)
    }
    // Priority 2: Route is active – set center once when tracking to avoid blinking
    else if (userLocation && routeToMilestone) {
      if (isTracking && trackingCenterSetRef.current) return () => {}
      if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      const to = routeToMilestone.to
      if (to && to.lat != null && to.lng != null) {
        map.setCenter({ lat: to.lat, lng: to.lng })
        map.setZoom(MIN_ZOOM)
      } else {
        map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude })
        map.setZoom(MIN_ZOOM)
      }
      if (isTracking) trackingCenterSetRef.current = true
      return () => {}
    }
    // Priority 3: User + visit targets – when tracking set bounds only once to avoid map shivering
    else if (userLocation && visitTargets.length > 0) {
      if (isTracking && trackingCenterSetRef.current) return () => {}
      if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      centerTimeoutRef.current = setTimeout(() => {
        centerTimeoutRef.current = null
        if (!map) return
        if (isTracking && trackingCenterSetRef.current) return
        const bounds = new window.google.maps.LatLngBounds()
        bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude })
        visitTargets.forEach((target) => {
          if (target.latitude && target.longitude) {
            bounds.extend({ lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) })
          }
        })
        const key = bounds.toSpan?.() ? `${bounds.getNorthEast().lat()}-${bounds.getSouthWest().lat()}` : ''
        if (key && key === lastBoundsKeyRef.current) return
        lastBoundsKeyRef.current = key
        map.fitBounds(bounds, { padding: 100 })
        setTimeout(() => {
          if (map.getZoom() < MIN_ZOOM) map.setZoom(MIN_ZOOM)
        }, 150)
        if (isTracking) trackingCenterSetRef.current = true
      }, 550)
      return () => {
        if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      }
    }
    // Priority 4: Only user location – when tracking set center only once so map stays stable
    else if (userLocation) {
      if (isTracking && trackingCenterSetRef.current) return
      map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude })
      map.setZoom(11) // Reduced from 13 - wider view to show more area around user
      if (isTracking) trackingCenterSetRef.current = true
    }
    // Priority 4b: User clicked a visit but no GPS – still center map on that visit
    else if (selectedTarget && selectedTarget.latitude != null && selectedTarget.longitude != null) {
      const selLat = parseFloat(selectedTarget.latitude)
      const selLng = parseFloat(selectedTarget.longitude)
      map.setCenter({ lat: selLat, lng: selLng })
      map.setZoom(ZOOM_SPECIFIC_PLACE)
    }
    // Priority 5: Only targets available
    else if (milestones.length > 0 || visitTargets.length > 0) {
      // Filter out completed targets for map bounds calculation
      const activeTargets = visitTargets.filter(target => 
        target.status !== 'Completed' && target.status !== 'completed'
      )
      
      // If only one active target, zoom in close instead of fitting bounds
      if (activeTargets.length === 1 && milestones.length === 0) {
        const target = activeTargets[0]
        if (target.latitude && target.longitude) {
          map.setCenter({ lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) })
          map.setZoom(13) // Reduced from 16 - wider view for single location
        }
      } else if (activeTargets.length > 0 || milestones.length > 0) {
        const bounds = new window.google.maps.LatLngBounds()
        milestones.forEach((milestone) => {
          bounds.extend({ lat: milestone.latitude, lng: milestone.longitude })
        })
        activeTargets.forEach((target) => {
          if (target.latitude && target.longitude) {
            bounds.extend({ lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) })
          }
        })
        map.fitBounds(bounds, { padding: 100 })
        // Ensure minimum zoom level after fitBounds completes - reduced for wider view
        setTimeout(() => {
          if (map.getZoom() < 12) {
            map.setZoom(12) // Reduced from 15 - wider view to show more area
          }
        }, 100)
      }
    } 
    // Priority 6: Default center
    else {
      map.setCenter(center)
      map.setZoom(zoom || 11) // Reduced from 13 - wider default view
    }
  }, [map, userLocation, milestones, visitTargets, center, zoom, routeToMilestone, selectedTarget, isTracking])

  // Add user location marker (Advanced Marker API) – when tracking, update position in place to avoid blink
  useEffect(() => {
    if (!map || !showUserLocation || !userLocation) return

    const pos = { lat: userLocation.latitude, lng: userLocation.longitude }
    const existing = userMarkerRef.current

    const applyUserMarker = async () => {
      const lib = await getMarkerLibrary()
      if (!lib?.AdvancedMarkerElement) {
        // Fallback: legacy Marker if Advanced Marker library not available
        const userMarker = new window.google.maps.Marker({
          position: pos,
          map: map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: isTracking ? 14 : 12,
            fillColor: isTracking ? '#10b981' : '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          title: isTracking ? '📍 Tracking Active - Your Location' : 'Your Location',
          zIndex: 1000,
        })
        userMarkerRef.current = userMarker
        const infoWindow = new window.google.maps.InfoWindow({
          content: `<div style="padding: 12px;"><strong>${isTracking ? '📍 Tracking Active' : '📍 Your Location'}</strong><div style="font-size: 12px; color: #6b7280;">Lat: ${userLocation.latitude.toFixed(6)}<br>Lng: ${userLocation.longitude.toFixed(6)}</div></div>`,
        })
        userMarker.addListener('click', () => infoWindow.open(map, userMarker))
        markersRef.current.push({ type: 'user', marker: userMarker })
        return
      }

      const { AdvancedMarkerElement } = lib

      // During tracking: update existing Advanced Marker position in place
      if (isTracking && existing && existing.map === map) {
        existing.position = pos
        if (existing.content) {
          existing.content.style.background = '#10b981'
          existing.content.style.width = '28px'
          existing.content.style.height = '28px'
        }
        existing.title = '📍 Tracking Active - Your Location'
        const idx = markersRef.current.findIndex((m) => m.type === 'user')
        if (idx >= 0) markersRef.current[idx] = { type: 'user', marker: existing }
        return
      }

      // Remove existing user marker
      if (existing) {
        existing.map = null
        userMarkerRef.current = null
      }
      markersRef.current.forEach((m) => {
        if (m.type === 'user') {
          if (m.marker.setMap) m.marker.setMap(null)
          else m.marker.map = null
        }
      })
      markersRef.current = markersRef.current.filter((m) => m.type !== 'user')

      const fillColor = isTracking ? '#10b981' : '#4285F4'
      const userMarker = new AdvancedMarkerElement({
        map,
        position: pos,
        title: isTracking ? '📍 Tracking Active - Your Location' : 'Your Location',
        content: createCircleMarkerContent(fillColor, isTracking ? 14 : 12),
      })
      userMarkerRef.current = userMarker

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <strong style="font-size: 14px; color: #1f2937;">${isTracking ? '📍 Tracking Active' : '📍 Your Location'}</strong>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Lat: ${userLocation.latitude.toFixed(6)}<br>Lng: ${userLocation.longitude.toFixed(6)}</div>
          </div>
        `,
      })
      userMarker.addListener('click', () => infoWindow.open(map, userMarker))

      markersRef.current.push({ type: 'user', marker: userMarker })
    }

    applyUserMarker()
  }, [map, userLocation, showUserLocation, isTracking, onUserLocationClick])

  // Add milestone markers (Advanced Marker API with PinElement, or legacy Marker fallback)
  useEffect(() => {
    if (!map) return

    const cleanup = () => {
      markersRef.current.forEach((m) => {
        if (m.type === 'milestone') {
          if (m.marker.map != null) m.marker.map = null
          else if (m.marker.setMap) m.marker.setMap(null)
        }
        if (m.type === 'circle') m.circle?.setMap(null)
      })
      markersRef.current = markersRef.current.filter((m) => m.type !== 'milestone' && m.type !== 'circle')
    }
    cleanup()

    const apply = async () => {
      const lib = await getMarkerLibrary()
      const useAdvanced = lib?.AdvancedMarkerElement && lib?.PinElement

      milestones.forEach((milestone) => {
        const isPending = milestone.status === 'pending'
        const isCompleted = milestone.status === 'completed'
        const color = isCompleted ? '#10b981' : '#EA4335'
        const position = { lat: milestone.latitude, lng: milestone.longitude }

        if (useAdvanced) {
          const pin = new lib.PinElement({
            background: color,
            borderColor: '#fff',
            scale: isPending ? 1.2 : 1,
          })
          const milestoneMarker = new lib.AdvancedMarkerElement({
            map,
            position,
            title: milestone.name,
            content: pin.element,
          })
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 220px;">
                <strong style="font-size: 15px; color: #1f2937;">${milestone.name}</strong>
                <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                  ${milestone.address ? `<div>📍 ${milestone.address}</div>` : ''}
                  <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                    <strong>Status:</strong> <span style="color: ${color}">${milestone.status}</span>
                    <div style="margin-top: 6px; font-size: 11px;">Lat: ${milestone.latitude.toFixed(6)}<br>Lng: ${milestone.longitude.toFixed(6)}</div>
                  </div>
                  <button onclick="window.dispatchEvent(new CustomEvent('milestoneClick', { detail: ${JSON.stringify(milestone).replace(/</g, '\\u003c')} }))" style="margin-top: 10px; padding: 8px 16px; background: #e9931c; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; width: 100%;">View Details</button>
                </div>
              </div>
            `,
          })
          milestoneMarker.addListener('click', () => {
            infoWindow.open(map, milestoneMarker)
            if (onMarkerClick) onMarkerClick(milestone)
          })
          markersRef.current.push({ type: 'milestone', marker: milestoneMarker })
        } else {
          const milestoneMarker = new window.google.maps.Marker({
            position,
            map,
            icon: {
              url: isCompleted ? 'http://maps.google.com/mapfiles/ms/icons/green.png' : 'http://maps.google.com/mapfiles/ms/icons/red.png',
              scaledSize: new window.google.maps.Size(isPending ? 40 : 32, isPending ? 40 : 32),
            },
            title: milestone.name,
            zIndex: isPending ? 2000 : 1500,
          })
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="padding: 12px;"><strong>${milestone.name}</strong><div style="font-size: 12px; margin-top: 8px;">Status: ${milestone.status}</div><button onclick="window.dispatchEvent(new CustomEvent('milestoneClick', { detail: ${JSON.stringify(milestone).replace(/</g, '\\u003c')} }))" style="margin-top: 10px; padding: 8px 16px; background: #e9931c; color: white; border: none; border-radius: 6px; cursor: pointer;">View Details</button></div>`,
          })
          milestoneMarker.addListener('click', () => {
            infoWindow.open(map, milestoneMarker)
            if (onMarkerClick) onMarkerClick(milestone)
          })
          markersRef.current.push({ type: 'milestone', marker: milestoneMarker })
        }

        if (showRadius && milestone.status === 'pending' && milestone.radius) {
          const circle = new window.google.maps.Circle({
            strokeColor: color,
            strokeOpacity: 0.3,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.1,
            map,
            center: position,
            radius: milestone.radius,
          })
          markersRef.current.push({ type: 'circle', circle })
        }
      })
    }

    apply()

    const handleMilestoneClick = (event) => {
      if (onMarkerClick) onMarkerClick(event.detail)
    }
    window.addEventListener('milestoneClick', handleMilestoneClick)

    return () => {
      cleanup()
      window.removeEventListener('milestoneClick', handleMilestoneClick)
    }
  }, [map, milestones, showRadius, onMarkerClick])

  // Add visit target markers (Advanced Marker API, or legacy Marker fallback; debounce to avoid blink)
  const visitTargetsTimeoutRef = useRef(null)
  useEffect(() => {
    if (!map) return

    const removeVisitMarkers = () => {
      markersRef.current.forEach((m) => {
        if (m.type === 'visitTarget') {
          if (m.marker.map != null) m.marker.map = null
          else if (m.marker.setMap) m.marker.setMap(null)
        }
        if (m.type === 'visitTargetCircle') m.circle?.setMap(null)
      })
      markersRef.current = markersRef.current.filter((m) => m.type !== 'visitTarget' && m.type !== 'visitTargetCircle')
    }

    if (!visitTargets || visitTargets.length === 0) {
      if (visitTargetsTimeoutRef.current) clearTimeout(visitTargetsTimeoutRef.current)
      removeVisitMarkers()
      return
    }

    if (visitTargetsTimeoutRef.current) clearTimeout(visitTargetsTimeoutRef.current)
    visitTargetsTimeoutRef.current = setTimeout(async () => {
      visitTargetsTimeoutRef.current = null
      if (!map) return
      removeVisitMarkers()

      const lib = await getMarkerLibrary()
      const useAdvanced = !!lib?.AdvancedMarkerElement
      const validTargets = visitTargets.filter(target =>
        target.latitude && target.longitude &&
        !isNaN(parseFloat(target.latitude)) && !isNaN(parseFloat(target.longitude))
      )

      validTargets.forEach((target, index) => {
        const isCompleted = target.status === 'Completed' || target.status === 'completed'
        const isPending = target.status === 'Pending' || target.status === 'In Progress'
        const fillColor = isCompleted ? '#6b7280' : '#eab308'
        const lat = parseFloat(target.latitude)
        const lng = parseFloat(target.longitude)
        const position = { lat, lng }

        const infoContent = `
          <div style="padding: 8px; min-width: 200px;">
            <strong style="font-size: 14px; color: #333;">🎯 ${target.name || 'Visit Target'}</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">
              ${target.description ? `${target.description}<br>` : ''}
              ${target.address ? `📍 ${target.address}<br>` : ''}
              ${target.city || target.state ? `📍 ${[target.city, target.state].filter(Boolean).join(', ')}<br>` : ''}
              Priority: <strong>${target.priority || 'Medium'}</strong><br>
              Status: <strong>${target.status || 'Pending'}</strong>
              ${target.visitDate ? `<br>Visit Date: ${new Date(target.visitDate).toLocaleDateString()}` : ''}
            </p>
          </div>
        `
        const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })

        if (useAdvanced) {
          const visitTargetMarker = new lib.AdvancedMarkerElement({
            map,
            position,
            title: target.name || 'Visit Target',
            content: createVisitPinContent(isPending ? 36 : 30),
          })
          visitTargetMarker.addListener('click', () => {
            infoWindow.open(map, visitTargetMarker)
            if (onMarkerClick) onMarkerClick(target)
          })
          markersRef.current.push({ type: 'visitTarget', marker: visitTargetMarker })
        } else {
          const visitTargetMarker = new window.google.maps.Marker({
            position,
            map,
            icon: {
              url: '/visit-icon.png',
              scaledSize: new window.google.maps.Size(isPending ? 36 : 30, isPending ? 36 : 30),
              anchor: new window.google.maps.Point((isPending ? 36 : 30) / 2, (isPending ? 36 : 30) / 2),
            },
            title: target.name || 'Visit Target',
            zIndex: (isPending ? 1900 : 1400) + index,
          })
          visitTargetMarker.addListener('click', () => {
            infoWindow.open(map, visitTargetMarker)
            if (onMarkerClick) onMarkerClick(target)
          })
          markersRef.current.push({ type: 'visitTarget', marker: visitTargetMarker })
        }
      })
    }, 450)

    return () => {
      if (visitTargetsTimeoutRef.current) clearTimeout(visitTargetsTimeoutRef.current)
    }
  }, [map, visitTargets, showRadius, onMarkerClick])

  // Calculate and display route to milestone
  useEffect(() => {
    if (!map || !routeToMilestone) return

    // Check if DirectionsService is available
    if (!window.google.maps.DirectionsService) {
      console.error('DirectionsService not available. Make sure Directions API is enabled.')
      return
    }

    // Initialize Directions Service if not already done
    if (!directionsService) {
      const directionsServiceInstance = new window.google.maps.DirectionsService()
      setDirectionsService(directionsServiceInstance)
    }

        // Route path style – clean orange line, good visibility
    const ROUTE_STROKE_COLOR = '#ea580c'
    const ROUTE_STROKE_WEIGHT = 6
    const ROUTE_ARROW_REPEAT = '80px'
    const routePolylineOptions = {
      strokeColor: ROUTE_STROKE_COLOR,
      strokeWeight: ROUTE_STROKE_WEIGHT,
      strokeOpacity: 0.95,
      zIndex: 1000,
      icons: [{
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 4.5,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          fillColor: ROUTE_STROKE_COLOR,
          fillOpacity: 1,
        },
        offset: '100%',
        repeat: ROUTE_ARROW_REPEAT,
      }],
    }

    if (!directionsRenderer) {
      const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: routePolylineOptions,
      })
      setDirectionsRenderer(directionsRendererInstance)
    }

    const currentDirectionsService = directionsService || new window.google.maps.DirectionsService()
    const currentDirectionsRenderer = directionsRenderer || new window.google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: routePolylineOptions,
    })

    const request = {
      origin: { lat: routeToMilestone.from.lat, lng: routeToMilestone.from.lng },
      destination: { lat: routeToMilestone.to.lat, lng: routeToMilestone.to.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
      avoidHighways: false,
      avoidTolls: false,
      unitSystem: window.google.maps.UnitSystem.METRIC,
    }

    // Add waypoints for multi-stop route (max 25 - Google limit)
    if (routeToMilestone.waypoints && Array.isArray(routeToMilestone.waypoints) && routeToMilestone.waypoints.length > 0) {
      request.waypoints = routeToMilestone.waypoints
        .slice(0, 25)
        .map((wp) => ({
          location: new window.google.maps.LatLng(wp.lat, wp.lng),
          stopover: true,
        }))
      request.optimizeWaypoints = false
    } else {
      request.optimizeWaypoints = false
    }

    currentDirectionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        currentDirectionsRenderer.setDirections(result)

        const route = result.routes[0]
        const legs = route.legs || []
        const totalDistanceValue = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0)
        const totalDurationValue = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0)
        const distanceText = legs.length > 1
          ? `${(totalDistanceValue / 1000).toFixed(1)} km`
          : (legs[0]?.distance?.text || '0 km')
        const durationText = legs.length > 1
          ? `${Math.round(totalDurationValue / 60)} min`
          : (legs[0]?.duration?.text || '0 min')

        const routeInfoData = {
          distance: distanceText,
          duration: durationText,
          distanceValue: totalDistanceValue,
          durationValue: totalDurationValue,
          distanceKm: (totalDistanceValue / 1000).toFixed(2),
        }
        setRouteInfo(routeInfoData)

        if (onRouteInfoChange) {
          onRouteInfoChange(routeInfoData)
        }

        // Only fit bounds if user hasn't zoomed/panned – so they can zoom to check road and view stays
        if (!userHasManuallyMovedMapRef.current) {
          const bounds = new window.google.maps.LatLngBounds()
          result.routes[0].overview_path.forEach((point) => {
            bounds.extend(point)
          })
          bounds.extend({ lat: routeToMilestone.from.lat, lng: routeToMilestone.from.lng })
          bounds.extend({ lat: routeToMilestone.to.lat, lng: routeToMilestone.to.lng })
          map.fitBounds(bounds, { padding: 80 })
          const minZoom = 10
          setTimeout(() => {
            if (map.getZoom() < minZoom) map.setZoom(minZoom)
          }, 100)
        }
      } else {
        console.error('Directions request failed:', status)
        setRouteInfo(null)
        if (onRouteInfoChange) {
          onRouteInfoChange(null)
        }
      }
    })
  }, [map, directionsService, directionsRenderer, routeToMilestone])

  // Clear route when routeToMilestone is null
  useEffect(() => {
    if (!map || !directionsRenderer) return
    
    if (!routeToMilestone) {
      // Clear the route from map
      directionsRenderer.setDirections({ routes: [] })
      setRouteInfo(null)
      if (onRouteInfoChange) {
        onRouteInfoChange(null)
      }
    }
  }, [map, directionsRenderer, routeToMilestone])

  // Show error if map failed to load
  if (mapError || (!map && !window.google)) {
    // Check for billing error specifically
    const isBillingError = mapError?.includes('BillingNotEnabled') || 
                          mapError?.includes('billing') ||
                          (window.google && !window.google.maps)
    
    return (
      <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border-2 border-red-300 bg-red-50 flex items-center justify-center">
        <div className="text-center p-6 max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            {isBillingError ? '🚨 Billing Not Enabled' : 'Google Maps API Error'}
          </h3>
          <p className="text-sm text-gray-700 mb-4">
            {isBillingError 
              ? 'Your Google Maps API key is valid, but billing is not enabled on your Google Cloud project.'
              : mapError || 'Google Maps API key is missing or invalid'}
          </p>
          <div className="bg-white rounded-lg p-4 text-left text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-800">
              {isBillingError ? '🔧 How to Enable Billing (Required):' : 'To fix this:'}
            </p>
            {isBillingError ? (
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Go to <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">Google Cloud Console - Billing</a></li>
                <li>Select your project (or create one)</li>
                <li>Click <strong>"Link a billing account"</strong></li>
                <li>Add a debit/credit card (required even for FREE tier)
                  <ul className="list-disc list-inside ml-4 mt-1 text-gray-500">
                    <li><strong>FREE:</strong> Google gives $200 free monthly credits</li>
                    <li><strong>FREE:</strong> Most testing stays within free limit</li>
                    <li><strong>FREE:</strong> No charges unless you exceed $200/month</li>
                    <li>Payment method is just for verification (won't be charged for free usage)</li>
                  </ul>
                </li>
                <li>Also enable these APIs (all FREE within limits):
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Maps JavaScript API (FREE: $7 per 1000 loads)</li>
                    <li>Directions API (FREE: $5 per 1000 requests)</li>
                    <li>Places API (FREE: $17 per 1000 requests)</li>
                  </ul>
                </li>
                <li>Refresh this page after enabling billing</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a></li>
                <li>Create a new project or select existing one</li>
                <li>Enable these APIs:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Maps JavaScript API</li>
                    <li>Directions API</li>
                    <li>Places API</li>
                  </ul>
                </li>
                <li>Create an API key</li>
                <li>Enable billing (required for Google Maps)</li>
              </ol>
            )}
          </div>
          {isBillingError && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-red-600 font-semibold">
                ⚠️ Google Maps requires billing account (even for FREE tier)
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">💰 FREE TIER INFO:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Google gives <strong>$200 FREE credits/month</strong></li>
                  <li>Most testing stays within free limit</li>
                  <li>No charges unless you exceed $200/month</li>
                  <li>Just need to link a payment method (won't be charged for free usage)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // DEVELOPMENT PURPOSE ONLY - Console warning (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (!window.__mapsWarningShown) {
        console.warn(
          '%c⚠️ DEVELOPMENT PURPOSE ONLY ⚠️',
          'color: #facc15; font-size: 14px; font-weight: bold; background: #000; padding: 4px;'
        )
        console.warn('Google Maps setup is for DEVELOPMENT/TESTING PURPOSE ONLY.')
        console.warn('Uses Advanced Marker API (mapId: DEMO_MAP_ID). For production, create your Map ID in Cloud Console.')
        window.__mapsWarningShown = true
      }
    }
  }, [])

  // Convert height prop to proper CSS value; when 100% use minHeight 0 so map fills flex area
  const mapHeight = height === '100%' ? '100%' : (typeof height === 'string' ? height : `${height}px`)
  const wrapperMinHeight = height === '100%' ? 0 : '400px'
  
  return (
    <div style={{ height: mapHeight, width: '100%', position: 'relative', minHeight: wrapperMinHeight, display: 'flex', flexDirection: 'column' }} className="rounded-lg overflow-hidden border-2 border-gray-200">
      {/* Loading State */}
      {isLoading && !mapError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e9931c] mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading Google Maps...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait</p>
          </div>
        </div>
      )}

      {/* DEVELOPMENT PURPOSE ONLY Badge - Always Visible for Testing */}
      {map && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: '#facc15',
            color: '#000',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            borderRadius: '6px',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            border: '2px solid #000',
          }}
        >
          ⚠️ DEVELOPMENT PURPOSE ONLY
        </div>
      )}
      
      <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: 0, flex: 1, position: 'relative', touchAction: 'none' }} />
      
      {/* Custom zoom buttons – visible so map zoom works (scroll wheel + these) */}
      {map && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-[11]">
          <button
            type="button"
            onClick={() => {
              if (map) {
                map.setZoom(Math.min(map.getZoom() + 1, 21))
                lastUserInteractionRef.current = Date.now()
                userHasManuallyMovedMapRef.current = true
              }
            }}
            className="w-10 h-10 rounded-lg bg-white border-2 border-gray-200 shadow-md hover:bg-gray-50 hover:border-[#e9931c] flex items-center justify-center text-xl font-bold text-gray-700 hover:text-[#e9931c]"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (map) {
                map.setZoom(Math.max(map.getZoom() - 1, 1))
                lastUserInteractionRef.current = Date.now()
                userHasManuallyMovedMapRef.current = true
              }
            }}
            className="w-10 h-10 rounded-lg bg-white border-2 border-gray-200 shadow-md hover:bg-gray-50 hover:border-[#e9931c] flex items-center justify-center text-xl font-bold text-gray-700 hover:text-[#e9931c]"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      )}
      
      {/* Route Info Display – improved UI */}
      {routeInfo && routeToMilestone && showRouteInfoCard && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-xl p-4 pr-10 z-10 border border-[#e9931c]/30 max-w-sm ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setShowRouteInfoCard(false)}
            className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#e9931c]/10 flex items-center justify-center">
              <img src="/visit-icon.png" alt="Visit" className="w-7 h-7 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-gray-800 text-sm truncate">
                {routeToMilestone.waypoints && routeToMilestone.waypoints.length > 0
                  ? `Route – ${(routeToMilestone.waypoints.length + 1)} stops`
                  : `Route to ${routeToMilestone.milestone?.name || 'target'}`}
              </h3>
              <p className="text-xs text-gray-600 truncate" title="Destination (last stop)">
                {(() => {
                  const d = routeToMilestone.destinationTarget || routeToMilestone.milestone
                  return d?.name || d?.address || (d?.city && d?.state ? `${d.city}, ${d.state}` : '') || 'Destination'
                })()}
              </p>
            </div>
          </div>
          <div className="flex gap-4 py-3 border-t border-gray-100">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Distance</p>
              <p className="text-lg font-bold text-[#e9931c] mt-0.5">{routeInfo.distance}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</p>
              <p className="text-lg font-bold text-[#e9931c] mt-0.5">{routeInfo.duration}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Destination: {routeToMilestone.to?.lat != null && routeToMilestone.to?.lng != null
                ? `${Number(routeToMilestone.to.lat).toFixed(6)}, ${Number(routeToMilestone.to.lng).toFixed(6)}`
                : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default GoogleMapView

