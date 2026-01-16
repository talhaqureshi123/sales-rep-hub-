import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const MapView = ({
  milestones = [],
  userLocation = null,
  onMarkerClick,
  center = [28.6139, 77.2090], // Default: Delhi
  zoom = 13,
  height = '400px',
  showUserLocation = true,
  showRadius = true,
  routeToMilestone = null,
  isTracking = false,
}) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const routeLayerRef = useRef(null)
  const userMarkerRef = useRef(null)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return

    // Create map instance
    const map = L.map(mapRef.current, {
      center: center,
      zoom: zoom,
      scrollWheelZoom: true,
      attributionControl: false, // Disable default attribution
    })

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // Only run once on mount

  // Update map center and fit bounds to show all milestones
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // If we have milestones, fit bounds to show all of them
    if (milestones.length > 0) {
      const bounds = L.latLngBounds([])
      
      // Add all milestone locations to bounds
      milestones.forEach((milestone) => {
        bounds.extend([milestone.latitude, milestone.longitude])
      })
      
      // Add user location if available
      if (userLocation) {
        bounds.extend([userLocation.latitude, userLocation.longitude])
      }
      
      // Fit map to show all markers with some padding
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] })
    } else if (userLocation) {
      // If only user location, center on it
      mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], zoom)
    } else {
      // Default center
      mapInstanceRef.current.setView(center, zoom)
    }
  }, [userLocation, milestones, center, zoom])

  // Add/Update user location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !showUserLocation || !userLocation) return

    // Remove existing user marker
    const existingUserMarker = markersRef.current.find(m => m.type === 'user')
    if (existingUserMarker) {
      mapInstanceRef.current.removeLayer(existingUserMarker.marker)
      markersRef.current = markersRef.current.filter(m => m.type !== 'user')
    }

    // Create user location marker with blinking effect when tracking
    const blinkClass = isTracking ? 'blinking-marker' : ''
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `<div class="${blinkClass}" style="
        width: 24px;
        height: 24px;
        background-color: ${isTracking ? '#10b981' : '#3b82f6'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: ${isTracking ? 'pulse 1.5s infinite' : 'none'};
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: userIcon,
    }).addTo(mapInstanceRef.current)

    userMarker.bindPopup(isTracking ? '📍 Tracking Active - Your Location' : 'Your Location')
    userMarkerRef.current = userMarker

    markersRef.current.push({ type: 'user', marker: userMarker })
  }, [userLocation, showUserLocation, isTracking])

  // Add/Update milestone markers
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Remove existing milestone markers
    const milestoneMarkers = markersRef.current.filter(m => m.type === 'milestone')
    milestoneMarkers.forEach(({ marker }) => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = markersRef.current.filter(m => m.type !== 'milestone')

    // Remove existing circles
    const circles = markersRef.current.filter(m => m.type === 'circle')
    circles.forEach(({ marker }) => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = markersRef.current.filter(m => m.type !== 'circle')

    // Add milestone markers
    milestones.forEach((milestone) => {
      const color = milestone.status === 'completed' ? 'green' : '#e9931c'
      const milestoneIcon = L.divIcon({
        className: 'custom-milestone-marker',
        html: `<div style="
          width: 30px;
          height: 30px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })

      const marker = L.marker([milestone.latitude, milestone.longitude], {
        icon: milestoneIcon,
      }).addTo(mapInstanceRef.current)

      // Create popup content
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 8px; color: #1f2937;">${milestone.name}</h3>
          <p style="font-size: 14px; color: #4b5563; margin-bottom: 4px;">${milestone.address}</p>
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
            Status: <span style="font-weight: 600; color: ${milestone.status === 'completed' ? '#10b981' : '#f59e0b'};">${milestone.status}</span>
          </p>
          <button 
            onclick="window.dispatchEvent(new CustomEvent('milestoneClick', { detail: ${JSON.stringify(milestone)} }))"
            style="
              width: 100%;
              padding: 8px 12px;
              background-color: #e9931c;
              color: white;
              border: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 12px;
              cursor: pointer;
              margin-top: 8px;
            "
          >
            View Details
          </button>
        </div>
      `

      marker.bindPopup(popupContent)
      
      // Click handler for marker
      marker.on('click', (e) => {
        e.originalEvent.stopPropagation()
        if (onMarkerClick) {
          onMarkerClick(milestone)
        }
      })
      
      // Also handle popup open to trigger click
      marker.on('popupopen', () => {
        // Popup opened - milestone is being viewed
      })

      markersRef.current.push({ type: 'milestone', marker, milestoneId: milestone.id })

      // Add radius circle for pending milestones
      if (showRadius && milestone.status === 'pending') {
        const circle = L.circle([milestone.latitude, milestone.longitude], {
          radius: milestone.radius,
          color: '#e9931c',
          fillColor: '#e9931c',
          fillOpacity: 0.1,
          weight: 2,
        }).addTo(mapInstanceRef.current)

        markersRef.current.push({ type: 'circle', marker: circle, milestoneId: milestone.id })
      }
    })

    // Listen for custom event from popup button
    const handleMilestoneClick = (event) => {
      if (onMarkerClick) {
        onMarkerClick(event.detail)
      }
    }
    window.addEventListener('milestoneClick', handleMilestoneClick)

    return () => {
      window.removeEventListener('milestoneClick', handleMilestoneClick)
    }
  }, [milestones, showRadius, onMarkerClick])

  // Add route to milestone
  useEffect(() => {
    if (!mapInstanceRef.current || !routeToMilestone) return

    // Remove existing route
    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current)
    }

    // Draw route line (straight line for now, can be enhanced with routing API)
    const routeCoordinates = [
      [routeToMilestone.from.lat, routeToMilestone.from.lng],
      [routeToMilestone.to.lat, routeToMilestone.to.lng]
    ]

    const route = L.polyline(routeCoordinates, {
      color: '#e9931c',
      weight: 6,
      opacity: 0.8,
      dashArray: '15, 10',
    }).addTo(mapInstanceRef.current)
    
    routeLayerRef.current = route
    route.bindPopup(`📍 Route to ${routeToMilestone.milestone.name}`)

    // Fit map to show route
    const bounds = L.latLngBounds(routeCoordinates)
    mapInstanceRef.current.fitBounds(bounds, { padding: [100, 100] })

    return () => {
      if (routeLayerRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current)
        routeLayerRef.current = null
      }
    }
  }, [routeToMilestone])

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border-2 border-gray-200 relative z-0">
      <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 0 }}></div>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.3);
          }
        }
        .blinking-marker {
          animation: pulse 1.5s infinite;
        }
      `}</style>
    </div>
  )
}

export default MapView
