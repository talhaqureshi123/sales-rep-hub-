import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaPlus,
  FaSearch,
  FaSpinner,
  FaCalendarAlt,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimesCircle,
  FaFilter,
  FaChevronLeft,
  FaChevronUp,
  FaChevronDown,
  FaStickyNote,
  FaChevronRight,
  FaEllipsisH,
  FaSyncAlt,
  FaFileAlt,
  FaVideo,
  FaFileExcel,
} from 'react-icons/fa'
import { getMyFollowUps, getMyFollowUp, createFollowUp, updateMyFollowUp, importFollowUps } from '../../services/salemanservices/followUpService'
import { getMyCustomers, getCustomer } from '../../services/salemanservices/customerService'
import { getQuotations } from '../../services/salemanservices/quotationService'
import { createSample } from '../../services/salemanservices/sampleService'
import { getMyProducts } from '../../services/salemanservices/productService'
import appTheme from '../../apptheme/apptheme'
import Swal from 'sweetalert2'

// Local date YYYY-MM-DD (avoids UTC shifting)
const getLocalDateString = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Format date/time for activity note line: [DD/MM/YYYY, HH:MM:SS] (parser expects this)
const formatActivityDateTime = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return { dateStr: `${day}/${month}/${year}`, timeStr: `${h}:${m}:${s}` }
}

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Today', label: 'Due today' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Completed', label: 'Completed' },
]

// Task types for salesman - Follow-up and Sample Track
const TASK_TYPES = ['Follow-up', 'Sample Track']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

const Tasks = () => {
  const [tasks, setTasks] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [modalActiveTab, setModalActiveTab] = useState('overview')
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [sortField, setSortField] = useState('dueDate')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false)
  const [showDueDateDropdown, setShowDueDateDropdown] = useState(false)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [activeFilters, setActiveFilters] = useState({
    taskType: [],
    priority: [],
    dueDateRange: null
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [taskCustomerDetails, setTaskCustomerDetails] = useState(null) // Full customer details for selected task
  const [taskQuotations, setTaskQuotations] = useState([]) // Quotations for selected task (Deals section)
  const [taskActivities, setTaskActivities] = useState([]) // Activities/notes for selected task
  const [noteInput, setNoteInput] = useState('') // Input for quick note typing
  const noteInputRef = useRef(null) // Ref for note input field
  const [activitiesSearch, setActivitiesSearch] = useState('') // Search filter for activities

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [products, setProducts] = useState([]) // Products for sample tracker
  const [selectedItems, setSelectedItems] = useState([]) // Selected products for sample
  const [addItemProduct, setAddItemProduct] = useState('')
  const [addItemQty, setAddItemQty] = useState(1)
  const [showImportExcelModal, setShowImportExcelModal] = useState(false)
  const [importExcelFile, setImportExcelFile] = useState(null)
  const [importExcelPreview, setImportExcelPreview] = useState([])
  const [importExcelLoading, setImportExcelLoading] = useState(false)

  const taskHeaderToField = (header) => {
    if (!header || typeof header !== 'string') return null
    const key = header.trim().toLowerCase().replace(/\s+/g, ' ')
    const map = {
      customername: 'customerName', 'customer name': 'customerName', customer_name: 'customerName',
      type: 'type', tasktype: 'type', 'task type': 'type',
      duedate: 'dueDate', 'due date': 'dueDate', due_date: 'dueDate', date: 'dueDate',
      description: 'description',
      priority: 'priority',
      customeremail: 'customerEmail', 'customer email': 'customerEmail', customer_email: 'customerEmail',
      customerphone: 'customerPhone', 'customer phone': 'customerPhone', customer_phone: 'customerPhone',
      notes: 'notes',
    }
    return map[key] || null
  }

  const parseTaskCSV = (text) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    if (!lines.length) return []
    const parseRow = (line) => {
      const out = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') inQuotes = !inQuotes
        else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) { out.push(cur.trim()); cur = '' }
        else cur += c
      }
      out.push(cur.trim())
      return out
    }
    const headerRow = parseRow(lines[0])
    const headers = headerRow.map((h) => taskHeaderToField(String(h).trim()) || String(h).trim())
    const preview = []
    for (let i = 1; i < lines.length; i++) {
      const cells = parseRow(lines[i])
      const obj = {}
      headers.forEach((field, j) => {
        const val = cells[j]
        if (field && val !== undefined && String(val).trim() !== '') obj[field] = String(val).trim()
      })
      if (obj.customerName && obj.dueDate) preview.push(obj)
    }
    return preview
  }

  const handleTaskExcelFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isCSV = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    if (!isCSV) {
      Swal.fire({
        icon: 'warning',
        title: 'Use CSV file',
        text: 'Please select a CSV file. In Excel: File → Save As → CSV (Comma delimited).',
        confirmButtonColor: '#e9931c',
      })
      return
    }
    setImportExcelFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result
        if (typeof text !== 'string') { setImportExcelPreview([]); return }
        setImportExcelPreview(parseTaskCSV(text))
      } catch (err) {
        console.error('Parse error:', err)
        Swal.fire({ icon: 'error', title: 'Parse error', text: err.message || 'Could not read file', confirmButtonColor: '#e9931c' })
        setImportExcelPreview([])
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportTaskExcelSubmit = async () => {
    if (!importExcelPreview.length) {
      Swal.fire({
        icon: 'warning',
        title: 'No data',
        text: 'No valid rows. Use headers: customerName, dueDate. Optional: type, description, priority, customerEmail, notes.',
        confirmButtonColor: '#e9931c',
      })
      return
    }
    setImportExcelLoading(true)
    try {
      const result = await importFollowUps(importExcelPreview)
      if (result.success) {
        const { createdCount = 0, skippedCount = 0, skipped = [] } = result.data || {}
        setShowImportExcelModal(false)
        setImportExcelFile(null)
        setImportExcelPreview([])
        loadTasks()
        const skippedMsg = skippedCount > 0 && Array.isArray(skipped) && skipped.length
          ? `<p class="text-left mt-2">Skipped ${skippedCount} row(s):</p><ul class="text-left text-sm mt-1 max-h-32 overflow-y-auto">${skipped.slice(0, 15).map(s => `<li>Row ${s.row}: ${s.reason}</li>`).join('')}${skipped.length > 15 ? `<li>... and ${skipped.length - 15} more</li>` : ''}</ul>`
          : (skippedCount > 0 ? `<p>Skipped: ${skippedCount} row(s).</p>` : '')
        Swal.fire({
          icon: 'success',
          title: 'Import complete',
          html: `<p>Imported <strong>${createdCount}</strong> task(s).</p>${skippedMsg}`,
          confirmButtonColor: '#e9931c',
        })
      } else {
        Swal.fire({ icon: 'error', title: 'Import failed', text: result.message || 'Failed to import tasks', confirmButtonColor: '#e9931c' })
      }
    } catch (err) {
      console.error('Import error:', err)
      Swal.fire({ icon: 'error', title: 'Error', text: err.message || 'Error importing tasks', confirmButtonColor: '#e9931c' })
    } finally {
      setImportExcelLoading(false)
    }
  }

  const [formData, setFormData] = useState({
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    contactPerson: '',
    billingAddress: '',
    deliveryAddress: '',
    type: 'Follow-up',
    followUpType: 'Call', // Follow-up type (Call, Email, Meeting, etc.)
    priority: 'Medium',
    dueDate: '',
    dueTime: '09:00',
    description: '',
    notes: '',
    visitDate: getLocalDateString(), // For sample tracker
    expectedDate: '', // For sample tracker
    expectedTime: '09:00', // For sample tracker – time for expected date
  })

  const filtered = useMemo(() => {
    const seenIds = new Set()
    let list = tasks.filter((t) => {
      const id = (t._id || t.id)?.toString()
      if (!id || seenIds.has(id)) return false
      seenIds.add(id)
      return true
    })

    // Get current salesman's assigned customer IDs
    const assignedCustomerIds = customers.map(c => c._id || c.id).filter(id => id)
    const assignedCustomerEmails = customers.map(c => (c.email || '').toLowerCase()).filter(email => email)
    const assignedCustomerNames = customers.map(c => (c.name || c.firstName || '').toLowerCase()).filter(name => name)

    // Filter tasks to show only those related to salesman's assigned customers
    list = list.filter((t) => {
      // Exclude HubSpot imported tasks
      const isHubSpotImported = t.source === 'hubspot' ||
        (t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null) ||
        (t.description || '').toLowerCase().includes('hubspot task')

      if (isHubSpotImported) return false

      // Show tasks that are:
      // 1. Created by salesman – show all (no admin approval needed)
      // 2. Created by admin AND approved AND customer is assigned to this salesman
      const createdByRole = t.createdBy?.role
      const isAdminCreated = createdByRole === 'admin'
      const taskCustomerId = t.customer?._id || t.customer || null
      const taskCustomerEmail = (t.customerEmail || '').toLowerCase()
      const taskCustomerName = (t.customerName || '').toLowerCase()

      const isCustomerAssigned =
        (taskCustomerId && assignedCustomerIds.some(id => id.toString() === taskCustomerId.toString())) ||
        (taskCustomerEmail && assignedCustomerEmails.includes(taskCustomerEmail)) ||
        (taskCustomerName && assignedCustomerNames.some(name => taskCustomerName.includes(name) || name.includes(taskCustomerName)))

      // Salesman-created tasks (and tasks with no createdBy – e.g. just assigned to me) always show
      if (createdByRole === 'salesman' || !createdByRole) {
        return true
      }
      if (isAdminCreated) {
        return isCustomerAssigned
      }

      return false
    })

    if (activeTab !== 'All') {
      list = list.filter((t) => t.status === activeTab)
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter((t) => {
        return (
          (t.description || '').toLowerCase().includes(s) ||
          (t.customerName || '').toLowerCase().includes(s) ||
          (t.customerEmail || '').toLowerCase().includes(s) ||
          (t.followUpNumber || '').toLowerCase().includes(s)
        )
      })
    }
    // Apply active filters – case-insensitive and support type / hs_task_type
    if (activeFilters.taskType.length > 0) {
      list = list.filter(t => {
        const taskType = (t.hs_task_type || t.type || '').toString().trim()
        return activeFilters.taskType.some(ft => {
          const f = (ft || '').toString().toLowerCase().trim()
          const tt = taskType.toLowerCase()
          if (f === tt) return true
          if ((f === 'visit' || f === 'visit target') && (tt.includes('visit') || t.isVisitTarget || t.visitTargetId)) return true
          if ((f === 'follow-up' || f === 'follow up') && tt.includes('follow')) return true
          if ((f === 'sample' || f === 'sample feedback') && (tt.includes('sample') || tt.includes('feedback'))) return true
          if (f === 'call' && (tt === 'call' || tt.includes('call'))) return true
          if (f === 'email' && (tt === 'email' || tt.includes('email'))) return true
          return false
        })
      })
    }
    if (activeFilters.priority.length > 0) {
      list = list.filter(t => {
        const p = (t.priority || '').toString().toLowerCase()
        return activeFilters.priority.some(fp => (fp || '').toString().toLowerCase() === p)
      })
    }
    if (activeFilters.dueDateRange) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)

      list = list.filter(t => {
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        dueDate.setHours(0, 0, 0, 0)

        switch (activeFilters.dueDateRange) {
          case 'today':
            return dueDate.getTime() === today.getTime()
          case 'yesterday':
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            return dueDate.getTime() === yesterday.getTime()
          case 'tomorrow':
            return dueDate.getTime() === tomorrow.getTime()
          case 'thisWeek':
            return dueDate >= today && dueDate <= nextWeek
          case 'overdue':
            return dueDate < today
          default:
            return true
        }
      })
    }
    // Dedupe by business key (same customer + same type + same due date day) so "Call Call" do bar na dikhe
    const businessKeySeen = new Set()
    list = list.filter((t) => {
      const cust = (t.customer?._id || t.customer || t.customerName || '').toString()
      const type = (t.type || '').toString()
      const dueDay = t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : ''
      const key = `${cust}|${type}|${dueDay}`
      if (businessKeySeen.has(key)) return false
      businessKeySeen.add(key)
      return true
    })
    return list
  }, [tasks, activeTab, search, activeFilters])

  useEffect(() => {
    loadTasks()
    loadCustomers()
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const result = await getMyProducts()
      if (result.success && result.data) {
        setProducts(result.data || [])
      }
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  // Refresh tasks when user comes back to tab/window or periodically (so admin-deleted task disappears everywhere)
  useEffect(() => {
    const refresh = () => loadTasks()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onWindowFocus = () => refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onWindowFocus)
    const intervalMs = 90 * 1000
    const intervalId = setInterval(refresh, intervalMs)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', onWindowFocus)
      clearInterval(intervalId)
    }
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTaskTypeDropdown(false)
        setShowDueDateDropdown(false)
        setShowPriorityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const res = await getMyFollowUps({ status: 'All' })
      if (res.success) {
        const raw = res.data || []
        const seenIds = new Set()
        const unique = raw.filter((t) => {
          const id = (t._id || t.id)?.toString()
          if (!id || seenIds.has(id)) return false
          seenIds.add(id)
          return true
        })
        setTasks(unique)
      } else {
        setTasks([])
      }
    } catch (e) {
      console.error(e)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const res = await getMyCustomers()
      if (res.success) {
        setCustomers(res.data || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const typeLower = (formData.type || '').toLowerCase().trim()

      // Handle Sample Track - create sample instead of task
      if (typeLower === 'sample track' || typeLower.includes('sample')) {
        const custName = (formData.customerName || '').trim()
        if (!custName) {
          await Swal.fire({
            icon: 'warning',
            title: 'Required Fields Missing',
            text: 'Please fill in Customer Name',
            confirmButtonColor: '#e9931c',
          })
          setSubmitting(false)
          return
        }
        if (selectedItems.length === 0) {
          await Swal.fire({
            icon: 'warning',
            title: 'Add at least one item',
            text: 'Select a product and quantity, then click + to add. You can add a single product or multiple products.',
            confirmButtonColor: '#e9931c',
          })
          setSubmitting(false)
          return
        }

        // Create samples for each selected item (single or multiple)
        // Only send customer ID if it's in assigned list; otherwise sample is created with name only
        const customerId = formData.customer && customers.some(c => (c._id || c.id)?.toString() === (formData.customer || '').toString())
          ? formData.customer
          : undefined
        let created = 0
        let failed = 0
        let firstError = ''
        const createdSampleIds = []
        for (const item of selectedItems) {
          const payload = {
            customer: customerId,
            customerName: custName,
            customerEmail: (formData.customerEmail || '').trim() || undefined,
            customerPhone: (formData.customerPhone || '').trim() || undefined,
            product: item.productId,
            productName: (item.productName || '').trim() || 'Product',
            productCode: (item.productCode || '').trim() || undefined,
            quantity: Math.max(1, Number(item.quantity) || 1),
            visitDate: (formData.visitDate || getLocalDateString()).trim(),
            expectedDate: (formData.expectedDate || '').trim() || undefined,
            notes: (formData.notes || '').trim() || undefined,
          }
          const result = await createSample(payload)
          if (result.success) {
            created++
            if (result.data?._id) createdSampleIds.push(result.data._id)
          } else {
            failed++
            if (!firstError && result.message) firstError = result.message
          }
        }

        if (created > 0) {
          // Create a follow-up task (Sample Feedback) so it appears in salesman Tasks and admin Tasks
          let sampleTaskCreated = false
          if (createdSampleIds.length > 0) {
            const datePart = (formData.expectedDate || formData.visitDate || getLocalDateString()).trim()
            const timePart = (formData.expectedTime || '09:00').trim().slice(0, 5) // HH:MM
            let dueDateTime = datePart.includes('T') ? datePart : `${datePart}T${timePart || '09:00'}:00`
            const buildTaskData = (due) => ({
              customer: customerId,
              customerName: custName,
              customerEmail: (formData.customerEmail || '').trim() || undefined,
              customerPhone: (formData.customerPhone || '').trim() || undefined,
              type: 'Sample Feedback',
              priority: formData.priority || 'Medium',
              dueDate: due,
              scheduledDate: due,
              description: `Sample follow-up: ${custName}`,
              notes: (formData.notes || '').trim() || undefined,
              relatedSample: createdSampleIds[0],
            })
            let taskRes = await createFollowUp(buildTaskData(dueDateTime))
            if (!taskRes.success) {
              // Retry once with +1 minute to avoid time conflict (same-minute task/visit)
              const isTimeConflict = (taskRes.message || '').toLowerCase().includes('already exists') || (taskRes.message || '').toLowerCase().includes('same time')
              if (isTimeConflict) {
                const d = new Date(dueDateTime)
                if (!isNaN(d.getTime())) {
                  d.setMinutes(d.getMinutes() + 1)
                  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
                  const h = String(d.getHours()).padStart(2, '0'), min = String(d.getMinutes()).padStart(2, '0')
                  dueDateTime = `${y}-${m}-${day}T${h}:${min}:00`
                  taskRes = await createFollowUp(buildTaskData(dueDateTime))
                }
              }
              if (taskRes.success) sampleTaskCreated = true
              else console.warn('Sample Feedback task could not be created:', taskRes.message)
            } else {
              sampleTaskCreated = true
            }
          }
          const successText = failed > 0
            ? `${created} ${created === 1 ? 'sample' : 'samples'} created. ${failed} ${failed === 1 ? 'sample' : 'samples'} failed.`
            : created === 1
              ? '1 sample created successfully!'
              : `${created} samples created successfully!`
          const taskNote = sampleTaskCreated
            ? ' Task has been created and will appear in your Tasks list.'
            : ' Follow-up task could not be created (e.g. another task at same time). You can add a follow-up manually.'
          await Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: successText + taskNote,
            confirmButtonColor: '#e9931c',
          })
          setShowCreateForm(false)
          resetForm()
          window.dispatchEvent(new CustomEvent('samples-created'))
          await loadTasks()
        } else {
          const failText = failed === 1 ? 'Failed to create 1 sample.' : `Failed to create ${failed} samples.`
          const detail = firstError ? ` ${firstError}` : ''
          await Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: (failed > 0 ? failText : 'Error creating samples') + detail,
            confirmButtonColor: '#e9931c',
          })
        }
        setSubmitting(false)
        return
      }

      // Handle Follow-up - create task
      // Combine date and time for dueDate
      const dueDateTime = formData.dueDate && formData.dueTime
        ? new Date(`${formData.dueDate}T${formData.dueTime}`)
        : new Date()

      // Map task type to backend enum values
      const mapTaskType = (type) => {
        const typeLower = (type || '').toLowerCase().trim()
        if (typeLower === 'follow-up' || typeLower === 'follow up' || typeLower.includes('follow')) {
          // Use selected follow-up type if available
          return formData.followUpType || 'Call'
        }
        return 'Call' // Default fallback
      }

      // Combine notes with customer details (like admin sales form)
      const notesParts = []
      if (formData.contactPerson) notesParts.push(`Contact Person: ${formData.contactPerson}`)
      if (formData.billingAddress) notesParts.push(`Billing Address: ${formData.billingAddress}`)
      if (formData.deliveryAddress) notesParts.push(`Delivery Address: ${formData.deliveryAddress}`)
      if (formData.notes) notesParts.push(formData.notes)
      const combinedNotes = notesParts.length > 0 ? notesParts.join('\n\n') : undefined

      const taskType = formData.type === 'Follow-up'
        ? (formData.followUpType || 'Call')
        : mapTaskType(formData.type)
      const description = formData.description || `Follow up with ${formData.customerName}`

      const taskData = {
        customer: formData.customer || undefined,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        type: taskType,
        priority: formData.priority,
        scheduledDate: dueDateTime,
        dueDate: dueDateTime,
        description,
        notes: combinedNotes,
      }

      // When creating a Meeting follow-up, add a note line so it shows in Activities when task is opened
      if (taskType === 'Meeting') {
        const { dateStr, timeStr } = formatActivityDateTime(dueDateTime)
        const meetLink = 'https://meet.google.com/new'
        const meetingLine = `[${dateStr}, ${timeStr}] Meeting: ${description} - Google Meet: ${meetLink}`
        taskData.notes = taskData.notes ? `${meetingLine}\n${taskData.notes}` : meetingLine
      }

      const res = await createFollowUp(taskData)
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Task Created!',
          text: 'Task created successfully! No admin approval needed — it will appear in your tasks list.',
          confirmButtonColor: '#e9931c'
        })
        setShowCreateForm(false)
        resetForm()
        await loadTasks()
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'Cannot create task',
          text: res.message || 'Failed to create task',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (e) {
      console.error(e)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating task',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const addItemToSelection = () => {
    if (!addItemProduct) return
    const p = products.find(pr => pr._id === addItemProduct)
    if (!p) return
    const qty = Math.max(1, parseInt(addItemQty, 10) || 1)
    if (selectedItems.some(item => item.productId === p._id)) {
      Swal.fire({ icon: 'info', title: 'Already added', text: 'This product is already in the list.', confirmButtonColor: '#e9931c' })
      return
    }
    setSelectedItems(prev => [...prev, { productId: p._id, productName: p.name || '', productCode: p.productCode || '', quantity: qty }])
    setAddItemProduct('')
    setAddItemQty(1)
  }

  const removeItemFromSelection = (index) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleTaskClick = async (task) => {
    try {
      const res = await getMyFollowUp(task._id)
      if (res.success) {
        setSelectedTask(res.data)
        setShowTaskDetail(true)
        setModalActiveTab('overview')
        // Find current task index in filtered list
        const index = filtered.findIndex(t => t._id === task._id)
        setCurrentTaskIndex(index >= 0 ? index : 0)

        let loadedCustomer = null
        if (res.data.customer) {
          try {
            const customerId = typeof res.data.customer === 'object' ? res.data.customer._id : res.data.customer
            if (customerId) {
              const customerRes = await getCustomer(customerId)
              if (customerRes.success) {
                loadedCustomer = customerRes.data
                setTaskCustomerDetails(customerRes.data)
              } else {
                setTaskCustomerDetails(null)
              }
            }
          } catch (e) {
            console.error('Error loading customer details:', e)
            setTaskCustomerDetails(null)
          }
        } else {
          setTaskCustomerDetails(null)
        }

        // Parse activities from notes
        let parsedActivities = []
        if (res.data.notes) {
          try {
            const notesLines = res.data.notes.split('\n').filter(line => line.trim())
            notesLines.forEach(line => {
              // Match pattern: [DD/MM/YYYY, HH:MM:SS] Type: Content
              const match = line.match(/\[(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2}:\d{2})\]\s*(\w+):\s*(.+)/)
              if (match) {
                const [, dateStr, timeStr, type, content] = match
                try {
                  const [day, month, year] = dateStr.split('/')
                  const dateTime = new Date(`${year}-${month}-${day}T${timeStr}`)
                  parsedActivities.push({
                    type: type,
                    content: content,
                    date: dateTime,
                    dateStr: dateStr,
                    timeStr: timeStr
                  })
                } catch (e) {
                  parsedActivities.push({
                    type: type,
                    content: content,
                    date: new Date(),
                    dateStr: dateStr,
                    timeStr: timeStr
                  })
                }
              }
            })
          } catch (e) {
            console.error('Error parsing activities:', e)
          }
        }
        // If task type is Meeting but no Meeting activity in notes, add one from task so it always shows
        const taskType = (res.data.type || '').toString().trim()
        if (taskType === 'Meeting') {
          const hasMeeting = parsedActivities.some(a => (a.type || '').toString() === 'Meeting')
          if (!hasMeeting) {
            const due = res.data.dueDate ? new Date(res.data.dueDate) : new Date()
            const { dateStr, timeStr } = formatActivityDateTime(due)
            parsedActivities.unshift({
              type: 'Meeting',
              content: (res.data.description || 'Meeting') + ' - Google Meet: https://meet.google.com/new',
              date: due,
              dateStr,
              timeStr
            })
          }
        }
        parsedActivities.sort((a, b) => b.date.getTime() - a.date.getTime())
        setTaskActivities(parsedActivities)

        // Load quotations for this task's customer (Deals section – show in modal)
        const taskEmail = (res.data.customerEmail || loadedCustomer?.email || res.data.customer?.email || '').trim().toLowerCase()
        const taskName = (res.data.customerName || loadedCustomer?.name || loadedCustomer?.firstName || res.data.customer?.name || res.data.customer?.firstName || '').trim()
        if (taskEmail || taskName) {
          try {
            const quotationsRes = await getQuotations()
            if (quotationsRes.success && quotationsRes.data) {
              const matchingQuotations = quotationsRes.data.filter(q => {
                const qEmail = (q.customerEmail || '').trim().toLowerCase()
                const qName = (q.customerName || '').trim().toLowerCase()
                return (
                  (taskEmail && qEmail && qEmail === taskEmail) ||
                  (taskName && qName && qName.includes(taskName.toLowerCase()))
                )
              })
              setTaskQuotations(matchingQuotations)
            } else {
              setTaskQuotations([])
            }
          } catch (err) {
            console.error('Error loading quotations for task:', err)
            setTaskQuotations([])
          }
        } else {
          setTaskQuotations([])
        }
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error loading task details',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleNextTask = () => {
    if (currentTaskIndex < filtered.length - 1) {
      const nextTask = filtered[currentTaskIndex + 1]
      handleTaskClick(nextTask)
    }
  }

  const handlePrevTask = () => {
    if (currentTaskIndex > 0) {
      const prevTask = filtered[currentTaskIndex - 1]
      handleTaskClick(prevTask)
    }
  }

  const handleCompleteTask = async (taskId) => {
    const result = await Swal.fire({
      title: 'Mark as Completed?',
      text: 'Are you sure you want to mark this task as completed?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Complete',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal2-container-custom',
        popup: 'swal2-popup-custom'
      },
      didOpen: () => {
        // Ensure SweetAlert appears on top
        const swalContainer = document.querySelector('.swal2-container')
        if (swalContainer) {
          swalContainer.style.zIndex = '99999'
        }
      }
    })
    if (!result.isConfirmed) return

    try {
      const res = await updateMyFollowUp(taskId, {
        status: 'Completed',
        completedDate: new Date(),
      })
      if (res.success) {
        // Reload task details to get updated status
        const updatedRes = await getMyFollowUp(taskId)
        if (updatedRes.success) {
          setSelectedTask(updatedRes.data)
        }
        await loadTasks()
        Swal.fire({
          icon: 'success',
          title: 'Task Completed!',
          text: 'Task has been marked as completed successfully.',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true,
          customClass: {
            container: 'swal2-container-custom',
            popup: 'swal2-popup-custom'
          },
          didOpen: () => {
            // Ensure SweetAlert appears on top
            const swalContainer = document.querySelector('.swal2-container')
            if (swalContainer) {
              swalContainer.style.zIndex = '99999'
            }
          }
        })
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to update task',
          confirmButtonColor: '#e9931c',
          customClass: {
            container: 'swal2-container-custom',
            popup: 'swal2-popup-custom'
          },
          didOpen: () => {
            const swalContainer = document.querySelector('.swal2-container')
            if (swalContainer) {
              swalContainer.style.zIndex = '99999'
            }
          }
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating task',
        confirmButtonColor: '#e9931c',
        customClass: {
          container: 'swal2-container-custom',
          popup: 'swal2-popup-custom'
        },
        didOpen: () => {
          const swalContainer = document.querySelector('.swal2-container')
          if (swalContainer) {
            swalContainer.style.zIndex = '99999'
          }
        }
      })
    }
  }

  const handleCustomerSelect = (customer) => {
    if (typeof customer === 'string') {
      // If string ID, find customer
      const found = customers.find(c => c._id === customer)
      if (found) customer = found
      else return
    }
    setFormData(prev => ({
      ...prev,
      customer: customer._id || customer.id,
      customerName: customer.name || customer.firstName || '',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
      contactPerson: customer.contactPerson || customer.name || customer.firstName || '',
      billingAddress: customer.address || customer.billingAddress || '',
      deliveryAddress: customer.address || customer.deliveryAddress || '',
    }))
    setCustomerSearch(customer.name || customer.firstName || '')
    setShowCustomerDropdown(false)
  }

  // Filter customers for dropdown search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 10)
    const searchLower = customerSearch.toLowerCase()
    return customers.filter(c => {
      const name = (c.name || c.firstName || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower)
    }).slice(0, 10)
  }, [customers, customerSearch])

  const resetForm = () => {
    setFormData({
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      contactPerson: '',
      billingAddress: '',
      deliveryAddress: '',
      type: 'Follow-up',
      followUpType: 'Call',
      priority: 'Medium',
      dueDate: '',
      dueTime: '09:00',
      description: '',
      notes: '',
      visitDate: getLocalDateString(),
      expectedDate: '',
      expectedTime: '09:00',
    })
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setSelectedItems([])
    setAddItemProduct('')
    setAddItemQty(1)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Overdue':
        return { bg: appTheme.status.error.light, text: appTheme.status.error.text, icon: FaExclamationTriangle }
      case 'Today':
        return { bg: appTheme.status.warning.light, text: appTheme.status.warning.text, icon: FaClock }
      case 'Upcoming':
        return { bg: appTheme.status.info.light, text: appTheme.status.info.text, icon: FaCalendarAlt }
      case 'Completed':
        return { bg: appTheme.status.success.light, text: appTheme.status.success.text, icon: FaCheckCircle }
      default:
        return { bg: appTheme.background.lightGray, text: appTheme.text.secondary, icon: FaClock }
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-700'
      case 'High':
        return 'bg-orange-100 text-orange-700'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'Low':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
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

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc'
      ? <FaChevronUp className="w-3 h-3 ml-1" />
      : <FaChevronDown className="w-3 h-3 ml-1" />
  }

  // Sort filtered tasks - Today's tasks first by default
  const sortedTasks = useMemo(() => {
    let sorted = [...filtered]

    // Check if we're sorting by dueDate (default) and no custom sort is applied
    const isDefaultDueDateSort = sortField === 'dueDate' && sortOrder === 'asc'

    if (isDefaultDueDateSort) {
      // Separate today's tasks from others
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const todayTasks = []
      const otherTasks = []

      sorted.forEach(task => {
        if (!task.dueDate) {
          otherTasks.push(task)
          return
        }

        const dueDate = new Date(task.dueDate)
        dueDate.setHours(0, 0, 0, 0)

        // Check if task is due today
        if (dueDate.getTime() === today.getTime()) {
          todayTasks.push(task)
        } else {
          otherTasks.push(task)
        }
      })

      // Sort today's tasks by time (if available) or keep original order
      todayTasks.sort((a, b) => {
        if (a.dueTime && b.dueTime) {
          return a.dueTime.localeCompare(b.dueTime)
        }
        return 0
      })

      // Sort other tasks by date (ascending - oldest first)
      otherTasks.sort((a, b) => {
        const aDate = new Date(a.dueDate || 0).getTime()
        const bDate = new Date(b.dueDate || 0).getTime()
        return aDate - bDate
      })

      // Return today's tasks first, then others
      return [...todayTasks, ...otherTasks]
    }

    // For other sort fields, use normal sorting
    sorted.sort((a, b) => {
      let aVal, bVal
      switch (sortField) {
        case 'description':
          aVal = (a.description || '').toLowerCase()
          bVal = (b.description || '').toLowerCase()
          break
        case 'customerName':
          aVal = (a.customerName || '').toLowerCase()
          bVal = (b.customerName || '').toLowerCase()
          break
        case 'dueDate':
          aVal = new Date(a.dueDate || 0).getTime()
          bVal = new Date(b.dueDate || 0).getTime()
          break
        case 'priority':
          const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 }
          aVal = priorityOrder[a.priority] || 0
          bVal = priorityOrder[b.priority] || 0
          break
        case 'type':
          aVal = (a.type || '').toLowerCase()
          bVal = (b.type || '').toLowerCase()
          break
        case 'status':
          aVal = (a.status || '').toLowerCase()
          bVal = (b.status || '').toLowerCase()
          break
        default:
          aVal = new Date(a.createdAt || 0).getTime()
          bVal = new Date(b.createdAt || 0).getTime()
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })
    return sorted
  }, [filtered, sortField, sortOrder])

  // Pagination
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedTasks.slice(startIndex, endIndex)
  }, [sortedTasks, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage)

  const handleFilterChange = (filterType, value, isMultiple = false) => {
    setActiveFilters(prev => {
      if (isMultiple) {
        const current = prev[filterType] || []
        const newValue = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value]
        return { ...prev, [filterType]: newValue }
      } else {
        return { ...prev, [filterType]: value === prev[filterType] ? null : value }
      }
    })
  }

  const removeFilter = (filterType, value = null) => {
    setActiveFilters(prev => {
      if (value !== null) {
        const current = prev[filterType] || []
        return { ...prev, [filterType]: current.filter(v => v !== value) }
      } else {
        return { ...prev, [filterType]: Array.isArray(prev[filterType]) ? [] : null }
      }
    })
  }

  const clearAllFilters = () => {
    setActiveFilters({
      taskType: [],
      priority: [],
      dueDateRange: null
    })
    setSearch('')
  }

  const hasActiveFilters = activeFilters.taskType.length > 0 ||
    activeFilters.priority.length > 0 ||
    activeFilters.dueDateRange !== null ||
    search.trim() !== ''

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 pt-2 lg:pt-0">
      {/* Header – mobile responsive */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate" style={{ color: appTheme.text.primary }}>Tasks</h2>
          <p className="text-xs sm:text-sm" style={{ color: appTheme.text.secondary }}>
            {loading ? 'Loading...' : `${sortedTasks.length} records`}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => loadTasks()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all"
            title="Refresh list (e.g. after admin deleted a task)"
          >
            <FaSyncAlt className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowImportExcelModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium text-white bg-green-600 hover:bg-green-700 transition-all flex-1 sm:flex-initial justify-center"
          >
            <FaFileExcel className="w-4 h-4" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-semibold text-white transition-all flex-1 sm:flex-initial justify-center"
            style={{ backgroundColor: '#ff7a59' }}
          >
            <FaPlus className="w-4 h-4" />
            <span>Create task</span>
          </button>
        </div>
      </div>

      {/* Tabs – horizontal scroll on mobile */}
      <div className="flex overflow-x-auto gap-2 mb-3 sm:mb-4 pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setCurrentPage(1)
            }}
            className={`flex-shrink-0 px-3 py-2 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-colors relative ${activeTab === tab.id
              ? 'text-white'
              : 'text-gray-700 hover:bg-gray-100'
              }`}
            style={activeTab === tab.id ? { backgroundColor: appTheme.primary.main } : {}}
          >
            {tab.label}
            {activeTab === tab.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveTab('All')
                  setCurrentPage(1)
                }}
                className="ml-2 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm mb-3 sm:mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          {/* Active Filter Tags */}
          {activeFilters.taskType.map(type => (
            <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Task type: {type}
              <button onClick={() => removeFilter('taskType', type)} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.priority.map(priority => (
            <span key={priority} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Priority: {priority}
              <button onClick={() => removeFilter('priority', priority)} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.dueDateRange && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Due date: {activeFilters.dueDateRange}
              <button onClick={() => removeFilter('dueDateRange')} className="hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Task Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTaskTypeDropdown(!showTaskTypeDropdown)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Task type</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showTaskTypeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {TASK_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.taskType.includes(type)}
                        onChange={() => handleFilterChange('taskType', type, true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Due Date Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDueDateDropdown(!showDueDateDropdown)
                setShowTaskTypeDropdown(false)
                setShowPriorityDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Due date</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showDueDateDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] max-h-80 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'yesterday', label: 'Yesterday' },
                    { value: 'tomorrow', label: 'Tomorrow' },
                    { value: 'thisWeek', label: 'This week' },
                    { value: 'overdue', label: 'Overdue' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('dueDateRange', option.value)
                        setShowDueDateDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${activeFilters.dueDateRange === option.value ? 'bg-blue-50 text-blue-700' : ''
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPriorityDropdown(!showPriorityDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Priority</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showPriorityDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search"
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {PRIORITIES.map(priority => (
                    <label key={priority} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.priority.includes(priority)}
                        onChange={() => handleFilterChange('priority', priority, true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Filters Button */}
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <FaFilter className="w-3 h-3" />
            <span>Advanced filters</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-3">
          <div className="flex-1 flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-300">
            <FaSearch style={{ color: appTheme.text.tertiary }} className="w-4 h-4 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task title and notes"
              className="flex-1 bg-transparent outline-none text-xs sm:text-sm"
              style={{ color: appTheme.text.primary }}
            />
          </div>
        </div>
      </div>

      {/* Task Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: appTheme.background.white, boxShadow: appTheme.shadow.md }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FaSpinner className="animate-spin" style={{ color: appTheme.primary.main }} size={32} />
          </div>
        ) : paginatedTasks.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <FaCalendarAlt className="mx-auto mb-4" style={{ color: appTheme.text.light }} size={48} />
            <p className="font-medium text-sm sm:text-base" style={{ color: appTheme.text.secondary }}>No tasks found</p>
            <p className="text-xs sm:text-sm mt-2" style={{ color: appTheme.text.tertiary }}>
              {search ? 'Try a different search term' : 'Create your first task to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide -mx-2 sm:mx-0 rounded-lg border border-gray-200" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse" style={{ minWidth: '1400px' }}>
              <thead className="bg-gray-50 border-b" style={{ borderColor: appTheme.border.light }}>
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      STATUS
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[200px]"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center">
                      TITLE
                      <SortIcon field="description" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[150px]"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center">
                      ASSOCIATED CONTACT
                      <SortIcon field="customerName" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[150px]" style={{ color: appTheme.text.secondary }}>
                    ASSOCIATED COMPANY
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: appTheme.text.secondary }}>
                    LAST CONTACT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: appTheme.text.secondary }}>
                    LAST ENGAGEMENT
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center">
                      TASK TYPE
                      <SortIcon field="type" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: appTheme.text.secondary }}
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center">
                      DUE DATE
                      <SortIcon field="dueDate" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky right-0 bg-gray-50 z-10" style={{ color: appTheme.text.secondary }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y" style={{ borderColor: appTheme.border.light }}>
                {paginatedTasks.map((task) => {
                  const statusStyle = getStatusColor(task.status)
                  const StatusIcon = statusStyle.icon
                  return (
                    <tr
                      key={task._id}
                      onClick={() => handleTaskClick(task)}
                      className="hover:bg-blue-50 transition-colors border-b border-gray-100 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap group relative">
                          <StatusIcon className="w-4 h-4" style={{ color: statusStyle.text }} />
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold font-sans transition-all hover:opacity-80 cursor-default"
                            style={{ backgroundColor: statusStyle.bg, color: '#000000' }}
                            title={task.status}
                          >
                            {task.status}
                          </span>
                          {task.hubspotTaskId && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium font-sans bg-green-100 text-black transition-all hover:opacity-80 cursor-default"
                              title="Posted to HubSpot"
                            >
                              ✓ HubSpot
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[200px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskClick(task)
                            }}
                            className="text-left text-sm font-medium hover:underline transition-colors cursor-pointer"
                            style={{ color: '#0066cc' }}
                          >
                            {task.description || `Follow up with ${task.customerName}`}
                          </button>
                          {task.notes && (
                            <p className="text-xs mt-1 text-gray-500 line-clamp-1">
                              {task.notes}
                            </p>
                          )}
                          {task.createdBy && task.createdBy.role === 'admin' && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              📋 Assigned by Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-600">
                              {(task.customerName || task.customerEmail || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: appTheme.text.primary }}>
                              {task.customerName || '—'}
                            </p>
                            {task.customerEmail && (
                              <p className="text-xs text-gray-500 truncate">
                                {task.customerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {task.customer?.company ? (
                            <>
                              <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-gray-600">
                                  {task.customer.company[0].toUpperCase()}
                                </span>
                              </div>
                              <span className="text-sm truncate" style={{ color: appTheme.text.primary }}>
                                {task.customer.company}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">—</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">—</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: appTheme.text.secondary }}>
                          {task.type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: appTheme.text.secondary }}>
                            <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs text-gray-500">{new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTaskClick(task)
                          }}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="View Details"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {sortedTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded text-xs sm:text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium ${currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded text-xs sm:text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <span className="text-xs sm:text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      {/* Create Task Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto min-h-[100dvh]">
          <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-2xl shadow-xl flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0 pb-[env(safe-area-inset-bottom)] sm:pb-0">
            <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b" style={{ backgroundColor: appTheme.primary.main, borderColor: appTheme.border.light }}>
              <h3 className="text-xl font-bold text-white">Create Task</h3>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Section A: Task Information */}
                <div className="border-b pb-6">
                  <h2 className="text-xl font-semibold mb-4" style={{ color: appTheme.text.primary }}>Section A: Task Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Task Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.type}
                        onChange={(e) => {
                          const newType = e.target.value
                          const updates = {
                            ...formData,
                            type: newType,
                            followUpType: newType === 'Follow-up' ? formData.followUpType : 'Call'
                          }
                          if (newType === 'Sample Track') {
                            if (!updates.visitDate) updates.visitDate = getLocalDateString()
                            if (!updates.expectedDate) updates.expectedDate = ''
                          }
                          setFormData(updates)
                        }}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                      >
                        {TASK_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Priority <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                    </div>
                    {/* Follow-up Type - Show only when Follow-up is selected */}
                    {formData.type === 'Follow-up' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Follow-up Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.followUpType}
                          onChange={(e) => setFormData({ ...formData, followUpType: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                          style={{
                            borderColor: appTheme.border.medium,
                            focusRingColor: appTheme.primary.main
                          }}
                        >
                          <option value="Call">Call</option>
                          <option value="Email">Email</option>
                          <option value="Meeting">Meeting</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Visit">Visit</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                    {formData.type !== 'Sample Track' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                            Due Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                            Due Time
                          </label>
                          <input
                            type="time"
                            value={formData.dueTime}
                            onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section B: Customer Details */}
                <div className="border-b pb-6">
                  <h2 className="text-xl font-semibold mb-4" style={{ color: appTheme.text.primary }}>Section B: Customer Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 relative">
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Customer <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerSearch || formData.customerName}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerDropdown(true)
                          if (!e.target.value) {
                            setFormData(prev => ({ ...prev, customer: '', customerName: '', customerEmail: '', customerPhone: '', contactPerson: '', billingAddress: '', deliveryAddress: '' }))
                          }
                        }}
                        onFocus={() => {
                          setShowCustomerDropdown(true)
                          if (!customerSearch && formData.customerName) {
                            setCustomerSearch(formData.customerName)
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowCustomerDropdown(false), 200)
                        }}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Search customers by name, email, or phone..."
                        required
                      />
                      {showCustomerDropdown && filteredCustomers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border-2 rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ borderColor: appTheme.border.medium }}>
                          {filteredCustomers.map(customer => (
                            <div
                              key={customer._id || customer.id}
                              onClick={() => handleCustomerSelect(customer)}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b"
                              style={{ borderColor: appTheme.border.light }}
                            >
                              <p className="font-medium" style={{ color: appTheme.text.primary }}>{customer.name || customer.firstName}</p>
                              <p className="text-sm" style={{ color: appTheme.text.secondary }}>
                                {customer.email && `Email: ${customer.email}`}
                                {customer.phone && ` | Phone: ${customer.phone}`}
                              </p>
                              {customer.address && (
                                <p className="text-xs mt-1" style={{ color: appTheme.text.secondary }}>{customer.address}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Customer Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter customer name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Contact person name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Customer Email
                      </label>
                      <input
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter customer email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Customer Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter customer phone"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Billing Address
                      </label>
                      <textarea
                        value={formData.billingAddress}
                        onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                        rows="3"
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 resize-none"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter billing address"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Delivery Address
                      </label>
                      <textarea
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                        rows="3"
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 resize-none"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter delivery address"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Task Details or Sample Tracker */}
                {formData.type === 'Sample Track' ? (
                  <div>
                    <h2 className="text-xl font-semibold mb-4" style={{ color: appTheme.text.primary }}>Section C: Sample Details</h2>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                            Visit Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.visitDate}
                            onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                            Expected Date
                          </label>
                          <input
                            type="date"
                            value={formData.expectedDate}
                            onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                            Expected Time
                          </label>
                          <input
                            type="time"
                            value={formData.expectedTime || '09:00'}
                            onChange={(e) => setFormData({ ...formData, expectedTime: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          />
                        </div>
                      </div>

                      {/* Add Items Section */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Add Item (one or more products) <span className="text-red-500">*</span>
                        </label>
                        <div
                          className="flex gap-2 mb-2"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addItemToSelection()
                            }
                          }}
                        >
                          <select
                            value={addItemProduct}
                            onChange={(e) => setAddItemProduct(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                          >
                            <option value="">Select product...</option>
                            {products.map((product) => (
                              <option key={product._id} value={product._id}>
                                {product.name} {product.productCode ? `(${product.productCode})` : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={addItemQty}
                            onChange={(e) => setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-3 py-2 border rounded-lg outline-none focus:ring-2"
                            style={{
                              borderColor: appTheme.border.medium,
                              focusRingColor: appTheme.primary.main
                            }}
                            placeholder="Qty"
                          />
                          <button
                            type="button"
                            onClick={addItemToSelection}
                            className="px-4 py-2 rounded-lg font-medium text-white transition-all"
                            style={{ backgroundColor: appTheme.primary.main }}
                            title="Add this product to the list"
                          >
                            <FaPlus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Hint when no items added */}
                        {selectedItems.length === 0 && (
                          <p className="mt-2 text-sm" style={{ color: appTheme.text.secondary }}>
                            Select a product and quantity above, then click <strong>+</strong> or press <strong>Enter</strong> to add. Add at least one item to enable &quot;Create Sample&quot;.
                          </p>
                        )}

                        {/* Selected Items List */}
                        {selectedItems.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                              Added items ({selectedItems.length}) — add more above if needed
                            </p>
                            {selectedItems.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: appTheme.border.medium }}>
                                <div className="flex-1">
                                  <p className="font-medium" style={{ color: appTheme.text.primary }}>{item.productName}</p>
                                  <p className="text-sm" style={{ color: appTheme.text.secondary }}>
                                    {item.productCode && `Code: ${item.productCode} | `}Quantity: {item.quantity}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItemFromSelection(index)}
                                  className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <FaTrash className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Notes
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 resize-none"
                          style={{
                            borderColor: appTheme.border.medium,
                            focusRingColor: appTheme.primary.main
                          }}
                          placeholder="Add any additional notes..."
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-xl font-semibold mb-4" style={{ color: appTheme.text.primary }}>Section C: Task Details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Description
                        </label>
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                          style={{
                            borderColor: appTheme.border.medium,
                            focusRingColor: appTheme.primary.main
                          }}
                          placeholder="e.g., Follow up with sample tracker for salesman"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Notes
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 resize-none"
                          style={{
                            borderColor: appTheme.border.medium,
                            focusRingColor: appTheme.primary.main
                          }}
                          placeholder="Add any additional notes..."
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
              {/* Form Actions – sticky footer so full form + buttons visible on mobile */}
              <div className="flex-shrink-0 flex items-center justify-end gap-2 sm:gap-3 p-3 sm:p-6 border-t-2 border-gray-200 bg-gray-50 rounded-b-lg pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6" style={{ borderColor: appTheme.border.light }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    resetForm()
                  }}
                  className="px-3 py-1.5 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-lg font-medium transition-colors min-h-[36px] sm:min-h-[44px]"
                  style={{
                    color: appTheme.text.secondary,
                    backgroundColor: appTheme.background.lightGray
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (formData.type === 'Sample Track' && selectedItems.length === 0)}
                  className="px-3 py-1.5 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-lg font-medium text-white transition-all disabled:opacity-50 min-h-[36px] sm:min-h-[44px]"
                  style={{ backgroundColor: appTheme.primary.main }}
                  title={formData.type === 'Sample Track' && selectedItems.length === 0 ? 'Add at least one product using the + button above' : ''}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <FaSpinner className="animate-spin" />
                      {formData.type === 'Sample Track' ? 'Creating Sample...' : 'Creating...'}
                    </span>
                  ) : (
                    formData.type === 'Sample Track' ? 'Create Sample' : 'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Tasks from Excel / CSV Modal */}
      {showImportExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Import Tasks from Excel / CSV</h3>
              <button
                type="button"
                onClick={() => { setShowImportExcelModal(false); setImportExcelFile(null); setImportExcelPreview([]) }}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
                aria-label="Close"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <p className="text-sm text-gray-600">Upload a CSV from your device. Tasks will be assigned to you. First row = headers: <strong>customerName</strong>, <strong>dueDate</strong>. Optional: type, description, priority, customerEmail, notes.</p>
              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleTaskExcelFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#e9931c] file:text-white file:font-medium hover:file:bg-[#d8820a]"
                />
              </label>
              {importExcelFile && <p className="text-sm text-gray-600">File: <strong>{importExcelFile.name}</strong></p>}
              {importExcelPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview: {importExcelPreview.length} row(s) to import</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Customer</th>
                          <th className="text-left p-2">Due Date</th>
                          <th className="text-left p-2">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importExcelPreview.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2">{row.customerName || '—'}</td>
                            <td className="p-2">{row.dueDate || '—'}</td>
                            <td className="p-2">{row.type || 'Call'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importExcelPreview.length > 10 && <p className="p-2 text-gray-500 text-sm">... and {importExcelPreview.length - 10} more</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => { setShowImportExcelModal(false); setImportExcelFile(null); setImportExcelPreview([]) }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportTaskExcelSubmit}
                disabled={importExcelLoading || importExcelPreview.length === 0}
                className="px-4 py-2 bg-[#e9931c] text-white rounded-lg font-medium hover:bg-[#d8820a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importExcelLoading ? 'Importing...' : `Import ${importExcelPreview.length > 0 ? `(${importExcelPreview.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail View - HubSpot Style */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Header Bar */}
            <div className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setShowTaskDetail(false)
                    setSelectedTask(null)
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-base md:text-xl xl:text-2xl font-semibold text-gray-900 line-clamp-1">
                    {selectedTask.description || `Follow up with ${selectedTask.customerName}`}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">
                      Task {currentTaskIndex + 1}/{filtered.length}
                    </span>
                    <button
                      onClick={handlePrevTask}
                      disabled={currentTaskIndex === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextTask}
                      disabled={currentTaskIndex === filtered.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <FaChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                {selectedTask.status !== 'Completed' && (
                  <button
                    onClick={() => handleCompleteTask(selectedTask._id)}
                    className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm md:text-base"
                  >
                    Complete
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowTaskDetail(false)
                    setSelectedTask(null)
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Content - Three Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Contact Information */}
              <div className="hidden lg:block w-72 xl:w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
                {(() => {
                  // Prioritize customer details from customer object
                  const displayName = taskCustomerDetails?.name ||
                    taskCustomerDetails?.firstName ||
                    selectedTask.customerName ||
                    ''
                  const displayEmail = taskCustomerDetails?.email ||
                    selectedTask.customerEmail ||
                    ''
                  return displayName || displayEmail ? (
                    <>
                      {/* Contact Card */}
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-2xl font-semibold text-gray-600">
                              {(displayName || displayEmail || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900">{displayName || '—'}</h2>
                            {displayEmail && (
                              <p className="text-sm text-gray-500 mt-1">{displayEmail}</p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setModalActiveTab('activities')
                              // Focus typing pad after a short delay
                              setTimeout(() => {
                                if (noteInputRef.current) {
                                  noteInputRef.current.focus()
                                }
                              }, 100)
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaStickyNote className="w-4 h-4" />
                            Note
                          </button>
                          <button
                            onClick={async () => {
                              const email = taskCustomerDetails?.email ||
                                selectedTask.customerEmail ||
                                ''
                              if (email) {
                                window.location.href = `mailto:${email}`

                                // Save email activity
                                try {
                                  if (selectedTask && selectedTask._id) {
                                    const currentNotes = selectedTask.notes || ''
                                    const activityNote = `[${new Date().toLocaleString('en-GB')}] Email: Sent to ${email}`
                                    const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                    await updateMyFollowUp(selectedTask._id, {
                                      notes: updatedNotes
                                    })

                                    // Add to activities
                                    const newActivity = {
                                      type: 'Email',
                                      content: `Email sent to ${email}`,
                                      date: new Date().toISOString(),
                                      createdAt: new Date().toISOString()
                                    }
                                    setTaskActivities([newActivity, ...taskActivities])

                                    // Reload task
                                    const updatedRes = await getMyFollowUp(selectedTask._id)
                                    if (updatedRes.success) {
                                      setSelectedTask(updatedRes.data)
                                    }

                                    await loadTasks()
                                  }
                                } catch (e) {
                                  console.error('Error saving email activity:', e)
                                }
                              } else {
                                Swal.fire({
                                  icon: 'warning',
                                  title: 'No Email',
                                  text: 'No email address available for this contact',
                                  confirmButtonColor: '#e9931c'
                                })
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaEnvelope className="w-4 h-4" />
                            Email
                          </button>
                          <button
                            onClick={async () => {
                              const phone = taskCustomerDetails?.phone ||
                                selectedTask.customerPhone ||
                                ''
                              if (phone) {
                                // Show options: Call or WhatsApp
                                Swal.fire({
                                  title: 'Choose Action',
                                  showDenyButton: true,
                                  showCancelButton: true,
                                  confirmButtonText: 'Call',
                                  denyButtonText: 'WhatsApp',
                                  cancelButtonText: 'Cancel',
                                  confirmButtonColor: '#e9931c',
                                  denyButtonColor: '#25D366',
                                }).then(async (result) => {
                                  if (result.isConfirmed) {
                                    window.location.href = `tel:${phone}`

                                    // Save call activity
                                    try {
                                      if (selectedTask && selectedTask._id) {
                                        const currentNotes = selectedTask.notes || ''
                                        const activityNote = `[${new Date().toLocaleString('en-GB')}] Call: Called ${phone}`
                                        const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                        await updateMyFollowUp(selectedTask._id, {
                                          notes: updatedNotes
                                        })

                                        const newActivity = {
                                          type: 'Call',
                                          content: `Called ${phone}`,
                                          date: new Date().toISOString(),
                                          createdAt: new Date().toISOString()
                                        }
                                        setTaskActivities([newActivity, ...taskActivities])

                                        const updatedRes = await getMyFollowUp(selectedTask._id)
                                        if (updatedRes.success) {
                                          setSelectedTask(updatedRes.data)
                                        }

                                        await loadTasks()
                                      }
                                    } catch (e) {
                                      console.error('Error saving call activity:', e)
                                    }
                                  } else if (result.isDenied) {
                                    const cleanPhone = phone.replace(/\D/g, '')
                                    window.open(`https://wa.me/${cleanPhone}`, '_blank')

                                    // Save WhatsApp activity
                                    try {
                                      if (selectedTask && selectedTask._id) {
                                        const currentNotes = selectedTask.notes || ''
                                        const activityNote = `[${new Date().toLocaleString('en-GB')}] WhatsApp: Messaged ${phone}`
                                        const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                        await updateMyFollowUp(selectedTask._id, {
                                          notes: updatedNotes
                                        })

                                        const newActivity = {
                                          type: 'WhatsApp',
                                          content: `WhatsApp message to ${phone}`,
                                          date: new Date().toISOString(),
                                          createdAt: new Date().toISOString()
                                        }
                                        setTaskActivities([newActivity, ...taskActivities])

                                        const updatedRes = await getMyFollowUp(selectedTask._id)
                                        if (updatedRes.success) {
                                          setSelectedTask(updatedRes.data)
                                        }

                                        await loadTasks()
                                      }
                                    } catch (e) {
                                      console.error('Error saving WhatsApp activity:', e)
                                    }
                                  }
                                })
                              } else {
                                Swal.fire({
                                  icon: 'warning',
                                  title: 'No Phone',
                                  text: 'No phone number available for this contact',
                                  confirmButtonColor: '#e9931c'
                                })
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaPhone className="w-4 h-4" />
                            Call
                          </button>
                          <button
                            onClick={() => {
                              setModalActiveTab('activities')
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaCalendarAlt className="w-4 h-4" />
                            Task
                          </button>
                          <button
                            onClick={() => {
                              setModalActiveTab('activities')
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaCalendarAlt className="w-4 h-4" />
                            Meeting
                          </button>
                          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <FaEllipsisH className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* About this contact */}
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">About this contact</h3>
                        <div className="space-y-3">
                          {displayEmail && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Email</p>
                              <p className="text-sm text-gray-900">{displayEmail}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.phone || selectedTask.customerPhone) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.phone || selectedTask.customerPhone}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.address || taskCustomerDetails?.city || taskCustomerDetails?.state) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Address</p>
                              <p className="text-sm text-gray-900">
                                {[taskCustomerDetails?.address, taskCustomerDetails?.city, taskCustomerDetails?.state].filter(Boolean).join(', ')}
                              </p>
                            </div>
                          )}
                          {selectedTask.salesman && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Contact owner</p>
                              <p className="text-sm text-gray-900">{selectedTask.salesman.name || selectedTask.salesman.email}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Last Contacted</p>
                            <p className="text-sm text-gray-400">—</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Lead Status</p>
                            <p className="text-sm text-gray-400">—</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null
                })()}
              </div>

              {/* Center Panel - Task Details with Tabs */}
              <div className="flex-1 bg-white overflow-y-auto">
                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setModalActiveTab('overview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'overview'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setModalActiveTab('activities')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'activities'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => setModalActiveTab('contact')}
                      className={`lg:hidden py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'contact'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Contact
                    </button>
                    <button
                      onClick={() => setModalActiveTab('associations')}
                      className={`lg:hidden py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'associations'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Associations
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {modalActiveTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Task Details Section */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Task Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Follow-up Number</p>
                            <p className="text-sm font-medium text-gray-900">{selectedTask.followUpNumber || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Task Type</p>
                            <p className="text-sm font-medium text-gray-900">{selectedTask.type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Priority</p>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {selectedTask.priority || '—'}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Status</p>
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {selectedTask.status || '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dates Section */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dates & Timeline</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Scheduled Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.scheduledDate
                                ? `${new Date(selectedTask.scheduledDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.scheduledDate).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Due Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.dueDate
                                ? `${new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.dueDate).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}`
                                : '—'}
                            </p>
                          </div>
                          {selectedTask.completedDate && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Completed Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {`${new Date(selectedTask.completedDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.completedDate).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}`}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Created Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.createdAt
                                ? `${new Date(selectedTask.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.createdAt).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}`
                                : '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Description & Notes */}
                      {(selectedTask.description || selectedTask.notes) && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Description & Notes</h3>
                          {selectedTask.description && (
                            <div className="mb-4">
                              <p className="text-xs text-gray-500 mb-1">Description</p>
                              <p className="text-sm text-gray-900">{selectedTask.description}</p>
                            </div>
                          )}
                          {selectedTask.notes && (
                            <div>
                              <p className="text-xs text-gray-500 mb-3">Activity History</p>
                              {taskActivities.length > 0 ? (
                                <div className="space-y-3">
                                  {taskActivities.slice(0, 5).map((activity, idx) => (
                                    <div
                                      key={idx}
                                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${activity.type === 'Note' ? 'bg-blue-100 text-blue-800' :
                                              activity.type === 'Email' ? 'bg-green-100 text-green-800' :
                                                activity.type === 'Call' ? 'bg-orange-100 text-orange-800' :
                                                  activity.type === 'WhatsApp' ? 'bg-green-100 text-green-800' :
                                                    activity.type === 'Meeting' ? 'bg-purple-100 text-purple-800' :
                                                      'bg-gray-100 text-gray-800'
                                              }`}>
                                              {activity.type === 'Note' && <FaStickyNote className="w-3 h-3 mr-1" />}
                                              {activity.type === 'Email' && <FaEnvelope className="w-3 h-3 mr-1" />}
                                              {activity.type === 'Call' && <FaPhone className="w-3 h-3 mr-1" />}
                                              {activity.type === 'WhatsApp' && <FaPhone className="w-3 h-3 mr-1" />}
                                              {activity.type === 'Meeting' && <FaVideo className="w-3 h-3 mr-1" />}
                                              {activity.type}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {activity.dateStr} {activity.timeStr}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                            {activity.content}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">No activities recorded yet</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Data Highlights */}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Data highlights</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">CREATE DATE</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.createdAt
                                ? new Date(selectedTask.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) + ' GMT+5'
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">LAST ACTIVITY DATE</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.dueDate || selectedTask.updatedAt
                                ? `${new Date(selectedTask.dueDate || selectedTask.updatedAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.dueDate || selectedTask.updatedAt).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })} GMT+5`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">LIFECYCLE STAGE</p>
                            <p className="text-sm font-medium text-gray-900">Lead</p>
                          </div>
                        </div>
                      </div>

                      {/* Recent Activities */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-gray-900">Recent activities</h3>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                placeholder="Search activities"
                                className="pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <button className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                              Create activities
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={selectedTask.status === 'Completed'}
                              readOnly
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(selectedTask.dueDate || selectedTask.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                </span>
                                <span className="text-sm text-gray-500">›</span>
                                <span className="text-sm text-gray-600">
                                  {selectedTask.status === 'Completed'
                                    ? `Completed ${selectedTask.completedDate ? new Date(selectedTask.completedDate).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }) + ' GMT+5' : ''}`
                                    : `Task assigned to ${selectedTask.salesman?.name || 'Salesman'}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-1 rounded ${selectedTask.status === 'Overdue' ? 'bg-red-100 text-red-700' :
                                  selectedTask.status === 'Today' ? 'bg-yellow-100 text-yellow-700' :
                                    selectedTask.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                      'bg-blue-100 text-blue-700'
                                  }`}>
                                  {selectedTask.status === 'Overdue' ? 'Overdue' : selectedTask.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {selectedTask.status === 'Completed' && selectedTask.completedDate
                                    ? `${new Date(selectedTask.completedDate).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })} GMT+5`
                                    : selectedTask.dueDate
                                      ? new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) + ' GMT+5'
                                      : '—'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 mt-1">
                                {selectedTask.description || `Follow up with ${selectedTask.customerName}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {modalActiveTab === 'activities' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Fixed Header and Typing Box */}
                      <div className="flex-shrink-0 space-y-4 pb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Activities</h3>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                placeholder="Search activities"
                                className="pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Typing Pad */}
                        <div className="pb-4 border-b border-gray-200">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <textarea
                                ref={noteInputRef}
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (noteInput.trim()) {
                                      const noteContent = noteInput.trim()
                                      const newActivity = {
                                        type: 'Note',
                                        content: noteContent,
                                        date: new Date().toISOString(),
                                        createdAt: new Date().toISOString()
                                      }
                                      setTaskActivities([newActivity, ...taskActivities])
                                      setNoteInput('')

                                      // Save to backend
                                      try {
                                        if (selectedTask && selectedTask._id) {
                                          const currentNotes = selectedTask.notes || ''
                                          const activityNote = `[${new Date().toLocaleString('en-GB')}] Note: ${noteContent}`
                                          const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                          await updateMyFollowUp(selectedTask._id, {
                                            notes: updatedNotes
                                          })

                                          // Reload task
                                          const updatedRes = await getMyFollowUp(selectedTask._id)
                                          if (updatedRes.success) {
                                            setSelectedTask(updatedRes.data)
                                          }

                                          await loadTasks()
                                        }
                                      } catch (e) {
                                        console.error('Error saving note:', e)
                                      }
                                    }
                                  }
                                }}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                placeholder="Type a note and press Enter to save..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Scrollable Activities List */}
                      <div className="flex-1 overflow-y-auto space-y-3">
                        {taskActivities.filter(activity => {
                          if (!activitiesSearch.trim()) return true
                          const search = activitiesSearch.toLowerCase()
                          return (
                            activity.type.toLowerCase().includes(search) ||
                            activity.content.toLowerCase().includes(search) ||
                            (activity.dateStr && activity.dateStr.includes(search)) ||
                            (activity.timeStr && activity.timeStr.includes(search))
                          )
                        }).length > 0 ? (
                          taskActivities.filter(activity => {
                            if (!activitiesSearch.trim()) return true
                            const search = activitiesSearch.toLowerCase()
                            return (
                              activity.type.toLowerCase().includes(search) ||
                              activity.content.toLowerCase().includes(search) ||
                              (activity.dateStr && activity.dateStr.includes(search)) ||
                              (activity.timeStr && activity.timeStr.includes(search))
                            )
                          }).map((activity, idx) => (
                            <div
                              key={idx}
                              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${activity.type === 'Note' ? 'bg-blue-100 text-blue-800' :
                                      activity.type === 'Email' ? 'bg-green-100 text-green-800' :
                                        activity.type === 'Call' ? 'bg-orange-100 text-orange-800' :
                                          activity.type === 'WhatsApp' ? 'bg-green-100 text-green-800' :
                                            activity.type === 'Meeting' ? 'bg-purple-100 text-purple-800' :
                                              'bg-gray-100 text-gray-800'
                                      }`}>
                                      {activity.type === 'Note' && <FaStickyNote className="w-3 h-3 mr-1" />}
                                      {activity.type === 'Email' && <FaEnvelope className="w-3 h-3 mr-1" />}
                                      {activity.type === 'Call' && <FaPhone className="w-3 h-3 mr-1" />}
                                      {activity.type === 'WhatsApp' && <FaPhone className="w-3 h-3 mr-1" />}
                                      {activity.type === 'Meeting' && <FaVideo className="w-3 h-3 mr-1" />}
                                      {activity.type}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {activity.dateStr} {activity.timeStr}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {activity.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic text-center py-8">No activities recorded yet</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mobile Mobile Only - Contact Info Tab Content */}
                  {modalActiveTab === 'contact' && (
                    <div className="lg:hidden space-y-6">
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
                        {(() => {
                          const displayName = taskCustomerDetails?.name || taskCustomerDetails?.firstName || selectedTask.customerName || 'Contact'
                          const displayEmail = taskCustomerDetails?.email || selectedTask.customerEmail || ''
                          const phone = taskCustomerDetails?.phone || selectedTask.customerPhone
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
                                  {(displayName || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">{displayName}</p>
                                  <p className="text-sm text-gray-500">{displayEmail || 'No email'}</p>
                                </div>
                              </div>
                              <div className="pt-4 border-t border-gray-100 space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider">Phone Number</p>
                                  <p className="text-sm font-medium">{phone || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider">Address</p>
                                  <p className="text-sm">
                                    {[taskCustomerDetails?.address, taskCustomerDetails?.city, taskCustomerDetails?.state].filter(Boolean).join(', ') || '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Mobile Only - Associations Tab Content */}
                  {modalActiveTab === 'associations' && (
                    <div className="lg:hidden space-y-6">
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Associations</h3>
                        <p className="text-sm text-gray-500 mb-2 font-medium">Companies</p>
                        {selectedTask.customer?.company ? (
                          <div className="p-3 bg-gray-50 rounded border border-gray-100 mb-4 font-medium text-sm">
                            {selectedTask.customer.company}
                          </div>
                        ) : <p className="text-xs text-gray-400 mb-4">No companies associated</p>}

                        <p className="text-sm text-gray-500 mb-2 font-medium">Deals / Quotations ({taskQuotations.length})</p>
                        {taskQuotations.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {taskQuotations.map(q => (
                              <div key={q._id} className="p-2 bg-gray-50 rounded border border-gray-100 text-xs">
                                {q.quotationNumber || 'Quote'} - £{Number(q.total || 0).toFixed(2)}
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-gray-400 mb-4">No quotations associated</p>}

                        <p className="text-sm text-gray-500 mb-2 font-medium">Tickets</p>
                        <p className="text-xs text-gray-400">No tickets associated</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Right Panel - Associated Companies */}
              <div className="hidden lg:block w-72 xl:w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Companies ({selectedTask.customer?.company ? 1 : 0})
                    </h3>
                  </div>
                  {selectedTask.customer?.company ? (
                    <div className="space-y-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-semibold text-gray-600">
                              {selectedTask.customer.company[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {selectedTask.customer.company}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Primary</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Company Domain Name</p>
                            <p className="text-gray-900">—</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                            <p className="text-gray-900">—</p>
                          </div>
                        </div>
                        <button className="mt-3 text-xs text-blue-600 hover:underline">
                          Add association label
                        </button>
                      </div>
                      <button className="text-sm text-blue-600 hover:underline">
                        View all associated Companies
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No companies associated</p>
                  )}

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Deals / Quotations ({taskQuotations.length})</h3>
                    {taskQuotations.length > 0 ? (
                      <div className="space-y-3">
                        {taskQuotations.map((quotation) => (
                          <div
                            key={quotation.id || quotation._id}
                            className="p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <FaFileAlt className="w-4 h-4 text-[#e9931c]" />
                                {quotation.quotationNumber || quotation.quoteNumber || `Quote #${(quotation.id || quotation._id)?.toString().slice(-6) || '—'}`}
                              </span>
                              <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800">
                                {quotation.status || 'Pending'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <p>Total: £{Number(quotation.total || 0).toFixed(2)}</p>
                              {quotation.validUntil && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Valid until: {new Date(quotation.validUntil).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No quotations associated with this contact</p>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Tickets (0)</h3>
                    <p className="text-sm text-gray-500">No tickets associated</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportExcelModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Import Tasks from CSV</h3>
              <button
                onClick={() => {
                  setShowImportExcelModal(false)
                  setImportExcelFile(null)
                  setImportExcelPreview([])
                }}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer group">
                    <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center group-hover:border-[#e9931c] group-hover:bg-orange-50 transition-colors">
                      <FaFileExcel className="w-8 h-8 text-green-600 mb-2" />
                      <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">
                        {importExcelFile ? importExcelFile.name : 'Click to upload CSV'}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">supports .csv</span>
                    </div>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleTaskExcelFileSelect}
                      className="hidden"
                    />
                  </label>
                  {importExcelFile && (
                    <button
                      onClick={() => {
                        setImportExcelFile(null)
                        setImportExcelPreview([])
                      }}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                      title="Remove file"
                    >
                      <FaTrash className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="font-semibold mb-1">Required Columns:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>customerName</strong> (Exact name as in system)</li>
                    <li><strong>dueDate</strong> (Format: YYYY-MM-DD or DD/MM/YYYY)</li>
                  </ul>
                  <p className="font-semibold mt-2 mb-1">Optional Columns:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>type</strong> (Call, Email, Meeting, Visit, etc.)</li>
                    <li><strong>priority</strong> (Low, Medium, High, Urgent)</li>
                    <li><strong>description</strong> (Task title)</li>
                    <li><strong>notes</strong> (Additional details)</li>
                    <li><strong>customerEmail</strong> (To help match customer)</li>
                  </ul>
                </div>
              </div>

              {importExcelPreview.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Preview ({importExcelPreview.length} rows)</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {importExcelPreview.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-xs text-gray-900 font-medium truncate max-w-[150px]">{row.customerName}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{row.type || '—'}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{row.dueDate}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[200px]">{row.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => {
                  setShowImportExcelModal(false)
                  setImportExcelFile(null)
                  setImportExcelPreview([])
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
                disabled={importExcelLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleImportTaskExcelSubmit}
                disabled={!importExcelPreview.length || importExcelLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-colors"
              >
                {importExcelLoading ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaFileExcel className="w-4 h-4" />}
                {importExcelLoading ? 'Importing...' : `Import ${importExcelPreview.length} Tasks`}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default Tasks
