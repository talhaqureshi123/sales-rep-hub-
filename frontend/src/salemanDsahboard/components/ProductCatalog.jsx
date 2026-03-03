import { useState, useEffect } from 'react'
import { getMyProducts } from '../../services/salemanservices/productService'
import { FaSearch, FaFilter } from 'react-icons/fa'

const categories = [
  'All',
  'Office Supplies',
  'Packaging & Shipping',
  'Cleaning & Hygiene',
  'Catering Supplies'
]

const ProductCatalog = () => {
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, selectedCategory, selectedStatus])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await getMyProducts()
      if (result.success && result.data) {
        setProducts(Array.isArray(result.data) ? result.data : [])
      } else {
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
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.productCode?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }
    if (selectedStatus !== 'All') {
      const isActive = selectedStatus === 'Active'
      filtered = filtered.filter((p) => p.isActive === isActive)
    }
    setFilteredProducts(filtered)
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Catalog</h1>
        <p className="text-gray-600">View products available for quotations and samples</p>
      </div>

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

      <div className="mb-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FaFilter className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-[#e9931c] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {cat}
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedStatus === status ? 'bg-[#e9931c] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-gray-600 mb-4">
        Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
      </p>

      {loading && filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product._id || product.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <div className="mb-3 flex justify-center">
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
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">{product.name}</h3>
              {product.productCode && (
                <p className="text-sm text-gray-500 mb-2">Code: {product.productCode}</p>
              )}
              <p className="text-xl font-bold text-gray-900 mb-3">
                £{product.price != null ? Number(product.price).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${product.isActive ? 'bg-[#e9931c] text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                >
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
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default ProductCatalog
