import { useState, useEffect } from 'react'
import { getMyCustomers, createCustomer } from '../../services/salemanservices/customerService'
import { FaWhatsapp, FaEnvelope } from 'react-icons/fa'

const CustomerManagement = ({ openAddForm = false, onAddFormClose }) => {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(openAddForm)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [userRole, setUserRole] = useState(null) // Current user role

  const [formData, setFormData] = useState({
    firstName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    orderPotential: '',
    monthlySpend: 0,
    status: 'Not Visited',
    notes: '',
    competitorInfo: '',
    view: 'admin_salesman', // View access: 'admin', 'salesman', 'admin_salesman'
  })

  // Load data on mount
  useEffect(() => {
    // Get current user role
    const role = localStorage.getItem('userRole')
    setUserRole(role)
    loadCustomers()
  }, [])

  // Handle openAddForm prop change
  useEffect(() => {
    if (openAddForm) {
      setShowAddForm(true)
    }
  }, [openAddForm])

  // Handle form close
  const handleCloseForm = () => {
    setShowAddForm(false)
    if (onAddFormClose) {
      onAddFormClose()
    }
  }

  // Reload when filters change
  useEffect(() => {
    loadCustomers()
  }, [filterStatus, searchTerm])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (searchTerm) params.search = searchTerm

      const result = await getMyCustomers(params)
      if (result.success && result.data) {
        setCustomers(result.data)
      } else {
        console.error('Failed to load customers:', result.message)
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const customerData = {
        firstName: formData.firstName,
        name: formData.firstName, // Keep name for backward compatibility
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        postcode: formData.postcode,
        orderPotential: formData.orderPotential,
        monthlySpend: formData.monthlySpend || 0,
        status: formData.status,
        notes: formData.notes,
        competitorInfo: formData.competitorInfo,
        view: formData.view || 'admin_salesman',
      }

      const result = await createCustomer(customerData)
      
      if (result.success) {
        alert('Customer created successfully!')
        setFormData({
          firstName: '',
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          postcode: '',
          orderPotential: '',
          monthlySpend: 0,
          status: 'Not Visited',
          notes: '',
          competitorInfo: '',
          view: 'admin_salesman',
        })
        handleCloseForm()
        loadCustomers()
      } else {
        alert(result.message || 'Failed to create customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Error creating customer')
    } finally {
      setLoading(false)
    }
  }

  const getWhatsAppHref = (phone) => {
    if (!phone) return null
    const digits = String(phone).replace(/\D/g, '')
    if (!digits) return null
    return `https://wa.me/${digits}`
  }

  const getEmailHref = (email, customerName = '') => {
    if (!email) return null
    const to = String(email).trim()
    if (!to) return null
    const subject = encodeURIComponent(`Regarding ${customerName || 'your order'}`)
    const body = encodeURIComponent(`Hi ${customerName || ''},\n\n`)
    return `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 sm:mb-2">Customer Management</h2>
        <p className="text-sm sm:text-base text-gray-600">Manage your customers</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c]"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c]"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 sm:px-6 py-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors text-sm sm:text-base font-semibold flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="whitespace-nowrap">Add Customer</span>
        </button>
      </div>

      {/* Add Customer Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Add New Customer</h3>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter contact person name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="3"
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Postcode</label>
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., LE4 0JP, SW1A 1AA"
                  />
                  <p className="mt-1 text-xs text-gray-500">UK postcode for accurate directions</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Potential</label>
                  <select
                    name="orderPotential"
                    value={formData.orderPotential}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select potential</option>
                    <option value="Very High">Very High</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Spend (£)</label>
                  <input
                    type="number"
                    name="monthlySpend"
                    value={formData.monthlySpend}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="Not Visited">Not Visited</option>
                    <option value="Visited">Visited</option>
                    <option value="Follow-up Needed">Follow-up Needed</option>
                    <option value="Qualified Lead">Qualified Lead</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter any notes about the customer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Competitor Info</label>
                  <textarea
                    name="competitorInfo"
                    value={formData.competitorInfo}
                    onChange={handleInputChange}
                    rows="3"
                    disabled={loading}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Competitor prices, delivery schedules, weak points....."
                  />
                </div>

                {/* View Access Dropdown - Only for Admin or Salesman */}
                {(userRole === 'admin' || userRole === 'salesman') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">View Access *</label>
                    <select
                      name="view"
                      value={formData.view}
                      onChange={handleInputChange}
                      disabled={loading}
                      required
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="admin_salesman">Admin and Salesman</option>
                      <option value="admin">Admin Only</option>
                      <option value="salesman">Salesman Only</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Select who can view this customer</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customers List */}
      {loading && customers.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e9931c] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border-2 border-dashed border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-600 text-lg font-semibold mb-2">No customers found</p>
          <p className="text-gray-500">Create your first customer to get started</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {customers.map((customer) => (
              <div key={customer._id || customer.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{customer.name}</h3>
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      customer.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-gray-900">{customer.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-gray-900">{customer.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-gray-900">
                      {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.address || 'N/A'}
                    </p>
                    {customer.pincode && (
                      <p className="text-xs text-gray-500">{customer.pincode}</p>
                    )}
                  </div>
                  {customer.company && (
                    <div>
                      <p className="text-xs text-gray-500">Company</p>
                      <p className="text-gray-900">{customer.company}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200">
                  <a
                    href={getWhatsAppHref(customer.phone) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!getWhatsAppHref(customer.phone)) e.preventDefault()
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      getWhatsAppHref(customer.phone)
                        ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Send WhatsApp"
                  >
                    <FaWhatsapp />
                    WhatsApp
                  </a>
                  <a
                    href={getEmailHref(customer.email, customer.name) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!getEmailHref(customer.email, customer.name)) e.preventDefault()
                    }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      getEmailHref(customer.email, customer.name)
                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Send Email"
                  >
                    <FaEnvelope />
                    Email
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer._id || customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.email || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{customer.phone || 'N/A'}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={getWhatsAppHref(customer.phone) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (!getWhatsAppHref(customer.phone)) e.preventDefault()
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              getWhatsAppHref(customer.phone)
                                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                            title="Send WhatsApp"
                          >
                            <FaWhatsapp />
                            WhatsApp
                          </a>
                          <a
                            href={getEmailHref(customer.email, customer.name) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (!getEmailHref(customer.email, customer.name)) e.preventDefault()
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              getEmailHref(customer.email, customer.name)
                                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                            title="Send Email"
                          >
                            <FaEnvelope />
                            Email
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.city && customer.state ? `${customer.city}, ${customer.state}` : customer.address || 'N/A'}
                        </div>
                        {customer.pincode && (
                          <div className="text-sm text-gray-500">{customer.pincode}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.company || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CustomerManagement

