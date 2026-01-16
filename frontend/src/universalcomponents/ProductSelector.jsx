import { useState, useEffect } from 'react'
import { getScannedProducts, removeScannedProduct } from '../services/salemanservices/productService'

const ProductSelector = ({ onSelectProduct, onClose }) => {
  const [scannedProducts, setScannedProducts] = useState([])

  useEffect(() => {
    // Load scanned products from localStorage
    const products = getScannedProducts()
    setScannedProducts(products)
  }, [])

  const handleSelectProduct = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product)
    }
    if (onClose) {
      onClose()
    }
  }

  const handleRemoveProduct = (productId) => {
    removeScannedProduct(productId)
    const updated = getScannedProducts()
    setScannedProducts(updated)
  }

  if (scannedProducts.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
        <div className="text-center py-8">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <p className="text-gray-600 font-medium mb-2">No scanned products found</p>
          <p className="text-sm text-gray-500">Scan products using QR Scanner to add them here</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border-2 border-[#e9931c] max-h-96 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Scanned Products</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {scannedProducts.map((product) => (
          <div
            key={product.id}
            className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#e9931c] transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">{product.name}</h4>
                <p className="text-sm text-gray-600 mt-1">Code: {product.id}</p>
                <p className="text-sm text-gray-600">Category: {product.category}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#e9931c]">£{product.price.toLocaleString()}</p>
                <button
                  onClick={() => handleRemoveProduct(product.id)}
                  className="mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
            <button
              onClick={() => handleSelectProduct(product)}
              className="w-full px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
            >
              Add to Quotation
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductSelector

