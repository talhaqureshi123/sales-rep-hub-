import { useState, useEffect } from 'react'
import { FaShoppingCart, FaSearch, FaFilter, FaPlus, FaEdit, FaTrash, FaCheckCircle, FaTimesCircle, FaEye } from 'react-icons/fa'
import { getSalesOrders, getSalesOrder, deleteSalesOrder } from '../../services/adminservices/salesOrderService'
import SalesOrderForm from './SalesOrderForm'
import Swal from 'sweetalert2'

const SalesOrders = () => {
  const [orders, setOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [viewOrderId, setViewOrderId] = useState(null)
  const [viewOrderDetail, setViewOrderDetail] = useState(null)
  const [loadingView, setLoadingView] = useState(false)

  const statusOptions = [
    'All',
    'Draft',
    'Pending',
    'Confirmed',
    'Processing',
    'Dispatched',
    'Delivered',
    'Cancelled'
  ]

  const [formData, setFormData] = useState({
    orderNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    items: [],
    totalAmount: 0,
    status: 'Draft',
    notes: '',
    deliveryAddress: '',
  })

  useEffect(() => {
    loadOrders()
    
    // Check if form should be opened from achievement click or sales submission
    const shouldOpenForm = localStorage.getItem('openSalesOrderForm') === 'true'
    const editOrderId = localStorage.getItem('editSalesOrderId')
    
    if (shouldOpenForm) {
      setShowForm(true)
      setEditingOrderId(null) // Ensure it's a new form
      localStorage.removeItem('openSalesOrderForm')
    }
    
    if (editOrderId) {
      setEditingOrderId(editOrderId)
      setShowForm(true)
      localStorage.removeItem('editSalesOrderId')
    }
    
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchTerm, selectedStatus])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const result = await getSalesOrders()
      if (result.success && result.data) {
        const previousOrders = orders
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        console.log(`📦 [Admin Sales Orders] Loaded ${result.data.length} orders`)
        console.log(`   User Role: ${user.role || 'Unknown'}`)
        console.log(`   Orders:`, result.data.map(o => ({
          so: o.soNumber,
          customer: o.customerName,
          status: o.orderStatus,
          salesman: o.salesPerson?.name || 'N/A'
        })))
        setOrders(result.data)
        
        // Check if salesman should be redirected after admin approval
        // Check for orders that were Pending and are now Confirmed
        if (user.role === 'salesman' && previousOrders.length > 0) {
          const newlyApproved = result.data.filter(newOrder => {
            const oldOrder = previousOrders.find(o => (o._id || o.id) === (newOrder._id || newOrder.id))
            return oldOrder && 
                   oldOrder.orderStatus === 'Pending' && 
                   newOrder.orderStatus === 'Confirmed'
          })
          
          if (newlyApproved.length > 0) {
            Swal.fire({
              icon: 'success',
              title: 'Order Approved!',
              text: `Your ${newlyApproved.length} order(s) have been approved by admin. They will now appear in your Sales Targets.`,
              confirmButtonColor: '#e9931c'
            }).then(() => {
              // Navigate to Sales Targets
              const event = new CustomEvent('navigateToTab', { detail: 'sales-targets' })
              window.dispatchEvent(event)
            })
          }
        }
        
        // Also check localStorage flag (for immediate redirect after admin approval)
        const shouldRedirect = localStorage.getItem('orderApprovedRedirect') === 'true'
        if (shouldRedirect && user.role === 'salesman') {
          Swal.fire({
            icon: 'success',
            title: 'Order Approved!',
            text: 'Your order has been approved by admin. It will now appear in your Sales Targets.',
            confirmButtonColor: '#e9931c'
          }).then(() => {
            localStorage.removeItem('orderApprovedRedirect')
            localStorage.removeItem('approvedOrderId')
            // Navigate to Sales Targets
            const event = new CustomEvent('navigateToTab', { detail: 'sales-targets' })
            window.dispatchEvent(event)
          })
        } else if (shouldRedirect && user.role !== 'salesman') {
          localStorage.removeItem('orderApprovedRedirect')
          localStorage.removeItem('approvedOrderId')
        }
      } else {
        console.error('Failed to load orders:', result.message)
        setOrders([])
        setFilteredOrders([])
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      setOrders([])
      setFilteredOrders([])
    } finally {
      setLoading(false)
    }
  }

  const filterOrders = () => {
    if (!orders || orders.length === 0) {
      setFilteredOrders([])
      return
    }

    let filtered = [...orders]

    // Search filter - filters by SO Number, Customer Name, or Email
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(order =>
        order.soNumber?.toLowerCase().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.emailAddress?.toLowerCase().includes(searchLower) ||
        order.invoiceNumber?.toLowerCase().includes(searchLower)
      )
    }

    // Status filter - filters by order status
    if (selectedStatus && selectedStatus !== 'All') {
      filtered = filtered.filter(order => order.orderStatus === selectedStatus)
    }

    setFilteredOrders(filtered)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const generateOrderNumber = () => {
    const prefix = 'ORD'
    const randomNum = Math.floor(100000 + Math.random() * 900000)
    return `${prefix}${randomNum}`
  }

  const handleCreateOrder = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const orderData = {
        ...formData,
        orderNumber: formData.orderNumber || generateOrderNumber(),
        orderDate: new Date().toISOString(),
      }

      // TODO: Implement API call to create order
      // const result = await createSalesOrder(orderData)
      // if (result.success) {
      //   Swal.fire({ icon: 'success', title: 'Success', text: 'Order created successfully!', confirmButtonColor: '#e9931c' })
      //   setShowCreateModal(false)
      //   resetForm()
      //   loadOrders()
      // }
      await Swal.fire({
        icon: 'info',
        title: 'Coming Soon',
        text: 'Order creation functionality will be implemented with backend API',
        confirmButtonColor: '#e9931c'
      })
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Error creating order:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating order. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      orderNumber: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      items: [],
      totalAmount: 0,
      status: 'Draft',
      notes: '',
      deliveryAddress: '',
    })
    setSelectedOrder(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'Confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'Processing':
        return 'bg-purple-100 text-purple-800'
      case 'Dispatched':
        return 'bg-indigo-100 text-indigo-800'
      case 'Delivered':
        return 'bg-green-100 text-green-800'
      case 'Cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewOrder = async (orderId) => {
    setViewOrderId(orderId)
    setLoadingView(true)
    setViewOrderDetail(null)
    try {
      const result = await getSalesOrder(orderId)
      if (result.success && result.data) {
        setViewOrderDetail(result.data)
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'Failed to load order', confirmButtonColor: '#e9931c' })
        setViewOrderId(null)
      }
    } catch (err) {
      console.error(err)
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load order', confirmButtonColor: '#e9931c' })
      setViewOrderId(null)
    } finally {
      setLoadingView(false)
    }
  }

  const closeViewModal = () => {
    setViewOrderId(null)
    setViewOrderDetail(null)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FaShoppingCart className="w-8 h-8 text-[#e9931c]" />
          <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
        </div>
        <p className="text-gray-600">Create and manage customer orders</p>
      </div>

      {/* Create Order Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            setEditingOrderId(null)
            setShowForm(true)
            setShowCreateModal(false)
          }}
          className="flex items-center gap-2 px-6 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-lg hover:shadow-xl"
        >
          <FaPlus className="w-5 h-5" />
          <span>Create New Order</span>
        </button>
      </div>

      {/* Status Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
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

      {/* Search Bar */}
      <div className="relative mb-6">
        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by SO number, customer name, email, or invoice number..."
          className="w-full pl-12 pr-10 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear search"
          >
            <FaTimesCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Orders Count and Clear Filters */}
      {!loading && !showForm && orders.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredOrders.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{orders.length}</span> orders
          </p>
          {(searchTerm || selectedStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedStatus('All')
              }}
              className="text-sm text-[#e9931c] hover:underline font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Orders List or Empty State */}
      {showForm ? null : loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FaShoppingCart className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No orders found</h3>
          <p className="text-gray-600 mb-6">Create your first order to get started</p>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="px-6 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
          >
            Create New Order
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order._id || order.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">Order #{order.soNumber}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.orderStatus)}`}>
                      {order.orderStatus}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Customer</p>
                      <p className="font-medium text-gray-900">{order.customerName}</p>
                      <p className="text-gray-600">{order.emailAddress}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Order Date</p>
                      <p className="font-medium text-gray-900">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-bold text-lg text-[#e9931c]">
                        £{Number(order.grandTotal || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewOrder(order._id || order.id)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Sales Order"
                  >
                    <FaEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingOrderId(order._id || order.id)
                      setShowForm(true)
                      setShowCreateModal(false)
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FaEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={async () => {
                      const confirmResult = await Swal.fire({
                        icon: 'warning',
                        title: 'Delete Order?',
                        text: 'Are you sure you want to delete this order?',
                        showCancelButton: true,
                        confirmButtonColor: '#e9931c',
                        cancelButtonColor: '#6c757d',
                        confirmButtonText: 'Yes, delete'
                      })
                      if (confirmResult.isConfirmed) {
                        const result = await deleteSalesOrder(order._id || order.id)
                        if (result.success) {
                          Swal.fire({ icon: 'success', title: 'Deleted', text: 'Order deleted.', confirmButtonColor: '#e9931c' })
                          loadOrders()
                        } else {
                          Swal.fire({ icon: 'error', title: 'Error', text: result.message || 'Failed to delete order', confirmButtonColor: '#e9931c' })
                        }
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FaTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {order.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {order.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* View Sales Order Modal */}
      {viewOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-800">View Sales Order</h3>
              <button onClick={closeViewModal} className="text-gray-500 hover:text-gray-700 p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4">
              {loadingView ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#e9931c] border-t-transparent mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading order...</p>
                </div>
              ) : viewOrderDetail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">SO Number</p>
                      <p className="font-semibold text-gray-900">{viewOrderDetail.soNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Invoice Number</p>
                      <p className="font-semibold text-gray-900">{viewOrderDetail.invoiceNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Order Status</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(viewOrderDetail.orderStatus)}`}>{viewOrderDetail.orderStatus}</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Approval</p>
                      <p className="font-medium text-gray-900">{viewOrderDetail.approvalStatus || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Customer</p>
                      <p className="font-medium text-gray-900">{viewOrderDetail.customerName}</p>
                      <p className="text-sm text-gray-600">{viewOrderDetail.emailAddress}</p>
                      {viewOrderDetail.phoneNumber && <p className="text-sm text-gray-600">{viewOrderDetail.phoneNumber}</p>}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Order Date</p>
                      <p className="font-medium text-gray-900">{viewOrderDetail.orderDate ? new Date(viewOrderDetail.orderDate).toLocaleDateString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sales Person</p>
                      <p className="font-medium text-gray-900">{viewOrderDetail.salesPerson?.name || viewOrderDetail.salesPerson?.email || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Grand Total</p>
                      <p className="font-bold text-lg text-[#e9931c]">£{Number(viewOrderDetail.grandTotal || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  {viewOrderDetail.items && viewOrderDetail.items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-2">Product</th>
                              <th className="text-right p-2">Qty</th>
                              <th className="text-right p-2">Unit Price</th>
                              <th className="text-right p-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewOrderDetail.items.map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{item.productName || item.name || '—'}</td>
                                <td className="p-2 text-right">{item.quantity ?? 0}</td>
                                <td className="p-2 text-right">£{Number(item.unitPrice || 0).toFixed(2)}</td>
                                <td className="p-2 text-right">£{Number(item.lineTotal || (item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {viewOrderDetail.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600"><span className="font-medium">Notes:</span> {viewOrderDetail.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => { closeViewModal(); setEditingOrderId(viewOrderDetail._id); setShowForm(true); }} className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-medium hover:bg-[#d8820a]">Edit Order</button>
                    <button onClick={closeViewModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300">Close</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Sales Order Form - Inline */}
      {showForm && (
        <div className="mb-6">
          <SalesOrderForm
            orderId={editingOrderId}
            onClose={() => {
              setShowForm(false)
              setEditingOrderId(null)
              // Clear achievement flags when closing
              localStorage.removeItem('salesOrderFromAchievement')
              localStorage.removeItem('salesOrderVisitTarget')
              setEditingOrderId(null)
              loadOrders()
            }}
          />
        </div>
      )}

      {/* Create Order Modal (Legacy - can be removed) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Create New Order</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Number (Auto-generated if empty)</label>
                  <input
                    type="text"
                    name="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Leave empty for auto-generation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                  >
                    {statusOptions.filter(s => s !== 'All').map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Phone</label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter customer phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount *</label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter total amount"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                  <textarea
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter delivery address"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                    placeholder="Enter any notes about the order"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesOrders
