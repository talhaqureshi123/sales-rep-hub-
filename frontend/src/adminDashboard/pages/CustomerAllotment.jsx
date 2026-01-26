import { useState, useEffect } from 'react'
import { getCustomers, updateCustomer, getCustomer } from '../../services/adminservices/customerService'
import { getUsers } from '../../services/adminservices/userService'
import { createFollowUp, getFollowUps } from '../../services/adminservices/followUpService'
import { FaUser, FaFilter } from 'react-icons/fa'
import Swal from 'sweetalert2'

const CustomerAllotment = () => {
  const [customers, setCustomers] = useState([])
  const [allCustomers, setAllCustomers] = useState([]) // raw list for counts/limits
  const [salesmen, setSalesmen] = useState([])
  const [admins, setAdmins] = useState([]) // List of admins who created customers
  const [loading, setLoading] = useState(false)
  const [filterSalesman, setFilterSalesman] = useState('')
  const [filterStatus, setFilterStatus] = useState('unassigned') // Show unassigned by default
  const [filterCreatedBy, setFilterCreatedBy] = useState('') // Filter by admin who created customer
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomers, setSelectedCustomers] = useState([])
  const [bulkSalesman, setBulkSalesman] = useState('')
  const [showBulkAllot, setShowBulkAllot] = useState(false)
  const [selectedSalesmanMap, setSelectedSalesmanMap] = useState({}) // Map customerId -> salesmanId
  const [customerSalesmanMap, setCustomerSalesmanMap] = useState({}) // Map customerId -> {salesmanId, salesmanName} from tasks

  // Load data on mount
  useEffect(() => {
    loadSalesmen()
    loadAdmins()
    // Load mapping first, then customers (mapping will trigger customers reload)
    loadCustomerSalesmanMapping()
  }, [])

  // Reload when filters change
  useEffect(() => {
    loadCustomers()
  }, [filterSalesman, filterStatus, filterCreatedBy, searchTerm])

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
        if (filterStatus === 'unassigned') filteredCustomers = raw.filter(c => !customerSalesmanMap[c._id] && !c.assignedSalesman)
        if (filterStatus === 'assigned') filteredCustomers = raw.filter(c => !!customerSalesmanMap[c._id] || !!c.assignedSalesman)
        
        // Filter by admin who created the customer
        if (filterCreatedBy) {
          filteredCustomers = filteredCustomers.filter(c => {
            const createdById = c.createdBy?._id || c.createdBy
            return createdById && createdById.toString() === filterCreatedBy
          })
        }
        
        setCustomers(filteredCustomers)
        
        // Update selectedSalesmanMap with currently assigned salesmen
        setSelectedSalesmanMap(prev => {
          const newMap = { ...prev }
          raw.forEach(customer => {
            const assignedSalesmanId = customer.assignedSalesman?._id || customer.assignedSalesman
            if (assignedSalesmanId) {
              newMap[customer._id] = assignedSalesmanId
            }
          })
          return newMap
        })
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

  const loadAdmins = async () => {
    try {
      const result = await getUsers({ role: 'admin' })
      if (result.success && result.data) {
        // Filter to show only usmanabid admin (by name or email containing 'usmanabid')
        const filteredAdmins = result.data.filter(admin => {
          const name = (admin.name || '').toLowerCase()
          const email = (admin.email || '').toLowerCase()
          return name.includes('usmanabid') || email.includes('usmanabid')
        })
        setAdmins(filteredAdmins)
      }
    } catch (error) {
      console.error('Error loading admins:', error)
    }
  }

  // Load customer-salesman mapping from tasks/follow-ups
  const loadCustomerSalesmanMapping = async () => {
    try {
      const result = await getFollowUps({})
      if (result.success && result.data) {
        const mapping = {}
        const tasks = Array.isArray(result.data) ? result.data : []
        
        // Create mapping: customerId -> {salesmanId, salesmanName}
        tasks.forEach(task => {
          if (task.customer) {
            const customerId = task.customer._id || task.customer
            const salesmanId = task.salesman?._id || task.salesman
            const salesmanName = task.salesman?.name || task.hubspot_owner_name || ''
            
            // Only update if not already mapped (first task wins) or if this is a more recent allocation
            if (customerId && salesmanId) {
              if (!mapping[customerId] || task.createdAt > (mapping[customerId].createdAt || 0)) {
                mapping[customerId] = {
                  salesmanId,
                  salesmanName,
                  createdAt: task.createdAt
                }
              }
            }
          }
        })
        
        setCustomerSalesmanMap(mapping)
        // Reload customers to update filters based on new mapping
        // Use setTimeout to ensure state is updated before filtering
        setTimeout(() => {
          loadCustomers()
        }, 100)
      }
    } catch (error) {
      console.error('Error loading customer-salesman mapping:', error)
    }
  }

  const handleAllotCustomer = async (customerId, salesmanId) => {
    if (!salesmanId) {
      Swal.fire({
        icon: 'warning',
        title: 'Salesman Required',
        text: 'Please select a salesman',
        confirmButtonColor: '#e9931c',
      })
      return
    }

    setLoading(true)
    try {
      // Get customer details first
      const customerResult = await getCustomer(customerId)
      if (!customerResult.success || !customerResult.data) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load customer details',
          confirmButtonColor: '#e9931c',
        })
        return
      }

      const customer = customerResult.data
      const customerName = customer.firstName || customer.name || 'Customer'

      // Create a task (FollowUp) to link customer with salesman
      // This ensures customer appears in salesman's quotation dropdown
      const taskResult = await createFollowUp({
        salesman: salesmanId,
        customer: customerId,
        customerName: customerName,
        customerEmail: customer.email || '',
        customerPhone: customer.phone || '',
        type: 'Call',
        priority: 'Medium',
        dueDate: new Date().toISOString().split('T')[0],
        scheduledDate: new Date().toISOString().split('T')[0],
        description: `Customer allocated: ${customerName}`,
        notes: 'Customer allocated through Customer Allotment',
      })

      if (taskResult.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Customer allotted successfully! Customer will now appear in salesman\'s quotations.',
          confirmButtonColor: '#e9931c',
        })
        // Update the selectedSalesmanMap to show the newly assigned salesman
        setSelectedSalesmanMap(prev => ({
          ...prev,
          [customerId]: salesmanId
        }))
        // Reload customer-salesman mapping to reflect new assignment
        loadCustomerSalesmanMapping()
        loadCustomers()
        setSelectedCustomers([])
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: taskResult.message || 'Failed to allot customer',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error allotting customer:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error allotting customer: ' + (error.message || 'Unknown error'),
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAllot = async () => {
    if (!bulkSalesman) {
      Swal.fire({
        icon: 'warning',
        title: 'Salesman Required',
        text: 'Please select a salesman for bulk allotment',
        confirmButtonColor: '#e9931c',
      })
      return
    }

    if (selectedCustomers.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Customers Selected',
        text: 'Please select at least one customer',
        confirmButtonColor: '#e9931c',
      })
      return
    }

    const confirmResult = await Swal.fire({
      icon: 'question',
      title: 'Confirm Bulk Allotment',
      text: `Are you sure you want to allot ${selectedCustomers.length} customer(s) to the selected salesman?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Allot Them',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280',
    })

    if (!confirmResult.isConfirmed) {
      return
    }

    setLoading(true)
    try {
      let successCount = 0
      let failCount = 0

      for (const customerId of selectedCustomers) {
        try {
          // Get customer details
          const customerResult = await getCustomer(customerId)
          if (!customerResult.success || !customerResult.data) {
            failCount++
            continue
          }

          const customer = customerResult.data
          const customerName = customer.firstName || customer.name || 'Customer'

          // Create a task (FollowUp) to link customer with salesman
          const taskResult = await createFollowUp({
            salesman: bulkSalesman,
            customer: customerId,
            customerName: customerName,
            customerEmail: customer.email || '',
            customerPhone: customer.phone || '',
            type: 'Call',
            priority: 'Medium',
            dueDate: new Date().toISOString().split('T')[0],
            scheduledDate: new Date().toISOString().split('T')[0],
            description: `Customer allocated: ${customerName}`,
            notes: 'Customer allocated through Customer Allotment',
          })

          if (taskResult.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          console.error(`Error allotting customer ${customerId}:`, error)
          failCount++
        }
      }

      if (successCount > 0 && failCount === 0) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `All ${successCount} customer(s) allotted successfully! Customers will now appear in salesman's quotations.`,
          confirmButtonColor: '#e9931c',
        })
        // Update selectedSalesmanMap to show assigned salesmen
        setSelectedSalesmanMap(prev => {
          const newMap = { ...prev }
          selectedCustomers.forEach(customerId => {
            newMap[customerId] = bulkSalesman
          })
          return newMap
        })
        // Reload customer-salesman mapping
        loadCustomerSalesmanMapping()
      } else if (successCount > 0 && failCount > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Partial Success',
          html: `Bulk allotment completed!<br><strong>${successCount}</strong> successful, <strong>${failCount}</strong> failed.<br>Customers will now appear in salesman's quotations.`,
          confirmButtonColor: '#e9931c',
        })
        // Reload customer-salesman mapping
        loadCustomerSalesmanMapping()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: `All ${failCount} customer(s) failed to allot. Please try again.`,
          confirmButtonColor: '#e9931c',
        })
      }
      loadCustomerSalesmanMapping()
      loadCustomers()
      setSelectedCustomers([])
      setBulkSalesman('')
      setShowBulkAllot(false)
    } catch (error) {
      console.error('Error in bulk allotment:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error in bulk allotment: ' + (error.message || 'Unknown error'),
        confirmButtonColor: '#e9931c',
      })
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
        ? customers.filter(c => !customerSalesmanMap[c._id] && !c.assignedSalesman)
        : filterStatus === 'assigned'
          ? customers.filter(c => !!customerSalesmanMap[c._id] || !!c.assignedSalesman)
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
    // Count customers assigned to this salesman through tasks/follow-ups
    let count = 0
    Object.keys(customerSalesmanMap).forEach(customerId => {
      const mapping = customerSalesmanMap[customerId]
      const mappingSalesmanId = mapping.salesmanId?._id || mapping.salesmanId
      if (mappingSalesmanId && (mappingSalesmanId === salesmanId || mappingSalesmanId.toString() === salesmanId.toString())) {
        // Check if customer is active
        const customer = allCustomers.find(c => (c._id === customerId || c._id?.toString() === customerId))
        if (customer && customer.status === 'Active') {
          count++
        }
      }
    })
    return count
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
                    // Only show count if greater than 0
                    const countText = assignedCount > 0
                          ? (limit !== null && limit !== undefined
                              ? ` (${assignedCount}/${limit}${remaining !== null ? `, ${remaining} remaining` : ''})`
                              : ` (${assignedCount} assigned)`)
                          : ''
                    return (
                      <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                        {salesman.name}{countText}
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <FaFilter className="w-3 h-3" />
              Created By Admin
            </label>
            <select
              value={filterCreatedBy}
              onChange={(e) => setFilterCreatedBy(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c]"
            >
              <option value="">All Customers</option>
              {admins.map((admin) => {
                const assignedCount = allCustomers.filter(c => 
                  (c.createdBy?._id === admin._id || c.createdBy === admin._id) && 
                  c.status === 'Active'
                ).length
                // Only show count if greater than 0
                const countText = assignedCount > 0 ? ` (${assignedCount} assigned)` : ''
                return (
                  <option key={admin._id || admin.id} value={admin._id || admin.id}>
                    {admin.name}{countText}
                  </option>
                )
              })}
            </select>
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
                setFilterCreatedBy('')
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
              <table className="w-full min-w-full table-fixed">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    {(filterStatus === 'unassigned' || filterStatus === 'assigned') && (
                      <th className="text-left py-3 px-3 text-gray-700 font-semibold w-12">
                        <input
                          type="checkbox"
                          checked={selectedCustomers.length === customers.length && customers.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-[#e9931c] border-gray-300 rounded focus:ring-[#e9931c]"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-48">Name</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-48">Contact</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-40">Company</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-40">Created By</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-40">Current Salesman</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-56">Allot To</th>
                    <th className="text-left py-3 px-3 text-gray-700 font-semibold w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    // Check if customer is assigned through tasks
                    const taskMapping = customerSalesmanMap[customer._id]
                    const isUnassigned = !taskMapping && !customer.assignedSalesman
                    const isSelected = selectedCustomers.includes(customer._id)
                    // Get currently assigned salesman ID from tasks or legacy field, or selected one from map
                    const currentAssignedSalesmanId = taskMapping?.salesmanId?._id || taskMapping?.salesmanId || 
                                                     customer.assignedSalesman?._id || customer.assignedSalesman
                    const selectedSalesman = selectedSalesmanMap[customer._id] || currentAssignedSalesmanId || ''

                    return (
                      <tr
                        key={customer._id}
                        className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        {(filterStatus === 'unassigned' || filterStatus === 'assigned') && (
                          <td className="py-3 px-3 align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCustomerSelection(customer._id)}
                              className="w-4 h-4 text-[#e9931c] border-gray-300 rounded focus:ring-[#e9931c]"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3 align-top">
                          <div className="font-semibold text-gray-800 whitespace-nowrap truncate" title={customer.name}>{customer.name}</div>
                          {customer.address && (
                            <div className="text-xs text-gray-500 truncate" title={customer.address}>{customer.address}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="text-sm text-gray-800 truncate" title={customer.email || 'N/A'}>{customer.email || 'N/A'}</div>
                          <div className="text-sm text-gray-500 truncate" title={customer.phone || 'N/A'}>{customer.phone || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3 align-top text-gray-700">
                          <span className="truncate block" title={customer.company || 'N/A'}>{customer.company || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-3 align-top">
                          {customer.createdBy ? (
                            <div className="flex items-center gap-1 text-sm text-gray-700">
                              <FaUser className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <span className="truncate" title={customer.createdBy.name || customer.createdBy.email || 'N/A'}>
                                {customer.createdBy.name || customer.createdBy.email || 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-3 align-top">
                          {(() => {
                            // Check customer-salesman mapping from tasks
                            const mapping = customerSalesmanMap[customer._id]
                            if (mapping && mapping.salesmanId) {
                              const salesman = getSalesmanInfo(mapping.salesmanId)
                              return (
                                <div className="font-medium text-gray-800 truncate" title={mapping.salesmanName || salesman?.name || 'Assigned'}>
                                  {mapping.salesmanName || salesman?.name || 'Assigned'}
                                </div>
                              )
                            }
                            // Fallback to old assignedSalesman field (for legacy data)
                            if (customer.assignedSalesman) {
                              const salesmanName = customer.assignedSalesman.name || getSalesmanInfo(customer.assignedSalesman?._id || customer.assignedSalesman)?.name
                              return (
                                <div className="font-medium text-gray-800 truncate" title={salesmanName}>
                                  {salesmanName}
                                </div>
                              )
                            }
                            return <span className="text-red-500 font-medium text-sm">Not Assigned</span>
                          })()}
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedSalesman}
                              onChange={(e) => {
                                setSelectedSalesmanMap(prev => ({
                                  ...prev,
                                  [customer._id]: e.target.value
                                }))
                              }}
                              className="flex-1 min-w-0 px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] text-sm"
                            >
                              <option value="">Select...</option>
                              {salesmen.map((salesman) => {
                                const assignedCount = getSalesmanCustomerCount(salesman._id || salesman.id)
                                const limit = salesman.customerLimit
                                const remaining = limit !== null && limit !== undefined ? limit - assignedCount : null
                                const isAtLimit = limit !== null && limit !== undefined && assignedCount >= limit
                                // Only show count if greater than 0
                                const countText = assignedCount > 0
                                      ? (limit !== null && limit !== undefined
                                          ? ` (${assignedCount}/${limit}${remaining !== null ? `, ${remaining} remaining` : ''})`
                                          : ` (${assignedCount} assigned)`)
                                      : ''
                                return (
                                  <option
                                    key={salesman._id || salesman.id}
                                    value={salesman._id || salesman.id}
                                    disabled={isAtLimit && customer.assignedSalesman?._id !== salesman._id}
                                  >
                                    {salesman.name}{countText}
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
                                className="p-1.5 bg-[#e9931c] text-white rounded-lg hover:bg-[#d8820a] transition-colors flex-shrink-0"
                                title="Allot Customer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 align-middle">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
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

