/**
 * LeafletMapView – Free alternative to Google Maps
 * Uses: OpenStreetMap tiles, OSRM for routing, no API key or billing required.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'
const OSRM_TIMEOUT_MS = 8000
const MIN_ZOOM = 12
const ZOOM_SPECIFIC_PLACE = 14

// Straight-line distance in km (Haversine) – used when OSRM times out or is unreachable
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Fix default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const LeafletMapView = ({
  milestones = [],
  visitTargets = [],
  userLocation = null,
  onMarkerClick,
  onUserLocationClick,
  center = { lat: 28.6139, lng: 77.2090 },
  zoom = 11,
  height = '400px',
  showUserLocation = true,
  showRadius = true,
  routeToMilestone = null,
  isTracking = false,
  selectedTarget = null,
  onRouteInfoChange = null,
}) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [showRouteInfoCard, setShowRouteInfoCard] = useState(true)
  const markersRef = useRef([])
  const routeLayerRef = useRef(null)
  const lastBoundsKeyRef = useRef('')
  const trackingCenterSetRef = useRef(false)
  const prevIsTrackingRef = useRef(false)
  const lastSelectedTargetIdRef = useRef(null)
  const userHasManuallyMovedMapRef = useRef(false)
  const centerTimeoutRef = useRef(null)

  const centerArr = [center.lat, center.lng]

  useEffect(() => {
    if (!routeToMilestone) setShowRouteInfoCard(true)
  }, [routeToMilestone])

  // Init map
  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current, {
      center: centerArr,
      zoom: zoom,
      scrollWheelZoom: true,
      zoomControl: false,
    })
    // Carto Voyager – English/Latin labels globally (OSM default can show Urdu/local script)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    map.addControl(L.control.zoom({ position: 'topright' }))
    mapInstanceRef.current = map

    map.on('zoomend dragend', () => {
      userHasManuallyMovedMapRef.current = true
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const selectedTargetId = selectedTarget ? (selectedTarget._id || selectedTarget.id)?.toString() : null
  useEffect(() => {
    if (selectedTargetId && selectedTargetId !== lastSelectedTargetIdRef.current) {
      lastSelectedTargetIdRef.current = selectedTargetId
      trackingCenterSetRef.current = false
      userHasManuallyMovedMapRef.current = false
    }
    if (!selectedTargetId) lastSelectedTargetIdRef.current = null
  }, [selectedTargetId])

  // Center / bounds
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (userHasManuallyMovedMapRef.current) return
    if (!isTracking) {
      trackingCenterSetRef.current = false
      prevIsTrackingRef.current = false
    }
    if (isTracking && !prevIsTrackingRef.current) {
      trackingCenterSetRef.current = false
      prevIsTrackingRef.current = true
      userHasManuallyMovedMapRef.current = false
    }
    if (isTracking && trackingCenterSetRef.current) return

    if (userLocation && selectedTarget && selectedTarget.latitude != null && selectedTarget.longitude != null) {
      const selLat = parseFloat(selectedTarget.latitude)
      const selLng = parseFloat(selectedTarget.longitude)
      map.setView([selLat, selLng], ZOOM_SPECIFIC_PLACE)
      if (isTracking) trackingCenterSetRef.current = true
      return
    }
    if (userLocation && routeToMilestone) {
      const to = routeToMilestone.to
      if (to && to.lat != null && to.lng != null) {
        map.setView([to.lat, to.lng], MIN_ZOOM)
      } else {
        map.setView([userLocation.latitude, userLocation.longitude], MIN_ZOOM)
      }
      if (isTracking) trackingCenterSetRef.current = true
      return
    }
    if (userLocation && visitTargets.length > 0) {
      if (isTracking && trackingCenterSetRef.current) return
      centerTimeoutRef.current = setTimeout(() => {
        centerTimeoutRef.current = null
        if (!mapInstanceRef.current) return
        if (isTracking && trackingCenterSetRef.current) return
        const bounds = L.latLngBounds([[userLocation.latitude, userLocation.longitude]])
        visitTargets.forEach((t) => {
          if (t.latitude != null && t.longitude != null) {
            bounds.extend([parseFloat(t.latitude), parseFloat(t.longitude)])
          }
        })
        const key = bounds.toBBoxString()
        if (key === lastBoundsKeyRef.current) return
        lastBoundsKeyRef.current = key
        mapInstanceRef.current.fitBounds(bounds, { padding: [100, 100] })
        const z = mapInstanceRef.current.getZoom()
        if (z < MIN_ZOOM) mapInstanceRef.current.setZoom(MIN_ZOOM)
        if (isTracking) trackingCenterSetRef.current = true
      }, 550)
      return () => {
        if (centerTimeoutRef.current) clearTimeout(centerTimeoutRef.current)
      }
    }
    if (userLocation) {
      if (isTracking && trackingCenterSetRef.current) return
      map.setView([userLocation.latitude, userLocation.longitude], 11)
      if (isTracking) trackingCenterSetRef.current = true
      return
    }
    if (selectedTarget && selectedTarget.latitude != null && selectedTarget.longitude != null) {
      map.setView([parseFloat(selectedTarget.latitude), parseFloat(selectedTarget.longitude)], ZOOM_SPECIFIC_PLACE)
      return
    }
    const activeTargets = visitTargets.filter(
      (t) => t.status !== 'Completed' && t.status !== 'completed'
    )
    if (activeTargets.length === 1 && milestones.length === 0) {
      const t = activeTargets[0]
      if (t.latitude != null && t.longitude != null) {
        map.setView([parseFloat(t.latitude), parseFloat(t.longitude)], 13)
      }
    } else if (activeTargets.length > 0 || milestones.length > 0) {
      const bounds = L.latLngBounds([])
      milestones.forEach((m) => bounds.extend([m.latitude, m.longitude]))
      activeTargets.forEach((t) => {
        if (t.latitude != null && t.longitude != null) {
          bounds.extend([parseFloat(t.latitude), parseFloat(t.longitude)])
        }
      })
      map.fitBounds(bounds, { padding: [100, 100] })
      if (map.getZoom() < 12) map.setZoom(12)
    } else {
      map.setView(centerArr, zoom || 11)
    }
  }, [userLocation, milestones, visitTargets, center, zoom, routeToMilestone, selectedTarget, isTracking])

  // User marker
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !showUserLocation || !userLocation) return
    const lat = userLocation.latitude
    const lng = userLocation.longitude
    const existing = markersRef.current.find((m) => m.type === 'user')
    if (existing && existing.marker) {
      map.removeLayer(existing.marker)
    }
    markersRef.current = markersRef.current.filter((m) => m.type !== 'user')

    const userIcon = L.divIcon({
      className: 'leaflet-user-marker',
      html: `<div style="width:${isTracking ? 14 : 12}px;height:${isTracking ? 14 : 12}px;border-radius:50%;background:${isTracking ? '#10b981' : '#4285F4'};border:3px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
      iconSize: [isTracking ? 20 : 18, isTracking ? 20 : 18],
      iconAnchor: [(isTracking ? 20 : 18) / 2, (isTracking ? 20 : 18) / 2],
    })
    const marker = L.marker([lat, lng], { icon: userIcon }).addTo(map)
    marker.bindPopup(isTracking ? '📍 Tracking Active - Your Location' : 'Your Location')
    marker.on('click', () => {
      if (onUserLocationClick) onUserLocationClick()
    })
    markersRef.current.push({ type: 'user', marker })
  }, [userLocation, showUserLocation, isTracking, onUserLocationClick])

  // Visit target markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => {
      if (m.type === 'visitTarget' && m.marker) map.removeLayer(m.marker)
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'visitTarget')

    const valid = (visitTargets || []).filter(
      (t) =>
        t.latitude != null &&
        t.longitude != null &&
        !isNaN(parseFloat(t.latitude)) &&
        !isNaN(parseFloat(t.longitude))
    )
    valid.forEach((target) => {
      const lat = parseFloat(target.latitude)
      const lng = parseFloat(target.longitude)
      const visitIcon = L.divIcon({
        className: 'leaflet-visit-marker',
        html: `<img src="/visit-icon.png" alt="Visit" style="width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));" />`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })
      const marker = L.marker([lat, lng], { icon: visitIcon }).addTo(map)
      const content = `
        <div style="padding:8px;min-width:200px;">
          <strong style="font-size:14px;">🎯 ${target.name || 'Visit Target'}</strong>
          <p style="margin:4px 0 0 0;font-size:12px;color:#666;">
            ${target.address ? `📍 ${target.address}<br>` : ''}
            ${target.city || target.state ? `📍 ${[target.city, target.state].filter(Boolean).join(', ')}<br>` : ''}
            Status: <strong>${target.status || 'Pending'}</strong>
          </p>
        </div>
      `
      marker.bindPopup(content)
      marker.on('click', () => {
        if (onMarkerClick) onMarkerClick(target)
      })
      markersRef.current.push({ type: 'visitTarget', marker })
    })
  }, [visitTargets, onMarkerClick])

  // Milestone markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => {
      if (m.type === 'milestone' && m.marker) map.removeLayer(m.marker)
      if (m.type === 'circle' && m.circle) map.removeLayer(m.circle)
    })
    markersRef.current = markersRef.current.filter((m) => m.type !== 'milestone' && m.type !== 'circle')

    milestones.forEach((milestone) => {
      const pos = [milestone.latitude, milestone.longitude]
      const color = milestone.status === 'completed' ? '#10b981' : '#EA4335'
      const icon = L.divIcon({
        className: 'leaflet-milestone-marker',
        html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      const marker = L.marker(pos, { icon }).addTo(map)
      marker.bindPopup(`<div style="min-width:180px;"><strong>${milestone.name}</strong><br/>${milestone.address || ''}<br/>Status: ${milestone.status}</div>`)
      marker.on('click', () => {
        if (onMarkerClick) onMarkerClick(milestone)
      })
      markersRef.current.push({ type: 'milestone', marker })
      if (showRadius && milestone.status === 'pending' && milestone.radius) {
        const circle = L.circle(pos, {
          radius: milestone.radius,
          color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 2,
        }).addTo(map)
        markersRef.current.push({ type: 'circle', circle })
      }
    })
  }, [milestones, showRadius, onMarkerClick])

  // OSRM route
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !routeToMilestone) {
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current)
        routeLayerRef.current = null
      }
      setRouteInfo(null)
      if (onRouteInfoChange) onRouteInfoChange(null)
      return
    }

    const from = routeToMilestone.from
    const to = routeToMilestone.to
    if (!from || !to || from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
      setRouteInfo(null)
      if (onRouteInfoChange) onRouteInfoChange(null)
      return
    }

    const waypoints = routeToMilestone.waypoints && Array.isArray(routeToMilestone.waypoints) ? routeToMilestone.waypoints.filter(w => w && w.lat != null && w.lng != null) : []
    const allPoints = [from, ...waypoints, to]
    const coords = allPoints.map(p => `${p.lng},${p.lat}`).join(';')
    const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`

    const applyStraightLineFallback = () => {
      const latLngs = allPoints.map(p => [p.lat, p.lng])
      let distanceKmVal = 0
      for (let i = 0; i < latLngs.length - 1; i++) {
        distanceKmVal += haversineKm(latLngs[i][0], latLngs[i][1], latLngs[i + 1][0], latLngs[i + 1][1])
      }
      if (latLngs.length < 2) distanceKmVal = haversineKm(from.lat, from.lng, to.lat, to.lng)
      const distanceM = distanceKmVal * 1000
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current)
      }
      const polyline = L.polyline(latLngs, {
        color: '#ea580c',
        weight: 5,
        opacity: 0.9,
        dashArray: '10, 10',
      }).addTo(map)
      routeLayerRef.current = polyline
      const distanceKm = distanceKmVal.toFixed(2)
      const distanceText = `${distanceKmVal.toFixed(1)} km (straight)`
      const durationMin = Math.max(1, Math.round((distanceKmVal / 40) * 60))
      const info = {
        distance: distanceText,
        duration: `~${durationMin} min`,
        distanceValue: distanceM,
        durationValue: durationMin * 60,
        distanceKm,
      }
      setRouteInfo(info)
      if (onRouteInfoChange) onRouteInfoChange(info)
      if (!userHasManuallyMovedMapRef.current) {
        const bounds = L.latLngBounds(latLngs)
        map.fitBounds(bounds, { padding: [80, 80] })
        if (map.getZoom() < 10) map.setZoom(10)
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeoutId)
        if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
          applyStraightLineFallback()
          return
        }
        const route = data.routes[0]
        const geom = route.geometry && route.geometry.coordinates
        if (!geom || geom.length < 2) {
          applyStraightLineFallback()
          return
        }
        const latLngs = geom.map(([lng, lat]) => [lat, lng])
        if (routeLayerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current)
        }
        const polyline = L.polyline(latLngs, {
          color: '#ea580c',
          weight: 6,
          opacity: 0.95,
        }).addTo(map)
        routeLayerRef.current = polyline

        const distanceM = route.distance || 0
        const durationS = route.duration || 0
        const distanceKm = (distanceM / 1000).toFixed(2)
        const distanceText = `${(distanceM / 1000).toFixed(1)} km`
        const durationText = `${Math.round(durationS / 60)} min`
        const info = {
          distance: distanceText,
          duration: durationText,
          distanceValue: distanceM,
          durationValue: durationS,
          distanceKm,
        }
        setRouteInfo(info)
        if (onRouteInfoChange) onRouteInfoChange(info)

        if (!userHasManuallyMovedMapRef.current) {
          const bounds = L.latLngBounds(latLngs)
          map.fitBounds(bounds, { padding: [80, 80] })
          if (map.getZoom() < 10) map.setZoom(10)
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        applyStraightLineFallback()
      })
  }, [routeToMilestone, onRouteInfoChange])

  useEffect(() => {
    if (!mapInstanceRef.current || !routeToMilestone) return
    if (!routeToMilestone && routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
      setRouteInfo(null)
      if (onRouteInfoChange) onRouteInfoChange(null)
    }
  }, [routeToMilestone, onRouteInfoChange])

  const mapHeight = height === '100%' ? '100%' : (typeof height === 'string' ? height : `${height}px`)
  const wrapperMinHeight = height === '100%' ? 0 : '400px'

  return (
    <div
      style={{
        height: mapHeight,
        width: '100%',
        position: 'relative',
        minHeight: wrapperMinHeight,
        display: 'flex',
        flexDirection: 'column',
      }}
      className="rounded-lg overflow-hidden border-2 border-gray-200"
    >
      <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: 0, flex: 1 }} />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-[11]">
        <button
          type="button"
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1)
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
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() - 1)
              userHasManuallyMovedMapRef.current = true
            }
          }}
          className="w-10 h-10 rounded-lg bg-white border-2 border-gray-200 shadow-md hover:bg-gray-50 hover:border-[#e9931c] flex items-center justify-center text-xl font-bold text-gray-700 hover:text-[#e9931c]"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

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
                {routeToMilestone.waypoints?.length > 0
                  ? `Route – ${(routeToMilestone.waypoints.length + 1)} stops`
                  : `Route to ${routeToMilestone.milestone?.name || routeToMilestone.destinationTarget?.name || 'target'}`}
              </h3>
              <p className="text-xs text-gray-600 truncate">
                {(routeToMilestone.destinationTarget || routeToMilestone.milestone)?.name || 'Destination'}
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

export default LeafletMapView
