import { useEffect, useRef, useState } from 'react'

const GoogleMapView = ({
  milestones = [],
  visitTargets = [],
  userLocation = null,
  onMarkerClick,
  onUserLocationClick, // Handler for user location marker click
  center = { lat: 28.6139, lng: 77.2090 }, // Default: Delhi
  zoom = 13,
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
  const [mapError, setMapError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const markersRef = useRef([])

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

        // Create map instance with custom styling
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center: center,
          zoom: zoom,
          mapTypeId: 'roadmap',
          styles: customMapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_CENTER,
            style: window.google.maps.ZoomControlStyle.SMALL
          },
          streetViewControl: false,
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_TOP
          },
          mapTypeControl: false,
          gestureHandling: 'cooperative', // Better mobile experience
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

        // Initialize Directions Renderer
        const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
          map: mapInstance,
          suppressMarkers: false,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: '#e9931c', // Orange color matching app theme
            strokeWeight: 6, // Clean line thickness
            strokeOpacity: 0.9, // Slightly transparent for better look
            zIndex: 1000,
            icons: [{
              icon: {
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4, // Clean arrow size
                strokeColor: '#ffffff',
                strokeWeight: 2,
                fillColor: '#e9931c',
                fillOpacity: 1,
              },
              offset: '100%',
              repeat: '80px', // Clean arrow spacing
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

  // Update map center - Show both user location and selected target
  useEffect(() => {
    if (!map) return

    // Priority 1: If we have both user location and selected target, fit bounds to show both
    if (userLocation && selectedTarget && selectedTarget.latitude && selectedTarget.longitude) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude })
      bounds.extend({ lat: parseFloat(selectedTarget.latitude), lng: parseFloat(selectedTarget.longitude) })
      map.fitBounds(bounds, { padding: 100 })
    }
    // Priority 2: If we have both user location and route to target, fit bounds to show both
    else if (userLocation && routeToMilestone) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude })
      bounds.extend({ lat: routeToMilestone.to.lat, lng: routeToMilestone.to.lng })
      map.fitBounds(bounds, { padding: 100 })
    } 
    // Priority 3: If user location and visit targets, fit bounds to show user and all targets
    else if (userLocation && visitTargets.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude })
      visitTargets.forEach((target) => {
        if (target.latitude && target.longitude) {
          bounds.extend({ lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) })
        }
      })
      map.fitBounds(bounds, { padding: 100 })
    } 
    // Priority 4: Only user location available
    else if (userLocation) {
      map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude })
      map.setZoom(13)
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
          map.setZoom(16) // Close zoom for single location
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
        // Ensure minimum zoom level after fitBounds completes
        setTimeout(() => {
          if (map.getZoom() < 15) {
            map.setZoom(15) // Minimum zoom of 15 for better visibility of live locations
          }
        }, 100)
      }
    } 
    // Priority 6: Default center
    else {
      map.setCenter(center)
      map.setZoom(zoom || 13)
    }
  }, [map, userLocation, milestones, visitTargets, center, zoom, routeToMilestone, selectedTarget])

  // Add user location marker with blinking effect
  useEffect(() => {
    if (!map || !showUserLocation || !userLocation) return

    // Remove existing user marker
    markersRef.current.forEach((marker) => {
      if (marker.type === 'user') {
        marker.marker.setMap(null)
      }
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'user')

    // Create user marker with blue circular icon (like Google Maps)
    const userMarker = new window.google.maps.Marker({
      position: { lat: userLocation.latitude, lng: userLocation.longitude },
      map: map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isTracking ? 14 : 12,
        fillColor: isTracking ? '#10b981' : '#4285F4', // Google Maps blue
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: isTracking ? '📍 Tracking Active - Your Location' : 'Your Location',
      animation: null, // No bounce for user location
      zIndex: 1000,
    })

    // Add info window with clean styling
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <strong style="font-size: 14px; color: #1f2937; display: block; margin-bottom: 8px;">${isTracking ? '📍 Tracking Active' : '📍 Your Location'}</strong>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
            <div>Lat: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${userLocation.latitude.toFixed(6)}</code></div>
            <div style="margin-top: 4px;">Lng: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${userLocation.longitude.toFixed(6)}</code></div>
          </div>
        </div>
      `,
    })

    userMarker.addListener('click', () => {
      // Open info window
      infoWindow.open(map, userMarker)
    })

    markersRef.current.push({ type: 'user', marker: userMarker })
  }, [map, userLocation, showUserLocation, isTracking, onUserLocationClick])

  // Add milestone markers
  useEffect(() => {
    if (!map) return

    // Remove existing milestone markers
    markersRef.current.forEach((marker) => {
      if (marker.type === 'milestone') {
        marker.marker.setMap(null)
      }
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'milestone')

    // Remove existing circles
    markersRef.current.forEach((marker) => {
      if (marker.type === 'circle') {
        marker.circle.setMap(null)
      }
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'circle')

    // Add milestone markers with red teardrop pin icon (like Google Maps destination)
    milestones.forEach((milestone) => {
      const isPending = milestone.status === 'pending'
      const isCompleted = milestone.status === 'completed'
      
      // Use red teardrop pin for pending milestones (like destination in Google Maps)
      // Use green pin for completed milestones
      const color = isCompleted ? '#10b981' : '#EA4335' // Green for completed, Red for pending
      
      // Use Google Maps default pin icons (red teardrop for destination)
      const milestoneMarker = new window.google.maps.Marker({
        position: { lat: milestone.latitude, lng: milestone.longitude },
        map: map,
        // Default Google Maps red pin (teardrop shape) for pending milestones
        // Green pin for completed milestones
        icon: isCompleted 
          ? {
              url: 'http://maps.google.com/mapfiles/ms/icons/green.png',
              scaledSize: new window.google.maps.Size(32, 32),
            }
          : {
              // Red teardrop pin (Google Maps destination style)
              url: 'http://maps.google.com/mapfiles/ms/icons/red.png',
              scaledSize: new window.google.maps.Size(isPending ? 40 : 32, isPending ? 40 : 32),
            },
        title: milestone.name,
        animation: isPending ? window.google.maps.Animation.BOUNCE : null, // Bounce for pending milestones
        zIndex: isPending ? 2000 : 1500, // Higher z-index for pending
      })

      // Add info window with clean styling
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <strong style="font-size: 15px; color: #1f2937; display: block; margin-bottom: 8px;">${milestone.name}</strong>
            <div style="font-size: 12px; color: #6b7280; line-height: 1.6;">
              ${milestone.address ? `<div style="margin-bottom: 6px;">📍 ${milestone.address}</div>` : ''}
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <div style="margin-bottom: 4px;"><strong>Status:</strong> <span style="color: ${color}">${milestone.status}</span></div>
                <div style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
                  <div>Lat: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${milestone.latitude.toFixed(6)}</code></div>
                  <div style="margin-top: 2px;">Lng: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${milestone.longitude.toFixed(6)}</code></div>
                </div>
              </div>
              <button 
                onclick="window.dispatchEvent(new CustomEvent('milestoneClick', { detail: ${JSON.stringify(milestone)} }))"
                style="margin-top: 10px; padding: 8px 16px; background: #e9931c; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; width: 100%; transition: background 0.2s;"
                onmouseover="this.style.background='#d17a0f'"
                onmouseout="this.style.background='#e9931c'"
              >
                View Details
              </button>
            </div>
          </div>
        `,
      })

      milestoneMarker.addListener('click', () => {
        infoWindow.open(map, milestoneMarker)
        if (onMarkerClick) {
          onMarkerClick(milestone)
        }
      })

      markersRef.current.push({ type: 'milestone', marker: milestoneMarker })

      // Add radius circle for pending milestones
      if (showRadius && milestone.status === 'pending' && milestone.radius) {
        const circle = new window.google.maps.Circle({
          strokeColor: color,
          strokeOpacity: 0.3,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.1,
          map: map,
          center: { lat: milestone.latitude, lng: milestone.longitude },
          radius: milestone.radius, // in meters
        })

        markersRef.current.push({ type: 'circle', circle: circle })
      }
    })

    // Listen for custom milestone click event
    const handleMilestoneClick = (event) => {
      if (onMarkerClick) {
        onMarkerClick(event.detail)
      }
    }
    window.addEventListener('milestoneClick', handleMilestoneClick)

    return () => {
      window.removeEventListener('milestoneClick', handleMilestoneClick)
    }
  }, [map, milestones, showRadius, onMarkerClick])

  // Add visit target markers
  useEffect(() => {
    if (!map) {
      // Silently return if map not ready
      return
    }

    if (!visitTargets || visitTargets.length === 0) {
      // Silently return if no targets
      // Still clean up existing markers
      markersRef.current.forEach((marker) => {
        if (marker.type === 'visitTarget') {
          marker.marker.setMap(null)
        }
        if (marker.type === 'visitTargetCircle') {
          marker.circle.setMap(null)
        }
      })
      markersRef.current = markersRef.current.filter((m) => m.type !== 'visitTarget' && m.type !== 'visitTargetCircle')
      return
    }

    console.log('Rendering visit targets on map:', visitTargets.length)

    // Remove existing visit target markers
    markersRef.current.forEach((marker) => {
      if (marker.type === 'visitTarget') {
        marker.marker.setMap(null)
      }
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'visitTarget')

    // Remove existing visit target circles
    markersRef.current.forEach((marker) => {
      if (marker.type === 'visitTargetCircle') {
        marker.circle.setMap(null)
      }
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'visitTargetCircle')

    // Add visit target markers with orange/yellow pin icon
    // Filter out completed targets - only show pending/in-progress targets on map
    const activeTargets = visitTargets.filter(target => 
      target.status !== 'Completed' && target.status !== 'completed'
    )
    
    console.log('GoogleMapView - Processing visit targets:', activeTargets.length, '(filtered from', visitTargets.length, 'total)')
    activeTargets.forEach((target) => {
      console.log('GoogleMapView - Target:', target.name, 'Coords:', target.latitude, target.longitude)
      // Validate coordinates
      if (!target.latitude || !target.longitude || 
          isNaN(parseFloat(target.latitude)) || 
          isNaN(parseFloat(target.longitude))) {
        console.warn('Invalid coordinates for visit target:', target.name, target)
        return
      }

      const isPending = target.status === 'Pending' || target.status === 'In Progress'
      // Completed targets are already filtered out, so no need to check isCompleted
      
      // Use custom styled pin for visit targets (clean, professional look)
      const visitTargetMarker = new window.google.maps.Marker({
        position: { lat: parseFloat(target.latitude), lng: parseFloat(target.longitude) },
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isPending ? 10 : 8,
          fillColor: '#e9931c', // Orange for active targets (completed are filtered out)
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: target.name || 'Visit Target',
        animation: null, // No animation for cleaner look
        zIndex: isPending ? 1900 : 1400,
      })

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
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
        `,
      })

      visitTargetMarker.addListener('click', () => {
        infoWindow.open(map, visitTargetMarker)
        if (onMarkerClick) {
          onMarkerClick(target)
        }
      })

      markersRef.current.push({ type: 'visitTarget', marker: visitTargetMarker })

      // Proximity radius circle REMOVED - Not needed for visit targets
    })
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

    // Initialize Directions Renderer if not already done
    if (!directionsRenderer) {
      const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: '#e9931c', // Orange color matching app theme
          strokeWeight: 7, // Thicker line for better visibility
          strokeOpacity: 1.0, // Full opacity for sharpness
          zIndex: 1000,
          icons: [{
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5, // Larger arrows
              strokeColor: '#ffffff',
              strokeWeight: 2,
              fillColor: '#e9931c',
              fillOpacity: 1,
            },
            offset: '100%',
            repeat: '60px', // More frequent arrows
          }],
        },
      })
      setDirectionsRenderer(directionsRendererInstance)
    }

    // Wait for services to be ready
    const currentDirectionsService = directionsService || new window.google.maps.DirectionsService()
    const currentDirectionsRenderer = directionsRenderer || new window.google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: '#e9931c', // Orange color matching app theme
        strokeWeight: 7, // Thicker line for better visibility
        strokeOpacity: 1.0, // Full opacity for sharpness
        zIndex: 1000,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5, // Larger arrows
            strokeColor: '#ffffff',
            strokeWeight: 2,
            fillColor: '#e9931c',
            fillOpacity: 1,
          },
          offset: '100%',
          repeat: '60px', // More frequent arrows
        }],
      },
    })

    const request = {
      origin: { lat: routeToMilestone.from.lat, lng: routeToMilestone.from.lng },
      destination: { lat: routeToMilestone.to.lat, lng: routeToMilestone.to.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false, // No waypoints to optimize
      provideRouteAlternatives: false, // Get best route only
      avoidHighways: false,
      avoidTolls: false,
      // Request the best route (shortest/fastest based on traffic)
      unitSystem: window.google.maps.UnitSystem.METRIC,
    }

    currentDirectionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        currentDirectionsRenderer.setDirections(result)

        // Extract route information
        const route = result.routes[0]
        const leg = route.legs[0]
        
        const routeInfoData = {
          distance: leg.distance.text,
          duration: leg.duration.text,
          distanceValue: leg.distance.value, // in meters
          durationValue: leg.duration.value, // in seconds
          distanceKm: (leg.distance.value / 1000).toFixed(2), // in km
        }
        setRouteInfo(routeInfoData)
        
        // Pass route info to parent component
        if (onRouteInfoChange) {
          onRouteInfoChange(routeInfoData)
        }

        // Fit map to show route with padding
        const bounds = new window.google.maps.LatLngBounds()
        result.routes[0].overview_path.forEach((point) => {
          bounds.extend(point)
        })
        // Add origin and destination to bounds for better view
        bounds.extend({ lat: routeToMilestone.from.lat, lng: routeToMilestone.from.lng })
        bounds.extend({ lat: routeToMilestone.to.lat, lng: routeToMilestone.to.lng })
        map.fitBounds(bounds, { padding: 50 })
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
      // Only show once, not on every render
      if (!window.__mapsWarningShown) {
        console.warn(
          '%c⚠️ DEVELOPMENT PURPOSE ONLY ⚠️',
          'color: #facc15; font-size: 14px; font-weight: bold; background: #000; padding: 4px;'
        )
        console.warn('Google Maps setup is for DEVELOPMENT/TESTING PURPOSE ONLY.')
        console.warn('Billing & deprecated Marker API are used temporarily.')
        console.warn('Will migrate to production-ready setup before deployment.')
        window.__mapsWarningShown = true
      }
    }
  }, [])

  // Convert height prop to proper CSS value
  const mapHeight = height === '100%' ? '100%' : (typeof height === 'string' ? height : `${height}px`)
  
  return (
    <div style={{ height: mapHeight, width: '100%', position: 'relative', minHeight: '400px' }} className="rounded-lg overflow-hidden border-2 border-gray-200">
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
      
      <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: '400px', position: 'relative' }}></div>
      
      {/* Route Info Display */}
      {routeInfo && routeToMilestone && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10 border-2 border-[#e9931c]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📍</span>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Route to {routeToMilestone.milestone.name}</h3>
              <p className="text-xs text-gray-600">{routeToMilestone.milestone.address}</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500">Distance</p>
              <p className="text-lg font-bold text-[#e9931c]">{routeInfo.distance}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Time</p>
              <p className="text-lg font-bold text-[#e9931c]">{routeInfo.duration}</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Coordinates: {routeToMilestone.to.lat.toFixed(6)}, {routeToMilestone.to.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default GoogleMapView

