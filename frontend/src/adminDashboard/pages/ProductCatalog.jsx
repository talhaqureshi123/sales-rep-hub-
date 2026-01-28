import { useState, useEffect, useRef } from 'react'
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../services/adminservices/productService'
import { FaSearch, FaFilter, FaCheckSquare, FaQrcode, FaDownload, FaTrash, FaChevronDown, FaBarcode, FaEdit } from 'react-icons/fa'
import Swal from 'sweetalert2'

const ProductCatalog = () => {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [openDownloadDropdown, setOpenDownloadDropdown] = useState(null) // Track which product's dropdown is open
  const [editingProduct, setEditingProduct] = useState(null) // Track which product is being edited

  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    price: '',
    category: '',
    isActive: true,
    imageUrl: '',       // new field
    description: '',    // new field
    keyFeatures: '',    // new field
  })
  
  const categories = [
    'All',
    'Office Supplies',
    'Packaging & Shipping',
    'Cleaning & Hygiene',
    'Home & Kitchen',
    'Catering Supplies',
    'Electronics',
    'Home & Living',
    'Clothing',
    'Food & Beverages'
  ]

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, selectedCategory, selectedStatus])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDownloadDropdown && !event.target.closest('.download-dropdown-container')) {
        setOpenDownloadDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDownloadDropdown])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await getProducts()
      if (result.success && result.data) {
        setProducts(result.data)
      } else {
        console.error('Failed to load products:', result.message)
        setProducts([])
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.productCode?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }

    if (selectedStatus !== 'All') {
      const isActive = selectedStatus === 'Active'
      filtered = filtered.filter(product => product.isActive === isActive)
    }

    setFilteredProducts(filtered)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  const generateProductCode = () => {
    const prefix = 'PROD'
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `${prefix}${randomNum}`
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const code = formData.productCode || generateProductCode()
      
      // Convert keyFeatures string to array if provided
      const keyFeaturesArray = formData.keyFeatures
        ? formData.keyFeatures.split(',').map(f => f.trim()).filter(f => f)
        : []
      
      const productData = {
        name: formData.name,
        productCode: code,
        price: parseFloat(formData.price) || 0,
        category: formData.category,
        stock: 0,
        isActive: formData.isActive,
        image: formData.imageUrl,         // backend expects 'image' not 'imageUrl'
        description: formData.description,
        keyFeatures: keyFeaturesArray,
      }
      

      const result = await createProduct(productData)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Product Created!',
          text: 'Product added successfully!',
          confirmButtonColor: '#e9931c'
        })
        setFormData({
          name: '',
          productCode: '',
          price: '',
          category: '',
          isActive: true,
          imageUrl: '',
          description: '',
          keyFeatures: '',
        })
        setShowAddForm(false)
        loadProducts()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to create product',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error creating product:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating product. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadQR = async (product, e) => {
    if (e) {
      e.stopPropagation()
    }
    setOpenDownloadDropdown(null) // Close dropdown
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        Swal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Authentication token not found. Please login again.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Call backend endpoint for QR code
      const response = await fetch(`/api/admin/products/${product._id || product.id}/qr-code`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()
      
      if (data.success && data.qrCodeURL) {
        // Fetch the QR code image
        const imgResponse = await fetch(data.qrCodeURL)
        const blob = await imgResponse.blob()
        
        // Create a blob URL and download
        const blobURL = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobURL
        link.download = data.filename || `${product.productCode}_QR.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the blob URL
        window.URL.revokeObjectURL(blobURL)
        Swal.fire({
          icon: 'success',
          title: 'Downloaded!',
          text: 'QR code downloaded successfully',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Download Failed',
          text: data.message || 'Failed to download QR code',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error downloading QR code:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to download QR code. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleDownloadBarcode = async (product, e) => {
    if (e) {
      e.stopPropagation()
    }
    setOpenDownloadDropdown(null) // Close dropdown
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        Swal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Authentication token not found. Please login again.',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Call backend endpoint for barcode
      const response = await fetch(`/api/admin/products/${product._id || product.id}/barcode`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()
      
      if (data.success && data.barcodeURL) {
        try {
          // Try to fetch the barcode image with CORS handling
          const imgResponse = await fetch(data.barcodeURL, {
            mode: 'cors',
            credentials: 'omit'
          })
          
          if (!imgResponse.ok) {
            // If direct fetch fails, try opening in new window or using proxy
            const link = document.createElement('a')
            link.href = data.barcodeURL
            link.target = '_blank'
            link.download = data.filename || `${product.productCode}_Barcode.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            Swal.fire({
              icon: 'success',
              title: 'Barcode Downloaded!',
              text: 'Barcode download initiated.',
              confirmButtonColor: '#e9931c'
            })
            return
          }
          
          const blob = await imgResponse.blob()
          
          // Create a blob URL and download
          const blobURL = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = blobURL
          link.download = data.filename || `${product.productCode}_Barcode.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          // Clean up the blob URL
          window.URL.revokeObjectURL(blobURL)
          
          Swal.fire({
            icon: 'success',
            title: 'Barcode Downloaded!',
            text: 'Barcode downloaded successfully.',
            confirmButtonColor: '#e9931c'
          })
        } catch (fetchError) {
          // Fallback: open URL directly
          const link = document.createElement('a')
          link.href = data.barcodeURL
          link.target = '_blank'
          link.download = data.filename || `${product.productCode}_Barcode.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          Swal.fire({
            icon: 'info',
            title: 'Barcode Opened',
            text: 'Barcode opened in new tab. Please save it manually.',
            confirmButtonColor: '#e9931c'
          })
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: data.message || 'Failed to download barcode',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error downloading barcode:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to download barcode. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      productCode: product.productCode || '',
      price: product.price || '',
      category: product.category || '',
      isActive: product.isActive !== undefined ? product.isActive : true,
      imageUrl: product.image || product.imageUrl || '',
      description: product.description || '',
      keyFeatures: Array.isArray(product.keyFeatures) ? product.keyFeatures.join(', ') : (product.keyFeatures || ''),
    })
    setShowAddForm(true)
  }

  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const code = formData.productCode || generateProductCode()
      
      // Convert keyFeatures string to array if provided
      const keyFeaturesArray = formData.keyFeatures
        ? formData.keyFeatures.split(',').map(f => f.trim()).filter(f => f)
        : []
      
      const productData = {
        name: formData.name,
        productCode: code,
        price: parseFloat(formData.price) || 0,
        category: formData.category,
        stock: editingProduct?.stock || 0,
        isActive: formData.isActive,
        image: formData.imageUrl,
        description: formData.description,
        keyFeatures: keyFeaturesArray,
      }
      
      const result = await updateProduct(editingProduct._id || editingProduct.id, productData)
      
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Product Updated!',
          text: 'Product updated successfully!',
          confirmButtonColor: '#e9931c'
        })
        setFormData({
          name: '',
          productCode: '',
          price: '',
          category: '',
          isActive: true,
          imageUrl: '',
          description: '',
          keyFeatures: '',
        })
        setEditingProduct(null)
        setShowAddForm(false)
        loadProducts()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to update product',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error updating product:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating product',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete Product?',
      text: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it'
    })

    if (!result.isConfirmed) {
      return
    }

    setLoading(true)
    try {
      const deleteResult = await deleteProduct(product._id || product.id)
      if (deleteResult.success) {
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Product deleted successfully!',
          confirmButtonColor: '#e9931c'
        })
        loadProducts() // Reload products list
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: deleteResult.message || 'Failed to delete product',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting product. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map(p => p._id || p.id))
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Catalog</h1>
        <p className="text-gray-600">Showcase your products to customers</p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by product name or code..."
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['All', 'Active', 'Inactive'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons and Product Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FaCheckSquare className="w-4 h-4" />
            <span>Select</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-5 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
          >
            <span>+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setEditingProduct(null)
                  setFormData({
                    name: '',
                    productCode: '',
                    price: '',
                    category: '',
                    isActive: true,
                    imageUrl: '',
                    description: '',
                    keyFeatures: '',
                  })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* same form as before */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Code (Auto-generated if empty)</label>
                <input
                  type="text"
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Leave empty for auto-generation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price *</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  placeholder="Enter price"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  <option value="">Select category</option>
                  {categories.filter(c => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-[#e9931c] rounded focus:ring-[#e9931c]"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
              <div className="md:col-span-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingProduct(null)
                    setFormData({
                      name: '',
                      productCode: '',
                      price: '',
                      category: '',
                      isActive: true,
                      imageUrl: '',
                      description: '',
                      keyFeatures: '',
                    })
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
              <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
  <input
    type="text"
    name="imageUrl"
    value={formData.imageUrl}
    onChange={handleInputChange}
    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
    placeholder="Enter image URL"
  />
</div>

<div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
  <textarea
    name="description"
    value={formData.description}
    onChange={handleInputChange}
    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
    placeholder="Enter product description"
    rows={3}
  />
</div>

<div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-2">Key Features</label>
  <textarea
    name="keyFeatures"
    value={formData.keyFeatures}
    onChange={handleInputChange}
    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
    placeholder="Enter key features separated by commas"
    rows={2}
  />
</div>

            </form>
          </div>
        </div>
        
      )}

      {/* Products Grid */}
      {loading && filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No products found. Add your first product!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product._id || product.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow relative"
            >
              {/* Select Checkbox */}
              <input
                type="checkbox"
                checked={selectedProducts.includes(product._id || product.id)}
                onChange={() => handleSelectProduct(product._id || product.id)}
                className="absolute top-2 left-2 w-5 h-5 text-[#e9931c] rounded focus:ring-[#e9931c]"
              />

              {/* Product Image */}
              <div className="mb-3 flex justify-center relative">
                {product.image || product.imageUrl ? (
                  <img
                    src={product.image || product.imageUrl}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded border border-gray-200"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150?text=No+Image'
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50">
                    <span className="text-xs text-gray-400">No Image</span>
                  </div>
                )}
                {/* Action Buttons */}
                <div className="absolute top-0 right-0 flex gap-1 z-10">
                  {/* Download Dropdown */}
                  {product.productCode && (
                    <div className="relative download-dropdown-container">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenDownloadDropdown(openDownloadDropdown === product._id ? null : product._id)
                        }}
                        className="bg-[#e9931c] text-white p-1.5 rounded-full hover:bg-[#d8820a] transition-colors shadow-md flex items-center gap-1"
                        title="Download Options"
                      >
                        <FaDownload className="w-3 h-3" />
                        <FaChevronDown className={`w-2 h-2 transition-transform ${openDownloadDropdown === product._id ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openDownloadDropdown === product._id && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-20">
                          <button
                            onClick={(e) => handleDownloadQR(product, e)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                          >
                            <FaQrcode className="w-4 h-4 text-[#e9931c]" />
                            <span>Download QR Code</span>
                          </button>
                          <button
                            onClick={(e) => handleDownloadBarcode(product, e)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                          >
                            <FaBarcode className="w-4 h-4 text-[#e9931c]" />
                            <span>Download Barcode</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Edit Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditProduct(product)
                    }}
                    className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition-colors shadow-md"
                    title="Edit Product"
                  >
                    <FaEdit className="w-3 h-3" />
                  </button>
                  {/* Delete Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteProduct(product)
                    }}
                    className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 transition-colors shadow-md"
                    title="Delete Product"
                  >
                    <FaTrash className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Product Name */}
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{product.name}</h3>

              {/* Price */}
              <p className="text-xl font-bold text-gray-900 mb-3">
                £{product.price ? product.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  product.isActive
                    ? 'bg-[#e9931c] text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
                {product.category && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                    {product.category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductCatalog
