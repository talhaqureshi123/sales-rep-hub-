import { useState } from 'react'
import { getProductByCode, addScannedProduct } from '../../services/salemanservices/productService'

const QRScanner = () => {
  const [scannedCode, setScannedCode] = useState('')
  const [productDetails, setProductDetails] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const fetchProductByCode = async (code) => {
    setIsScanning(true)
    try {
      const result = await getProductByCode(code)
      if (result.success && result.data) {
        const product = {
          id: result.data.productCode, // Use productCode as ID for consistency
          _id: result.data._id || result.data.id,
          name: result.data.name,
          description: result.data.description || '',
          price: result.data.price,
          category: result.data.category,
          stock: result.data.stock || 0,
          productCode: result.data.productCode,
        }
        setProductDetails(product)
        
        // Automatically add to scanned products
        addScannedProduct(product)
        setSuccessMessage(`Product "${product.name}" added to scanned products!`)
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setProductDetails({ error: result.message || 'Product not found' })
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      setProductDetails({ error: 'Error fetching product' })
    } finally {
      setIsScanning(false)
    }
  }

  const handleScan = () => {
    // Simulate QR code scanning
    const code = prompt('Enter QR Code:')
    if (code) {
      setScannedCode(code)
      fetchProductByCode(code)
    }
  }

  const handleManualInput = async (e) => {
    const code = e.target.value
    setScannedCode(code)
    if (code && code.length > 0) {
      await fetchProductByCode(code)
    } else {
      setProductDetails(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
        <h2 className="text-xl font-bold text-gray-800 mb-3">QR Code Scanner</h2>
        
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Scanner Section */}
          <div className="flex-1 flex flex-col">
            <div className="bg-gray-100 rounded-lg p-4 text-center flex-1 flex items-center justify-center min-h-0">
              <div className="w-full max-w-xs mx-auto aspect-square bg-gray-200 rounded-lg flex items-center justify-center border-4 border-dashed border-gray-400">
                {isScanning ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e9931c] mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Scanning...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="text-sm text-gray-600">Camera View</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={isScanning}
              className="w-full px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors disabled:opacity-50 text-sm"
            >
              {isScanning ? 'Scanning...' : '📷 Scan QR Code'}
            </button>

            {/* Manual Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Or Enter Code Manually
              </label>
              <input
                type="text"
                value={scannedCode}
                onChange={handleManualInput}
                placeholder="Enter product code"
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
              <p className="text-green-700 text-sm font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Product Details */}
          {productDetails && (
            <div className="bg-gray-50 rounded-lg p-3 border-2 border-[#e9931c] overflow-y-auto max-h-48">
              {productDetails.error ? (
                <div className="text-red-600 text-center text-sm">
                  <p className="font-semibold">{productDetails.error}</p>
                  <p className="text-xs mt-1">Scanned Code: {scannedCode}</p>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Product Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-600">Product ID</p>
                      <p className="font-semibold">{productDetails.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Name</p>
                      <p className="font-semibold">{productDetails.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Category</p>
                      <p className="font-semibold">{productDetails.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Price</p>
                      <p className="font-semibold">£{productDetails.price.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Stock</p>
                      <p className="font-semibold">{productDetails.stock} units</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Description</p>
                      <p className="font-semibold text-xs">{productDetails.description}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QRScanner

