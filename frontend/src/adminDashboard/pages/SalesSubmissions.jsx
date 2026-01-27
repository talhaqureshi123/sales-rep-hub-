import { useState, useEffect } from 'react'
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock,
  FaFileInvoice,
  FaSpinner,
  FaSearch,
  FaChevronUp,
  FaChevronDown,
  FaUser,
  FaDollarSign,
  FaCalendarAlt,
  FaFile,
  FaImage
} from 'react-icons/fa'
// Sales submission service removed - using sales orders instead
import { getSalesOrders, approveSalesOrder, rejectSalesOrder } from '../../services/adminservices/salesOrderService'
import { getUsers } from '../../services/adminservices/userService'
import Swal from 'sweetalert2'

const SalesSubmissions = () => {
  const [loading, setLoading] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState(null)
  const [salesmen, setSalesmen] = useState([])
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedRows, setSelectedRows] = useState([])

  const [filters, setFilters] = useState({
    salesman: 'All',
    status: 'All',
    fromDate: '',
    toDate: '',
    search: ''
  })

  useEffect(() => {
    loadSalesmen()
    loadSubmissions()
    loadStats()
  }, [filters, sortField, sortOrder])

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const filterParams = {}
      if (filters.salesman !== 'All') filterParams.salesPerson = filters.salesman
      if (filters.status !== 'All') filterParams.status = filters.status
      if (filters.fromDate) filterParams.fromDate = filters.fromDate
      if (filters.toDate) filterParams.toDate = filters.toDate
      if (filters.search) filterParams.search = filters.search

      const result = await getSalesOrders(filterParams)
      if (result.success && result.data) {
        // Map sales orders to match submission format for compatibility
        const orders = result.data || []
        let sorted = [...orders]
        sorted.sort((a, b) => {
          let aVal, bVal
          switch (sortField) {
            case 'submissionNumber':
              aVal = a.soNumber || a.invoiceNumber || ''
              bVal = b.soNumber || b.invoiceNumber || ''
              break
            case 'customerName':
              aVal = a.customerName || ''
              bVal = b.customerName || ''
              break
            case 'salesDate':
              aVal = new Date(a.orderDate || a.createdAt).getTime()
              bVal = new Date(b.orderDate || b.createdAt).getTime()
              break
            case 'salesAmount':
              aVal = a.grandTotal || 0
              bVal = b.grandTotal || 0
              break
            case 'approvalStatus':
              aVal = a.orderStatus || ''
              bVal = b.orderStatus || ''
              break
            default:
              aVal = new Date(a.createdAt).getTime()
              bVal = new Date(b.createdAt).getTime()
          }
          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
          }
        })
        setSubmissions(sorted)
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getSalesOrders()
      if (result.success && result.data) {
        const orders = result.data || []
        // Calculate stats from sales orders
        const totalOrders = orders.length
        const confirmedOrders = orders.filter(o => o.orderStatus === 'Confirmed').length
        const pendingOrders = orders.filter(o => o.orderStatus === 'Pending' || o.orderStatus === 'Draft').length
        const totalAmount = orders
          .filter(o => o.orderStatus === 'Confirmed')
          .reduce((sum, o) => sum + (o.grandTotal || 0), 0)
        
        setStats({
          total: totalOrders,
          approved: confirmedOrders,
          pending: pendingOrders,
          totalAmount: totalAmount
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadSalesmen = async () => {
    try {
      const result = await getUsers({ role: 'salesman' })
      if (result.success && result.data) {
        setSalesmen(result.data || [])
      }
    } catch (error) {
      console.error('Error loading salesmen:', error)
    }
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(submissions.map(s => s._id))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) 
        ? prev.filter(rowId => rowId !== id)
        : [...prev, id]
    )
  }

  const handleApprove = async () => {
    if (!selectedSubmission) return

    try {
      setLoading(true)
      const result = await approveSalesOrder(selectedSubmission._id)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Approved!',
          text: 'Sales submission approved successfully',
          confirmButtonColor: '#e9931c'
        })
        setShowApproveModal(false)
        setSelectedSubmission(null)
        setAdminNotes('')
        loadSubmissions()
        loadStats()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Failed to approve submission',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error approving submission:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error approving submission. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission || !rejectionReason.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Rejection Reason Required',
        text: 'Please provide a reason for rejection',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    try {
      setLoading(true)
      const result = await rejectSalesOrder(selectedSubmission._id, rejectionReason)
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Rejected',
          text: 'Sales submission rejected',
          confirmButtonColor: '#e9931c'
        })
        setShowRejectModal(false)
        setSelectedSubmission(null)
        setRejectionReason('')
        setAdminNotes('')
        loadSubmissions()
        loadStats()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.message || 'Failed to reject submission',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error rejecting submission:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error rejecting submission. Please try again.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setLoading(false)
    }
  }

  const openApproveModal = (submission) => {
    setSelectedSubmission(submission)
    setAdminNotes('')
    setShowApproveModal(true)
  }

  const openRejectModal = (submission) => {
    setSelectedSubmission(submission)
    setRejectionReason('')
    setAdminNotes('')
    setShowRejectModal(true)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved':
        return <FaCheckCircle className="w-4 h-4 text-green-600" />
      case 'Rejected':
        return <FaTimesCircle className="w-4 h-4 text-red-600" />
      default:
        return <FaClock className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' 
      ? <FaChevronUp className="w-3 h-3 ml-1" />
      : <FaChevronDown className="w-3 h-3 ml-1" />
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Sales Orders</h2>
          <p className="text-sm text-gray-600">
            {loading ? 'Loading...' : `${submissions.length} records`}
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Orders</p>
              <FaFileInvoice className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.total || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Pending</p>
              <FaClock className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Confirmed</p>
              <FaCheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">{stats.approved || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Amount</p>
              <FaDollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-700">£{stats.totalAmount?.toLocaleString() || 0}</p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c] focus:border-transparent"
                placeholder="Search order number, customer name, email, invoice..."
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select
            value={filters.salesman}
            onChange={(e) => setFilters(prev => ({ ...prev, salesman: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
          >
            <option value="All">All Salesmen</option>
            {salesmen.map(salesman => (
              <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                {salesman.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.status !== 'All' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Status: {filters.status}
              <button onClick={() => setFilters(prev => ({ ...prev, status: 'All' }))} className="ml-1">×</button>
            </span>
          )}
          {filters.salesman !== 'All' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Salesman: {salesmen.find(s => (s._id || s.id) === filters.salesman)?.name || 'Selected'}
              <button onClick={() => setFilters(prev => ({ ...prev, salesman: 'All' }))} className="ml-1">×</button>
            </span>
          )}
          {(filters.status !== 'All' || filters.salesman !== 'All') && (
            <button
              onClick={() => setFilters({ salesman: 'All', status: 'All', fromDate: '', toDate: '', search: '' })}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading && submissions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <FaSpinner className="w-8 h-8 text-[#e9931c] animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12">
            <FaFileInvoice className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No sales submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === submissions.length && submissions.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                    />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('approvalStatus')}
                  >
                    <div className="flex items-center">
                      STATUS
                      <SortIcon field="approvalStatus" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('submissionNumber')}
                  >
                    <div className="flex items-center">
                      SUBMISSION NUMBER
                      <SortIcon field="submissionNumber" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center">
                      CUSTOMER
                      <SortIcon field="customerName" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    SALESMAN
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('salesDate')}
                  >
                    <div className="flex items-center">
                      SALES DATE
                      <SortIcon field="salesDate" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('salesAmount')}
                  >
                    <div className="flex items-center">
                      AMOUNT
                      <SortIcon field="salesAmount" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    DOCUMENTS
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => (
                  <tr 
                    key={submission._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(submission._id)}
                        onChange={() => handleSelectRow(submission._id)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {/* Show approval status if available, otherwise show order status */}
                      {submission.approvalStatus ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(submission.approvalStatus)}`}>
                          {getStatusIcon(submission.approvalStatus)}
                          {submission.approvalStatus}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(submission.orderStatus || 'Pending')}`}>
                          {getStatusIcon(submission.orderStatus || 'Pending')}
                          {submission.orderStatus || 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                        {submission.soNumber || submission.invoiceNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{submission.customerName}</p>
                        {submission.emailAddress && (
                          <p className="text-xs text-gray-500">{submission.emailAddress}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {submission.salesPerson && typeof submission.salesPerson === 'object' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                            <FaUser className="w-3 h-3 text-gray-600" />
                          </div>
                          <span className="text-sm text-gray-900">{submission.salesPerson.name || submission.salesPerson}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <FaCalendarAlt className="w-3 h-3 text-gray-400" />
                        {submission.orderDate ? new Date(submission.orderDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-[#e9931c]">
                        £{submission.grandTotal?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {submission.documents && submission.documents.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {submission.documents[0].fileType === 'image' ? (
                            <FaImage className="w-4 h-4 text-blue-600" />
                          ) : (
                            <FaFile className="w-4 h-4 text-gray-600" />
                          )}
                          <span className="text-xs text-gray-600">{submission.documents.length}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* Show approve/reject buttons for pending orders */}
                      {(submission.approvalStatus === 'Pending' || (!submission.approvalStatus && (submission.orderStatus === 'Pending' || submission.orderStatus === 'Draft'))) && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openApproveModal(submission)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(submission)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {submission.approvalStatus === 'Approved' && (
                        <span className="text-xs text-green-600 font-medium">Approved</span>
                      )}
                      {submission.approvalStatus === 'Rejected' && (
                        <span className="text-xs text-red-600 font-medium">Rejected</span>
                      )}
                      {submission.approvalStatus !== 'Pending' && submission.approvalStatus !== 'Approved' && submission.approvalStatus !== 'Rejected' && (
                        <span className="text-xs text-gray-500">
                          {submission.orderStatus === 'Confirmed' ? 'Confirmed' : submission.orderStatus || 'Draft'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Approve Sales Order</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Order Number:</strong> {selectedSubmission.soNumber || selectedSubmission.invoiceNumber || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Customer:</strong> {selectedSubmission.customerName}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Amount:</strong> £{selectedSubmission.grandTotal?.toLocaleString() || 0}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Add any notes about this approval..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setSelectedSubmission(null)
                  setAdminNotes('')
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="w-4 h-4" />
                    <span>Approve</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Reject Sales Order</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Order Number:</strong> {selectedSubmission.soNumber || selectedSubmission.invoiceNumber || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Customer:</strong> {selectedSubmission.customerName}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Amount:</strong> £{selectedSubmission.grandTotal?.toLocaleString() || 0}
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows="3"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Please provide a reason for rejection..."
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows="2"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                placeholder="Add any additional notes..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedSubmission(null)
                  setRejectionReason('')
                  setAdminNotes('')
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectionReason.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <FaTimesCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesSubmissions
