import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

const QRCameraScanner = ({ onScanSuccess, onClose }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [cameraId, setCameraId] = useState(null)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    // Get available cameras with better error handling
    const initCamera = async () => {
      try {
        const devices = await Html5Qrcode.getCameras()
        console.log('Available cameras:', devices)
        
        if (devices && devices.length > 0) {
          // For mobile: prefer back camera
          // For laptop/desktop: prefer front camera or first available
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          
          let selectedCamera = null
          
          if (isMobile) {
            // Mobile: prefer back camera
            selectedCamera = devices.find(device => 
              device.label.toLowerCase().includes('back') || 
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('environment')
            ) || devices[0]
          } else {
            // Laptop/Desktop: prefer front camera or first available
            selectedCamera = devices.find(device => 
              device.label.toLowerCase().includes('front') || 
              device.label.toLowerCase().includes('face') ||
              device.label.toLowerCase().includes('user')
            ) || devices[0]
          }
          
          setCameraId(selectedCamera.id)
          setError('')
          console.log('Selected camera:', selectedCamera.label, selectedCamera.id)
        } else {
          setError('No camera found. Please ensure your laptop/device has a camera connected and enabled.')
        }
      } catch (err) {
        console.error('Error getting cameras:', err)
        let errorMessage = 'Error accessing camera. '
        
        if (err.name === 'NotAllowedError' || err.message?.includes('permission') || err.message?.includes('denied')) {
          errorMessage += 'Camera permission denied.\n\nPlease:\n1. Click the lock/camera icon in browser address bar (top left)\n2. Allow camera access\n3. Refresh this page and try again'
        } else if (err.name === 'NotFoundError' || err.message?.includes('no camera') || err.message?.includes('not found')) {
          errorMessage += 'No camera found on your laptop. Please check if camera is connected and enabled in system settings.'
        } else if (err.name === 'NotReadableError' || err.message?.includes('already in use') || err.message?.includes('in use')) {
          errorMessage += 'Camera is being used by another application (Zoom, Teams, etc.). Please close other apps using camera and try again.'
        } else if (err.message?.includes('HTTPS') || err.message?.includes('secure context')) {
          errorMessage += 'Camera requires secure connection. Using localhost is fine, but please check browser settings.'
        } else {
          errorMessage += `Error: ${err.message || err.name || 'Unknown error'}. Please check browser console for details.`
        }
        
        setError(errorMessage)
      }
    }

    initCamera()

    return () => {
      // Cleanup on unmount
      if (html5QrCodeRef.current) {
        stopScanning()
      }
    }
  }, [])

  const startScanning = useCallback(async () => {
    console.log('Start scanning clicked, cameraId:', cameraId)
    
    if (!cameraId) {
      setError('No camera available. Please refresh the page and allow camera permissions.')
      // Try to get camera again
      try {
        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length > 0) {
          setCameraId(devices[0].id)
          // Retry after setting camera
          setTimeout(() => startScanning(), 100)
        }
      } catch (e) {
        console.error('Error getting cameras:', e)
      }
      return
    }

    // Set scanning state immediately for UI feedback
    setIsScanning(true)
    setError('')

    // Stop any existing scanner first
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop().catch(() => {})
        html5QrCodeRef.current.clear().catch(() => {})
      } catch (e) {
        // Ignore errors
      }
      html5QrCodeRef.current = null
    }

    try {
      // Check if element exists
      const element = document.getElementById('qr-reader')
      if (!element) {
        setError('Scanner element not found. Please refresh the page.')
        setIsScanning(false)
        return
      }

      console.log('Creating Html5Qrcode instance...')
      const html5QrCode = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = html5QrCode
      
      console.log('Starting camera with ID:', cameraId)

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            // Use 80% of viewfinder for better mobile experience
            // Minimum size must be 50px as per library requirement
            const minEdgePercentage = 0.8
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight)
            let qrboxSize = Math.floor(minEdgeSize * minEdgePercentage)
            // Ensure minimum 50px size
            if (qrboxSize < 50) {
              qrboxSize = Math.min(50, Math.min(viewfinderWidth, viewfinderHeight))
            }
            return {
              width: qrboxSize,
              height: qrboxSize
            }
          },
          aspectRatio: 1.0,
        },
        (decodedText, decodedResult) => {
          // Successfully scanned
          handleScanSuccess(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors (they happen continuously during scanning)
          // Only log if it's not a common scanning error
          if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No MultiFormat Readers')) {
            // These are normal scanning errors, ignore them
          }
        }
      )

      console.log('Camera started successfully')
      // State already set above
    } catch (err) {
      console.error('Error starting scanner:', err)
      setIsScanning(false)
      let errorMessage = 'Failed to start camera. '
      
      if (err.name === 'NotAllowedError' || err.message?.includes('permission') || err.message?.includes('denied')) {
        errorMessage += 'Camera permission denied.\n\nSteps to fix:\n1. Look at browser address bar (top left)\n2. Click the lock/camera icon\n3. Change camera setting to "Allow"\n4. Refresh page and click "Start Camera" again'
      } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
        errorMessage += 'Camera not found. Please ensure your laptop camera is enabled in system settings.'
      } else if (err.name === 'NotReadableError' || err.message?.includes('in use')) {
        errorMessage += 'Camera is busy. Please close Zoom, Teams, Skype, or other apps using camera, then try again.'
      } else if (err.message?.includes('HTTPS') || err.message?.includes('secure')) {
        errorMessage += 'Secure connection required. Localhost should work. If error persists, check browser settings.'
      } else {
        errorMessage += `Error: ${err.message || err.name || 'Unknown'}. Check browser console (F12) for details.`
      }
      
      setError(errorMessage)
      setIsScanning(false)
    }
  }, [cameraId])

  // Auto-start camera when cameraId is available
  useEffect(() => {
    if (cameraId && !isScanning && !error) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanning()
      }, 300)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId])

  const stopScanning = () => {
    if (html5QrCodeRef.current) {
      // Stop scanning first
      html5QrCodeRef.current
        .stop()
        .then(() => {
          // Clear the scanner with error handling
          try {
            if (html5QrCodeRef.current) {
              html5QrCodeRef.current.clear().catch((clearErr) => {
                // Ignore clear errors - element might already be removed by React
                console.log('Scanner already cleared:', clearErr.message)
              })
            }
          } catch (clearErr) {
            // Ignore clear errors
            console.log('Scanner clear error (safe to ignore):', clearErr.message)
          }
          // Reset ref
          html5QrCodeRef.current = null
          setIsScanning(false)
        })
        .catch((err) => {
          // If stop fails, still try to clear and reset
          console.error('Error stopping scanner:', err)
          try {
            if (html5QrCodeRef.current) {
              html5QrCodeRef.current.clear().catch(() => {})
            }
          } catch (e) {
            // Ignore
          }
          html5QrCodeRef.current = null
          setIsScanning(false)
        })
    } else {
      setIsScanning(false)
    }
  }

  const handleScanSuccess = (code) => {
    // Stop camera immediately with proper cleanup
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current
        .stop()
        .then(() => {
          try {
            html5QrCodeRef.current?.clear().catch(() => {})
          } catch (e) {
            // Ignore clear errors
          }
          html5QrCodeRef.current = null
          setIsScanning(false)
          
          // Close modal immediately
          if (onClose) {
            onClose()
          }
          // Then process the scanned code
          if (onScanSuccess) {
            // Small delay to ensure camera is fully stopped before processing
            setTimeout(() => {
              onScanSuccess(code)
            }, 100)
          }
        })
        .catch((err) => {
          console.log('Error stopping scanner (safe to ignore):', err)
          html5QrCodeRef.current = null
          setIsScanning(false)
          
          // Still close and process
          if (onClose) {
            onClose()
          }
          if (onScanSuccess) {
            setTimeout(() => {
              onScanSuccess(code)
            }, 100)
          }
        })
    } else {
      // If scanner not running, just close and process
      if (onClose) {
        onClose()
      }
      if (onScanSuccess) {
        onScanSuccess(code)
      }
    }
  }

  const handleClose = () => {
    stopScanning()
    if (onClose) {
      onClose()
    }
  }

  // Ensure component always renders something
  if (!onClose) {
    console.error('QRCameraScanner: onClose prop is required')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">Scan QR Code</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
              <button
                onClick={async () => {
                  setError('')
                  // Try to get cameras again
                  try {
                    const devices = await Html5Qrcode.getCameras()
                    if (devices && devices.length > 0) {
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                      
                      let selectedCamera = null
                      if (isMobile) {
                        selectedCamera = devices.find(device => 
                          device.label.toLowerCase().includes('back') || 
                          device.label.toLowerCase().includes('rear')
                        ) || devices[0]
                      } else {
                        // Laptop: prefer front camera
                        selectedCamera = devices.find(device => 
                          device.label.toLowerCase().includes('front') || 
                          device.label.toLowerCase().includes('face') ||
                          device.label.toLowerCase().includes('user')
                        ) || devices[0]
                      }
                      
                      setCameraId(selectedCamera.id)
                      setError('')
                      console.log('Camera retry successful:', selectedCamera.label)
                    } else {
                      setError('Still no camera found. Please check if camera is enabled in system settings.')
                    }
                  } catch (err) {
                    console.error('Retry error:', err)
                    setError('Unable to access camera. Please check browser permissions and refresh page.')
                  }
                }}
                className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Retry Camera Access
              </button>
            </div>
          )}

          <div 
            id="qr-reader" 
            className="w-full rounded-lg overflow-hidden bg-gray-100 min-h-[300px] flex items-center justify-center"
            style={{ minHeight: '300px', position: 'relative', width: '100%' }}
          >
            {!isScanning && !error && (
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm">Camera preview will appear here</p>
              </div>
            )}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-2"></div>
                  <p className="text-sm">Scanning...</p>
                </div>
              </div>
            )}
          </div>

          {!isScanning && error && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {isScanning && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 mb-2">Point camera at QR code</p>
              <button
                onClick={stopScanning}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Stop Scanning
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Make sure QR code is clearly visible and well-lit
            </p>
            <p className="text-xs text-gray-400 mt-1">
              If camera doesn't work, use manual code input in the quotation form
            </p>
          </div>

          {/* Help Section */}
          {error && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-xs font-semibold mb-2">📷 How to fix camera access on Laptop:</p>
              <div className="text-blue-700 text-xs text-left space-y-2">
                <div>
                  <p className="font-semibold">Chrome/Edge:</p>
                  <ol className="ml-4 list-decimal space-y-1">
                    <li>Browser address bar mein lock/camera icon par click karein</li>
                    <li>Camera ko "Allow" karein</li>
                    <li>Page refresh karein (F5)</li>
                    <li>Phir se "Start Camera" button click karein</li>
                  </ol>
                </div>
                <div>
                  <p className="font-semibold">Or use Manual Input:</p>
                  <p className="ml-4">Quotation form mein "Enter code & press Enter" field use karein</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QRCameraScanner

