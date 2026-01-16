import { useState, useEffect } from 'react'
import { getCustomers, updateCustomer } from '../../services/adminservices/customerService'
import { getUsers } from '../../services/adminservices/userService'

const CustomerAllotment = () => {
  const [customers, setCustomers] = useState([])
  const [allCustomers, setAllCustomers] = useState([]) // raw list for counts/limits
  const [salesmen, setSalesmen] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterSalesman, setFilterSalesman] = useState('')
  const [filterStatus, setFilterStatus] = useState('unassigned') // Show unassigned by default
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [bulkSalesman, setBulkSalesman] = useState('')
  const [showBulkAllot, setShowBulkAllot] = useState(false)
  const [selectedSalesmanMap, setSelectedSalesmanMap] = useState({}) // Map customerId -> salesmanId

  // Load data on mount
  useEffect(() => {
    loadCustomers()
    loadSalesmen()
  }, [])

  // Reload when filters change
  useEffect(() => {
    loadCustomers()
  }, [filterSalesman, filterStatus, searchTerm])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterSalesman) params.salesman = filterSalesman
      if (filterStatus && filterStatus !== 'all') {
        if (filterStatus === 'unassigned' || filterStatus === 'assigned') {
          // We'll filter unassigned on frontend
        } else {
          params.status = filterStatus
        }
      }
      if (searchTerm) params.search = searchTerm

      const result = await getCustomers(params)
      if (result.success && result.data) {
        const raw = Array.isArray(result.data) ? result.data : []
        setAllCustomers(raw)

        let filteredCustomers = raw
        if (filterStatus === 'unassigned') filteredCustomers = raw.filter(c => !c.assignedSalesman)
        if (filterStatus === 'assigned') filteredCustomers = raw.filter(c => !!c.assignedSalesman)
        setCustomers(filteredCustomers)
      } else {
        console.error('Failed to load customers:', result.message)
        setAllCustomers([])
        setCustomers([])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setAllCustomers([])
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const loadSalesmen = async () => {
    try {
      const result = await getUsers({ role: 'salesman', status: 'Active' })
      if (result.success && result.data) {
        setSalesmen(result.data)
      }
    } catch (error) {
      console.error('Error loading salesmen:', error)
    }
  }

  const handleAllotCustomer = async (customerId, salesmanId) => {
    if (!salesmanId) {
      alert('Please select a salesman')
      return
    }

    setLoading(true)
    try {
      const result = await updateCustomer(customerId, {
        assignedSalesman: salesmanId,
      })

      if (result.success) {
        alert('Customer allotted successfully!')
        loadCustomers()
        setSelectedCustomers([])
      } else {
        alert(result.message || 'Failed to allot customer')
      }
    } catch (error) {
      console.error('Error allotting customer:', error)
      alert('Error allotting customer')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAllot = async () => {
    if (!bulkSalesman) {
      alert('Please select a salesman for bulk allotment')
      return
    }

    if (selectedCustomers.length === 0) {
      alert('Please select at least one customer')
      return
    }

    if (!window.confirm(`Are you sure you want to allot ${selectedCustomers.length} customer(s) to the selected salesman?`)) {
      return
    }

    setLoading(true)
    try {
      let successCount = 0
      let failCount = 0

      for (const customerId of selectedCustomers) {
        const result = await updateCustomer(customerId, {
          assignedSalesman: bulkSalesman,
        })
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      }

      alert(`Bulk allotment completed! ${successCount} successful, ${failCount} failed.`)
      loadCustomers()
      setSelectedCustomers([])
      setBulkSalesman('')
      setShowBulkAllot(false)
    } catch (error) {
      console.error('Error in bulk allotment:', error)
      alert('Error in bulk allotment')
    } finally {
      setLoading(false)
    }
  }

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId)
      } else {
        return [...prev, customerId]
      }
    })
  }

  const toggleSelectAll = () => {
    const selectable =
      filterStatus === 'unassigned'
        ? customers.filter(c => !c.assignedSalesman)
        : filterStatus === 'assigned'
          ? customers.filter(c => !!c.assignedSalesman)
          : []

    if (selectedCustomers.length === selectable.length) {
      setSelectedCustomers([])
    } else {
      setSelectedCustomers(selectable.map(c => c._id))
    }
  }

  const getSalesmanInfo = (salesmanId) => {
    return salesmen.find(s => s._id === salesmanId || s.id === salesmanId)
  }

  const getSalesmanCustomerCount = (salesmanId) => {
    return allCustomers.filter(c => 
      (c.assignedSalesman?._id === salesmanId || c.assignedSalesman === salesmanId) && 
      c.status === 'Active'
    ).length
  }

  return (
    <div className="w-full">
      <div className="rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Customer Allotment</h2>
            <p className="text-gray-600 mt-1">Allot customers to salesmen</p>
          </div>
          <div className="flex gap-3">
            {selectedCustomers.length > 0 && (
              <button
                onClick={() => setShowBulkAllot(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                title={`Bulk Allot ${selectedCustomers.length} customers`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-sm">{selectedCustomers.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Allotment Modal */}
        {showBulkAllot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Bulk Allot Customers</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Salesman *
                </label>
                <select
                  value={bulkSalesman}
                  onChange={(e) => setBulkSalesman(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
                >
                  <option value="">Select Salesman</option>
                  {salesmen.map((salesman) => {
                    const assignedCount = getSalesmanCustomerCount(salesman._id || salesman.id)
                    const limit = salesman.customerLimit
                    const remaining = limit !== null && limit !== undefined ? limit - assignedCount : null
                    return (
                      <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                        {salesman.name}
                        {limit !== null && limit !== undefined
                          ? ` (${assignedCount}/${limit}${remaining !== null ? `, ${remaining} remaining` : ''})`
                          : ` (${assignedCount} assigned)`
                        }
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  You are about to allot <strong>{selectedCustomers.length}</strong> customer(s) to the selected salesman.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkAllot}
                  className="flex-1 px-4 py-2 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
                  title="Confirm Allotment"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Confirm</span>
                </button>
                <button
                  onClick={() => {
                    setShowBulkAllot(false)
                    setBulkSalesman('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Salesman</label>
            <select
              value={filterSalesman}
              onChange={(e) => setFilterSalesman(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="">All Salesmen</option>
              {salesmen.map((salesman) => (
                <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                  {salesman.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
              <option value="all">All Customers</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterSalesman('')
                setFilterStatus('unassigned')
                setSearchTerm('')
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              title="Clear Filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Customers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Customers ({customers.length})
            </h3>
            {(filterStatus === 'unassigned' || filterStatus === 'assigned') && customers.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                title={selectedCustomers.length === customers.length ? 'Deselect All' : 'Select All'}
              >
                {selectedCustomers.length === customers.length ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span>{selectedCustomers.length === customers.length ? 'Deselect All' : 'Select All'}</span>
              </button>
            )}
          </div>

          {loading && customers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200">
              <p className="text-gray-600">Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-gray-200">
              <p className="text-gray-600">No customers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {(filterStatus === 'unassigned' || filterStatus === 'assigned') && (
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.length === customers.length && customers.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-[#e9931c] border-gray-300 rounded focus:ring-[#e9931c]"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Contact</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Company</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Current Salesman</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Allot To</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const isUnassigned = !customer.assignedSalesman
                    const isSelected = selectedCustomers.includes(customer._id)
                    const selectedSalesman = selectedSalesmanMap[customer._id] || ''

                    return (
                      <tr
                        key={customer._id}
                        className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        {(filterStatus === 'unassigned' || filterStatus === 'assigned') && (
                          <td className="py-4 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCustomerSelection(customer._id)}
                              className="w-4 h-4 text-[#e9931c] border-gray-300 rounded focus:ring-[#e9931c]"
                            />
                          </td>
                        )}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-gray-800">{customer.name}</div>
                          {customer.address && (
                            <div className="text-sm text-gray-500">{customer.address}</div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-800">{customer.email || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{customer.phone || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-4 text-gray-700">{customer.company || 'N/A'}</td>
                        <td className="py-4 px-4">
                          {customer.assignedSalesman ? (
                            <div className="font-medium text-gray-800">
                              {customer.assignedSalesman.name || getSalesmanInfo(customer.assignedSalesman?._id || customer.assignedSalesman)?.name}
                            </div>
                          ) : (
                            <span className="text-red-500 font-medium">Not Assigned</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedSalesman}
                              onChange={(e) => {
                                setSelectedSalesmanMap(prev => ({
                                  ...prev,
                                  [customer._id]: e.target.value
                                }))
                              }}
                              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
                            >
                              <option value="">Select Salesman</option>
                              {salesmen.map((salesman) => {
                                const assignedCount = getSalesmanCustomerCount(salesman._id || salesman.id)
                                const limit = salesman.customerLimit
                                const remaining = limit !== null && limit !== undefined ? limit - assignedCount : null
                                const isAtLimit = limit !== null && limit !== undefined && assignedCount >= limit
                                return (
                                  <option
                                    key={salesman._id || salesman.id}
                                    value={salesman._id || salesman.id}
                                    disabled={isAtLimit && customer.assignedSalesman?._id !== salesman._id}
                                  >
                                    {salesman.name}
                                    {limit !== null && limit !== undefined
                                      ? ` (${assignedCount}/${limit}${remaining !== null ? `, ${remaining} remaining` : ''})`
                                      : ` (${assignedCount} assigned)`
                                    }
                                    {isAtLimit && customer.assignedSalesman?._id !== salesman._id ? ' - Limit Reached' : ''}
                                  </option>
                                )
                              })}
                            </select>
                            {selectedSalesman && (
                              <button
                                onClick={() => {
                                  handleAllotCustomer(customer._id, selectedSalesman)
                                  setSelectedSalesmanMap(prev => {
                                    const newMap = { ...prev }
                                    delete newMap[customer._id]
                                    return newMap
                                  })
                                }}
                                className="p-2 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors"
                                title="Allot Customer"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              customer.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {customer.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerAllotment

