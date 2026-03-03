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
  FaChevronLeft,
  FaSync,
  FaCloudUploadAlt,
  FaChevronUp,
  FaChevronDown,
  FaFilter,
  FaBuilding,
  FaBriefcase,
  FaFileAlt,
  FaHistory,
  FaStickyNote,
  FaChevronRight,
  FaEllipsisH,
  FaFlask,
  FaShoppingCart,
  FaMapMarkerAlt,
  FaFileExcel
} from 'react-icons/fa'
import { getFollowUps, getFollowUp, createFollowUp, updateFollowUp, deleteFollowUp, approveFollowUp, rejectFollowUp, pushToHubSpot, importFollowUps } from '../../services/adminservices/followUpService'
import { getTasksList } from '../../services/adminservices/tasksListService'
import { getUsers } from '../../services/adminservices/userService'
import { getCustomers, getCustomer } from '../../services/adminservices/customerService'
import { getQuotations, getQuotation } from '../../services/adminservices/quotationService'
import { importHubSpotTasksToDb } from '../../services/adminservices/hubspotService'
import { getVisitTargets, getVisitTarget, createVisitTarget, updateVisitTarget, deleteVisitTarget } from '../../services/adminservices/visitTargetService'
import { getSalesTargets } from '../../services/adminservices/salesTargetService'
import { getSamples, createSample } from '../../services/adminservices/sampleService'
import { getProducts } from '../../services/adminservices/productService'
import appTheme from '../../apptheme/apptheme'
import Swal from 'sweetalert2'

// Local date YYYY-MM-DD (avoids UTC shifting)
const getLocalDateString = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Format date for activity notes so regex [DD/MM/YYYY, HH:MM:SS] always matches
const formatActivityDateTime = (d) => {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year}, ${h}:${min}:${sec}`
}

// Parse notes string into activities (supports Meeting with link + meetLink)
const parseNotesToActivities = (notesStr) => {
  if (!notesStr || typeof notesStr !== 'string') return []
  const notesLines = notesStr.split('\n').filter(line => line.trim())
  const parsed = []
  const regex = /\[(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(\w+):\s*(.+)/
  notesLines.forEach(line => {
    const match = line.match(regex)
    if (!match) return
    const [, dateStr, timeStr, type, content] = match
    const [d, m, y] = dateStr.split('/')
    const datePart = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const timePart = timeStr.includes(':') && timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr
    const dateTime = new Date(`${datePart}T${timePart}`)
    if (isNaN(dateTime.getTime())) return
    if (type === 'Meeting' && content.includes('http')) {
      const linkMatch = content.match(/(https?:\/\/[^\s|]+)/)
      const meetMatch = content.match(/Google Meet:\s*(https?:\/\/[^\s]+)/)
      const link = linkMatch ? linkMatch[1] : ''
      const meetLink = meetMatch ? meetMatch[1].trim() : ''
      const meetingTitle = content.replace(/(https?:\/\/[^\s]+)/g, '').replace(/Google Meet:\s*/i, '').replace(/\|/g, '').trim().replace(/^-\s*/, '') || 'Meeting'
      parsed.push({
        type: 'Meeting',
        content: meetingTitle,
        link: link || undefined,
        meetLink: meetLink || undefined,
        date: dateTime.toISOString(),
        createdAt: dateTime.toISOString()
      })
    } else {
      parsed.push({ type: type, content: content, date: dateTime.toISOString(), createdAt: dateTime.toISOString() })
    }
  })
  parsed.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
  return parsed
}

// Geocode customer address (Nominatim) – so visit target gets correct lat/lng per customer, not same default
const geocodeCustomerAddress = async (customer) => {
  if (!customer) return null
  const trim = (s) => (s != null && typeof s === 'string' ? s.trim() : '')
  const addressPart = trim(customer.address)
  const cityPart = trim(customer.city) || trim(customer.state)
  const pincodePart = trim(customer.pincode) || trim(customer.postcode)
  const parts = [addressPart, cityPart, pincodePart].filter(Boolean)
  if (parts.length === 0) return null
  const query = parts.join(', ') + ', Pakistan'
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { Accept: 'application/json', 'User-Agent': 'PracoSupplies/1.0' } }
    )
    const data = await res.json()
    if (Array.isArray(data) && data[0]?.lat != null && data[0]?.lon != null) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (e) {
    console.warn('Geocode failed for customer:', e)
  }
  return null
}

const TABS = [
  { id: 'All', label: 'All Tasks' },
  { id: 'HubSpotImported', label: 'HubSpot Imported' },
  { id: 'PushedToHubSpot', label: 'Pushed to HubSpot' },
  { id: 'NotPushed', label: 'Not Pushed' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Today', label: 'Due today' },
  { id: 'Upcoming', label: 'Upcoming' },
  { id: 'Completed', label: 'Completed' },
]

// Task types - Visit Target, Follow-up, Sample Track (linked to Sample Tracker)
const TASK_TYPES = ['Visit Target', 'Follow-up', 'Sample Track']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

// Map backend task type to display label. Only show "Visit Target" for actual visit target tasks; follow-ups with type Visit show as "Visit".
const getTaskTypeLabel = (type, isVisitTarget = false) => {
  if (!type) return '—'
  const t = String(type).trim()
  if (t === 'Visit' || t.toLowerCase() === 'visit') return isVisitTarget ? 'Visit Target' : 'Visit'
  return t
}

const Tasks = () => {
  const [tasks, setTasks] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [modalActiveTab, setModalActiveTab] = useState('overview')
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [pushingToHubSpot, setPushingToHubSpot] = useState(false)
  const [sortField, setSortField] = useState('dueDate')
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedRows, setSelectedRows] = useState([])
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false)
  const [showDueDateDropdown, setShowDueDateDropdown] = useState(false)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)
  const [showSalesmanDropdown, setShowSalesmanDropdown] = useState(false)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)
  const [filterSearch, setFilterSearch] = useState({
    taskType: '',
    priority: '',
    salesman: '',
    dueDate: '',
    time: ''
  })
  const [activeFilters, setActiveFilters] = useState({
    taskType: [],
    priority: [],
    salesman: [],
    dueDateRange: null,
    timeRange: null,
    myCreationOnly: false
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [taskCustomerDetails, setTaskCustomerDetails] = useState(null) // Full customer details for selected task
  const [taskQuotations, setTaskQuotations] = useState([]) // Quotations for selected task
  const [taskActivities, setTaskActivities] = useState([]) // Activities/notes for selected task
  const [relatedTasks, setRelatedTasks] = useState([]) // Related tasks for same email/user
  const [hubspotDeals, setHubspotDeals] = useState([]) // HubSpot deals for selected task
  const [salesTargets, setSalesTargets] = useState([]) // Sales targets for selected task
  const [showNoteModal, setShowNoteModal] = useState(false) // Show note creation modal
  const [showMeetingModal, setShowMeetingModal] = useState(false) // Show meeting creation modal
  const [showImportExcelModal, setShowImportExcelModal] = useState(false) // Import tasks from CSV
  const [importExcelFile, setImportExcelFile] = useState(null)
  const [importExcelPreview, setImportExcelPreview] = useState([])
  const [importExcelLoading, setImportExcelLoading] = useState(false)
  const [showStartTaskModal, setShowStartTaskModal] = useState(false) // Show start task modal
  const [taskToStart, setTaskToStart] = useState(null) // Task to start
  const [meterPicture, setMeterPicture] = useState(null) // Meter picture for starting task
  const [meterReading, setMeterReading] = useState('') // Meter reading value
  const [noteInput, setNoteInput] = useState('') // Input for quick note typing
  const noteInputRef = useRef(null) // Ref for note input field
  const [activitiesSearch, setActivitiesSearch] = useState('') // Search filter for activities

  const [formData, setFormData] = useState({
    salesman: '',
    customer: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    associatedContactName: '',
    associatedContactEmail: '',
    associatedCompanyName: '',
    associatedCompanyDomain: '',
    type: 'Visit Target',
    followUpType: 'Call', // Follow-up type (Call, Email, Meeting, etc.)
    relatedSample: '', // Sample Track: link to Sample Tracker
    priority: 'Medium',
    dueDate: '',
    dueTime: '09:00',
    description: '',
    notes: '',
  })
  const [samples, setSamples] = useState([]) // For Sample Track dropdown in Create Task
  const [products, setProducts] = useState([]) // Products for Sample Track Add Item
  const [selectedItems, setSelectedItems] = useState([]) // Selected products for Sample Track
  const [addItemProduct, setAddItemProduct] = useState('')
  const [addItemQty, setAddItemQty] = useState(1)
  const [sampleVisitDate, setSampleVisitDate] = useState(getLocalDateString()) // Visit date for sample
  const [sampleExpectedDate, setSampleExpectedDate] = useState('') // Expected date for sample

  const taskHeaderToField = (header) => {
    if (!header || typeof header !== 'string') return null
    const key = header.trim().toLowerCase().replace(/\s+/g, ' ')
    const map = {
      customername: 'customerName', 'customer name': 'customerName', customer_name: 'customerName',
      salesmanemail: 'salesmanEmail', 'salesman email': 'salesmanEmail', salesman_email: 'salesmanEmail',
      salesmanid: 'salesmanId', 'salesman id': 'salesmanId', salesman_id: 'salesmanId',
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
      if (obj.customerName && (obj.salesmanEmail || obj.salesmanId) && obj.dueDate) preview.push(obj)
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
        text: 'No valid rows. Use headers: customerName, salesmanEmail (or salesmanId), dueDate. Optional: type, description, priority, customerEmail, notes.',
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

  const filtered = useMemo(() => {
    let list = [...tasks] // Create a copy to avoid mutating original

    // My creation only: show only tasks created by current admin
    if (activeFilters.myCreationOnly) {
      const currentUserId = localStorage.getItem('userId')
      if (currentUserId) {
        list = list.filter((t) => {
          const createdById = t.createdBy?._id || t.createdBy || t.createdBy?.id
          return createdById && String(createdById) === String(currentUserId)
        })
      }
    }

    // Apply search filter first (before other filters) for better performance
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      // Helper function to safely convert to string and search
      const safeSearch = (value) => {
        if (value === null || value === undefined) return ''
        return String(value).toLowerCase()
      }

      list = list.filter((t) => {
        return (
          safeSearch(t.description).includes(s) ||
          safeSearch(t.customerName).includes(s) ||
          safeSearch(t.customerEmail).includes(s) ||
          safeSearch(t.customerPhone).includes(s) ||
          safeSearch(t.followUpNumber).includes(s) ||
          safeSearch(t.salesman?.name).includes(s) ||
          safeSearch(t.salesman?.email).includes(s) ||
          safeSearch(t.hubspot_owner_name).includes(s) ||
          safeSearch(t.hubspot_owner_email).includes(s) ||
          safeSearch(t.createdBy?.name).includes(s) ||
          safeSearch(t.createdBy?.email).includes(s) ||
          safeSearch(t.type).includes(s) ||
          safeSearch(t.hs_task_type).includes(s) ||
          safeSearch(t.status).includes(s) ||
          safeSearch(t.priority).includes(s) ||
          safeSearch(t.hs_task_priority).includes(s) ||
          safeSearch(t.notes).includes(s) ||
          safeSearch(t.hs_task_body).includes(s) ||
          safeSearch(t.hs_task_queue).includes(s) ||
          safeSearch(t.hs_task_reminder).includes(s) ||
          safeSearch(t.customer?.company).includes(s) ||
          safeSearch(t.customer?.name).includes(s) ||
          safeSearch(t.associatedCompanyName).includes(s) ||
          safeSearch(t.associatedCompanyDomain).includes(s) ||
          safeSearch(t.associatedContactName).includes(s) ||
          safeSearch(t.associatedContactEmail).includes(s) ||
          safeSearch(t.hs_task_subject).includes(s) ||
          safeSearch(t._id).includes(s)
        )
      })
    }

    // Filter by source/status tabs (only if no search is active, or apply after search)
    if (activeTab === 'AppCreated') {
      // Tasks created in app by admin or salesman (not imported from HubSpot)
      list = list.filter((t) => {
        const createdBy = t.createdBy?._id || t.createdBy
        const createdByRole = t.createdBy?.role
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null

        const description = (t.description || '').toLowerCase()
        const customerName = (t.customerName || '').toLowerCase()

        const matchesImportPattern = description.includes('hubspot task') ||
          description.match(/^hubspot task \d+$/) ||
          customerName === 'hubspot contact'

        const isImported = hasHubSpotId && matchesImportPattern

        return createdBy &&
          (createdByRole === 'admin' || createdByRole === 'salesman' || !createdByRole) &&
          !isImported
      })
    } else if (activeTab === 'HubSpotImported') {
      list = list.filter((t) => t.source === 'hubspot')
    } else if (activeTab === 'PushedToHubSpot') {
      list = list.filter((t) => {
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null
        return hasHubSpotId
      })
    } else if (activeTab === 'NotPushed') {
      list = list.filter((t) => {
        const noHubSpotId = !t.hubspotTaskId || t.hubspotTaskId === '' || t.hubspotTaskId === null
        return noHubSpotId
      })
    } else if (activeTab !== 'All') {
      // Status-based filters (Overdue, Today, Upcoming, Completed) – case-insensitive match
      const tabLower = (activeTab || '').toString().toLowerCase()
      list = list.filter((t) => (t.status || '').toString().toLowerCase() === tabLower)
    }
    // Remove duplicate tasks for same customer - keep only one task per customer
    {
      const uniqueTasks = []
      const seenCustomers = new Set()

      list.forEach(task => {
        // Visit requests: har ek alag row (dedupe mat karo)
        if (task.isVisitTarget || task.visitTargetId) {
          uniqueTasks.push(task)
          return
        }
        // Create a unique key for this task based on customer
        const customerId = task.customer ? (typeof task.customer === 'object' ? task.customer._id : task.customer) : null
        const taskEmail = task.customerEmail ||
          (task.customer && typeof task.customer === 'object' ? task.customer.email : '') ||
          task.associatedContactEmail
        const taskName = task.customerName ||
          (task.customer && typeof task.customer === 'object' ? (task.customer.name || task.customer.firstName) : '') ||
          task.associatedContactName

        // Create unique identifier
        const uniqueKey = customerId ? `customer_${customerId}` :
          taskEmail ? `email_${taskEmail.toLowerCase().trim()}` :
            taskName ? `name_${taskName.toLowerCase().trim()}` :
              `task_${task._id}`

        // Only add if we haven't seen this customer before
        // Keep the most recent task (by dueDate or createdAt)
        if (!seenCustomers.has(uniqueKey)) {
          seenCustomers.add(uniqueKey)
          uniqueTasks.push(task)
        } else {
          // If we've seen this customer, check if current task is more recent
          const existingIndex = uniqueTasks.findIndex(t => {
            const tCustomerId = t.customer ? (typeof t.customer === 'object' ? t.customer._id : t.customer) : null
            const tEmail = t.customerEmail ||
              (t.customer && typeof t.customer === 'object' ? t.customer.email : '') ||
              t.associatedContactEmail
            const tName = t.customerName ||
              (t.customer && typeof t.customer === 'object' ? (t.customer.name || t.customer.firstName) : '') ||
              t.associatedContactName

            const tUniqueKey = tCustomerId ? `customer_${tCustomerId}` :
              tEmail ? `email_${tEmail.toLowerCase().trim()}` :
                tName ? `name_${tName.toLowerCase().trim()}` :
                  `task_${t._id}`

            return tUniqueKey === uniqueKey
          })

          if (existingIndex !== -1) {
            const existingTask = uniqueTasks[existingIndex]
            const taskDate = new Date(task.dueDate || task.createdAt || 0).getTime()
            const existingDate = new Date(existingTask.dueDate || existingTask.createdAt || 0).getTime()
            if (taskDate > existingDate) {
              uniqueTasks[existingIndex] = task
            }
          }
        }
      })

      list = uniqueTasks
    }

    // Apply active filters
    if (activeFilters.taskType.length > 0) {
      list = list.filter(t => {
        // Visit requests: type Visit / Visit Target
        if (t.isVisitTarget || t.visitTargetId) {
          return activeFilters.taskType.some(filterType => {
            const f = (filterType || '').toLowerCase().trim()
            return f === 'visit target' || f === 'visit' || f.includes('visit')
          })
        }
        // Prioritize HubSpot type (hs_task_type) over mapped type (type)
        const taskType = (t.hs_task_type || t.type || '').toString().trim()
        if (!taskType) return false

        // Check if the task type matches any of the selected filters (case-insensitive)
        return activeFilters.taskType.some(filterType => {
          const filterLower = filterType.toLowerCase().trim()
          const taskTypeLower = taskType.toLowerCase().trim()

          // Direct match (case-insensitive)
          if (taskTypeLower === filterLower) return true

          // Handle HubSpot type mappings and variations
          if (filterLower === 'call') {
            return taskTypeLower === 'call' || taskTypeLower === 'todo' || taskTypeLower.includes('call')
          }
          if (filterLower === 'email') {
            return taskTypeLower === 'email' || taskTypeLower.includes('email')
          }
          if (filterLower === 'visit' || filterLower === 'visit target') {
            return taskTypeLower === 'visit' || taskTypeLower === 'visit target' || taskTypeLower === 'meeting' || taskTypeLower.includes('visit') || taskTypeLower.includes('meeting')
          }
          if (filterLower === 'follow-up' || filterLower === 'follow up') {
            return taskTypeLower === 'call' || taskTypeLower.includes('follow') || taskTypeLower.includes('call')
          }
          if (filterLower === 'sample feedback' || filterLower === 'sample track' || filterLower === 'sample') {
            return taskTypeLower.includes('sample')
          }
          if (filterLower === 'order check') {
            return taskTypeLower.includes('order')
          }
          if (filterLower === 'todo') {
            return taskTypeLower === 'todo' || taskTypeLower === 'call' || taskTypeLower.includes('todo')
          }

          return false
        })
      })
    }
    if (activeFilters.priority.length > 0) {
      list = list.filter(t => {
        const taskPriority = t.priority || ''
        return activeFilters.priority.some(filterPriority => {
          const filterLower = filterPriority.toLowerCase()
          const taskPriorityLower = taskPriority.toLowerCase()
          return taskPriorityLower === filterLower ||
            (filterPriority === 'High' && (taskPriorityLower === 'high' || taskPriorityLower === 'urgent')) ||
            (filterPriority === 'Urgent' && taskPriorityLower === 'urgent')
        })
      })
    }
    if (activeFilters.salesman.length > 0) {
      list = list.filter(t => {
        // Check salesman ID
        const salesmanId = t.salesman?._id?.toString() || t.salesman?.toString()
        if (activeFilters.salesman.includes(salesmanId)) return true

        // Also check HubSpot owner name and email for imported tasks
        const hubspotOwnerName = (t.hubspot_owner_name || '').toLowerCase().trim()
        const hubspotOwnerEmail = (t.hubspot_owner_email || '').toLowerCase().trim()

        // Check if any selected salesman matches HubSpot owner
        return activeFilters.salesman.some(selectedId => {
          const selectedSalesman = salesmen.find(s => (s._id || s.id).toString() === selectedId)
          if (!selectedSalesman) return false

          const salesmanName = (selectedSalesman.name || '').toLowerCase().trim()
          const salesmanEmail = (selectedSalesman.email || '').toLowerCase().trim()

          // Match by name or email
          return (hubspotOwnerName && salesmanName && hubspotOwnerName === salesmanName) ||
            (hubspotOwnerEmail && salesmanEmail && hubspotOwnerEmail === salesmanEmail) ||
            (hubspotOwnerName && salesmanEmail && hubspotOwnerName.includes(salesmanEmail.split('@')[0])) ||
            (hubspotOwnerEmail && salesmanName && hubspotOwnerEmail.includes(salesmanName.toLowerCase().replace(/\s+/g, '.')))
        })
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
    // Time filter (filter by time of day)
    if (activeFilters.timeRange) {
      list = list.filter(t => {
        if (!t.dueDate) return false
        const dueDate = new Date(t.dueDate)
        const hours = dueDate.getHours()

        switch (activeFilters.timeRange) {
          case 'morning':
            // 6:00 AM - 12:00 PM (6-11)
            return hours >= 6 && hours < 12
          case 'afternoon':
            // 12:00 PM - 6:00 PM (12-17)
            return hours >= 12 && hours < 18
          case 'evening':
            // 6:00 PM - 12:00 AM (18-23)
            return hours >= 18 && hours < 24
          case 'night':
            // 12:00 AM - 6:00 AM (0-5)
            return hours >= 0 && hours < 6
          default:
            return true
        }
      })
    }
    return list
  }, [tasks, search, activeTab, activeFilters])

  // Reset to page 1 when tab or filters change so list shows first page of filtered results
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, activeFilters, search])

  // Load tasks first so list appears fast; salesmen + customers load in background for dropdowns.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        await loadTasks()
        if (cancelled) return
        setLoading(false)
        // Load dropdowns in background – don't block the list
        loadSalesmen().catch(() => { })
        loadCustomers().catch(() => { })
      } catch (e) {
        if (!cancelled) setLoading(false)
      }
    }
    run()

    const intervalId = setInterval(() => loadTasks(), 30000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [activeTab])

  // Load products when Create Task form opens (for Sample Track Add Item)
  useEffect(() => {
    if (!showCreateForm) return
    const loadProducts = async () => {
      try {
        const res = await getProducts({})
        if (res.success && Array.isArray(res.data)) {
          setProducts(res.data.filter(p => p.isActive !== false))
        } else {
          setProducts([])
        }
      } catch (error) {
        console.error('Error loading products:', error)
        setProducts([])
      }
    }
    loadProducts()
  }, [showCreateForm])


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTaskTypeDropdown(false)
        setShowDueDateDropdown(false)
        setShowPriorityDropdown(false)
        setShowSalesmanDropdown(false)
        setShowTimeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const loadTasks = async (tabOverride) => {
    try {
      const tab = tabOverride !== undefined ? tabOverride : activeTab
      const opts = { limit: 200 }
      const res = await getTasksList(opts)
      const followUpsData = res.success && res.data ? res.data : {}
      let followUpTasks = Array.isArray(followUpsData.followUps) ? followUpsData.followUps : []
      const visitTargetsRaw = Array.isArray(followUpsData.visitTargets) ? followUpsData.visitTargets : []

      // Visit Target aur Follow-up alag: jo Follow-up type "Visit" hai aur visitTarget se linked hai,
      // wo already Visit Target list mein dikhega – isliye duplicate na aaye, aise follow-ups ko hatao
      const isVisitTypeFollowUp = (t) => {
        const type = (t.type || '').toString().trim()
        const isVisit = type === 'Visit' || type.toLowerCase() === 'visit' || type === 'Visit Target'
        const hasLinkedVisitTarget = t.visitTarget != null && (t.visitTarget?._id || t.visitTarget)
        return isVisit && hasLinkedVisitTarget
      }
      followUpTasks = followUpTasks.filter((t) => !isVisitTypeFollowUp(t))

      // Request visits (visit targets) ko task shape mein map karo taake list mein dikhen
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)

      const visitTargetsAsTasks = visitTargetsRaw.map((vt) => {
        const visitDate = vt.visitDate ? new Date(vt.visitDate) : null
        let status = vt.status || 'Pending'
        if (status === 'Pending' && visitDate) {
          if (visitDate < todayStart) status = 'Overdue'
          else if (visitDate >= todayStart && visitDate < todayEnd) status = 'Today'
          else status = 'Upcoming'
        }
        const rawDesc = (vt.description || vt.notes || '').trim()
        const salesmanName = vt.salesman?.name || vt.salesman?.email || ''
        const fallbackDesc = salesmanName ? `Visit Assigned: ${salesmanName}` : `Visit: ${vt.name || vt.customerName || 'Customer'}`
        const description = rawDesc && rawDesc.toLowerCase() !== 'test' ? rawDesc : fallbackDesc
        return {
          _id: vt._id,
          id: vt._id,
          isVisitTarget: true,
          visitTargetId: vt._id,
          customerName: vt.name || vt.customerName || 'Visit Request',
          description,
          dueDate: vt.visitDate || vt.createdAt,
          visitDate: vt.visitDate,
          approvalStatus: vt.approvalStatus || 'Pending',
          status,
          type: 'Visit',
          salesman: vt.salesman,
          createdBy: vt.createdBy,
          createdAt: vt.createdAt,
          address: vt.address,
          city: vt.city,
          state: vt.state,
          pincode: vt.pincode,
          priority: vt.priority || 'Medium',
          visitTarget: vt.name
        }
      })

      const combined = [...followUpTasks, ...visitTargetsAsTasks]
      const seenIds = new Set()
      const allTasks = combined.filter((t) => {
        const id = (t._id || t.id)?.toString()
        if (!id || seenIds.has(id)) return false
        seenIds.add(id)
        return true
      })

      setTasks(allTasks)
    } catch (e) {
      console.error(e)
      setTasks([])
    }
  }

  const loadSalesmen = async () => {
    try {
      const res = await getUsers({ role: 'salesman' })
      let list = res.success ? (res.data || []) : []
      const userRole = localStorage.getItem('userRole') || ''
      const userId = localStorage.getItem('userId')
      if (userRole === 'admin' && userId) {
        const alreadyInList = list.some(s => (s._id || s.id).toString() === userId.toString())
        if (!alreadyInList) {
          const userName = localStorage.getItem('userName') || 'Me (Admin)'
          const userEmail = localStorage.getItem('userEmail') || ''
          list = [{ _id: userId, id: userId, name: userName, email: userEmail }, ...list]
        }
      }
      setSalesmen(list)
    } catch (e) {
      console.error(e)
    }
  }

  const loadCustomers = async () => {
    try {
      // Load all customers from database (both app-created and HubSpot-imported)
      const res = await getCustomers()
      const allCustomers = res.success ? (res.data || []) : []

      // Show both app-created and HubSpot-imported customers in dropdown
      // Mark customers and ensure name field exists for display
      const markedCustomers = allCustomers.map(c => ({
        ...c,
        isHubSpot: (c.source || '').toLowerCase() === 'hubspot',
        // Ensure name field exists for display
        name: c.name || c.firstName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Customer'
      }))

      setCustomers(markedCustomers)
    } catch (e) {
      console.error(e)
      setCustomers([])
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!formData.salesman) {
        Swal.fire({
          icon: 'warning',
          title: 'Salesman Required',
          text: 'Please select a salesman',
          confirmButtonColor: '#e9931c'
        })
        return
      }

      // Combine date and time for dueDate
      const dueDateTime = formData.dueDate && formData.dueTime
        ? new Date(`${formData.dueDate}T${formData.dueTime}`)
        : new Date()

      // Map task type to valid backend enum values
      const mapTaskType = (type) => {
        const typeLower = (type || '').toLowerCase().trim()
        if (typeLower === 'visit target' || typeLower.includes('visit')) return 'Visit'
        if (typeLower === 'sample track' || typeLower.includes('sample')) return 'Sample Feedback'
        if (typeLower === 'follow-up' || typeLower === 'follow up' || typeLower.includes('follow')) return 'Call'
        return 'Call'
      }

      // Get current user role to set approval status
      const currentUserRole = localStorage.getItem('userRole') || 'admin'
      // Admin-created tasks are auto-approved, salesman-created need approval
      const approvalStatus = currentUserRole === 'admin' ? 'Approved' : 'Pending'
      const selectedCustomerForTask = formData.customer ? customers.find(c => c._id === formData.customer) : null

      const taskTypeLower = (formData.type || '').toLowerCase().trim()
      const isVisitTargetType = taskTypeLower === 'visit target' || taskTypeLower.includes('visit target')

      // Visit Target and Follow-up are separate: Visit Target = only create Visit Target (no Follow-up)
      if (isVisitTargetType) {
        try {
          const selectedCustomer = customers.find(c => c._id === formData.customer)
          // Location: pehle DB se (customer.latitude/longitude), warna address se geocode. Default nahi – location na mile to alert.
          let latitude, longitude
          const hasCustomerLatLng = selectedCustomer?.latitude != null && selectedCustomer?.longitude != null &&
            !isNaN(parseFloat(selectedCustomer.latitude)) && !isNaN(parseFloat(selectedCustomer.longitude))
          if (hasCustomerLatLng) {
            latitude = parseFloat(selectedCustomer.latitude)
            longitude = parseFloat(selectedCustomer.longitude)
          } else if (selectedCustomer && (selectedCustomer.address || selectedCustomer.city || selectedCustomer.pincode || selectedCustomer.postcode)) {
            const coords = await geocodeCustomerAddress(selectedCustomer)
            if (coords) {
              latitude = coords.lat
              longitude = coords.lng
            } else {
              setSubmitting(false)
              await Swal.fire({
                icon: 'warning',
                title: 'Location not found',
                text: 'Could not get location for this customer. Add latitude/longitude in Customer Management or ensure address/city/pincode is correct.',
                confirmButtonColor: '#e9931c'
              })
              return
            }
          } else {
            setSubmitting(false)
            await Swal.fire({
              icon: 'warning',
              title: 'Location not found',
              text: selectedCustomer ? 'This customer has no location in database and no address to geocode. Add location in Customer Management or fill address/city/pincode.' : 'Select a customer and ensure they have location (lat/lng) or address to geocode.',
              confirmButtonColor: '#e9931c'
            })
            return
          }
          const descInput = (formData.description || '').trim()
          const selectedSalesman = formData.salesman ? salesmen.find(s => (s._id || s.id) === formData.salesman) : null
          const defaultDesc = selectedSalesman ? `Visit Assigned: ${selectedSalesman.name || selectedSalesman.email || 'Salesman'}` : `Visit for ${formData.customerName || 'customer'}`
          const visitTargetData = {
            name: formData.customerName || formData.description || 'Visit Task',
            description: descInput && descInput.toLowerCase() !== 'test' ? formData.description : defaultDesc,
            salesman: formData.salesman,
            priority: formData.priority || 'Medium',
            visitDate: formData.dueDate ? new Date(`${formData.dueDate}T${formData.dueTime || '09:00'}`).toISOString() : undefined,
            notes: formData.notes || '',
            status: 'Pending',
            approvalStatus: 'Approved',
            customerName: formData.customerName || '',
            customerId: formData.customer || undefined,
            address: selectedCustomer?.address || formData.address || '',
            city: selectedCustomer?.city || formData.city || '',
            state: selectedCustomer?.state || formData.state || '',
            pincode: selectedCustomer?.postcode || selectedCustomer?.pincode || formData.pincode || '',
            latitude,
            longitude,
          }
          const visitTargetRes = await createVisitTarget(visitTargetData)
          if (visitTargetRes.success) {
            Swal.fire({
              icon: 'success',
              title: 'Visit Target Created!',
              text: 'Visit Target created. View it in the Visit Targets page.',
              confirmButtonColor: '#e9931c'
            })
            setShowCreateForm(false)
            resetForm()
            return
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Failed',
              text: visitTargetRes.message || 'Failed to create Visit Target',
              confirmButtonColor: '#e9931c'
            })
            return
          }
        } catch (visitError) {
          console.error('Error creating visit target:', visitError)
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error creating Visit Target',
            confirmButtonColor: '#e9931c'
          })
          return
        } finally {
          setSubmitting(false)
        }
      }

      // Sample Track: Create samples first, then create follow-up task
      let createdSamplesCount = 0
      const createdSampleIds = []

      if (formData.type === 'Sample Track') {
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
        let created = 0
        let failed = 0
        let firstError = ''
        for (const item of selectedItems) {
          const payload = {
            salesman: formData.salesman,
            customer: formData.customer || undefined,
            customerName: custName,
            customerEmail: (formData.customerEmail || '').trim() || undefined,
            customerPhone: (formData.customerPhone || '').trim() || undefined,
            product: item.productId,
            productName: (item.productName || '').trim() || 'Product',
            productCode: (item.productCode || '').trim() || undefined,
            quantity: Math.max(1, Number(item.quantity) || 1),
            visitDate: (sampleVisitDate || getLocalDateString()).toString().trim(),
            expectedDate: (sampleExpectedDate || '').toString().trim() || undefined,
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

        createdSamplesCount = created

        if (created === 0) {
          const failText = failed === 1 ? 'Failed to create 1 sample.' : `Failed to create ${failed} samples.`
          const detail = firstError ? ` ${firstError}` : ''
          await Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: (failed > 0 ? failText : 'Error creating samples') + detail,
            confirmButtonColor: '#e9931c',
          })
          setSubmitting(false)
          return
        }
      }

      // Follow-up / Sample Track: create Follow-up (task)
      const taskData = {
        salesman: formData.salesman,
        customer: formData.customer || undefined,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        associatedContactName: formData.associatedContactName || undefined,
        associatedContactEmail: formData.associatedContactEmail || undefined,
        associatedCompanyName: formData.associatedCompanyName || undefined,
        associatedCompanyDomain: formData.associatedCompanyDomain || undefined,
        type: formData.type === 'Follow-up'
          ? (formData.followUpType || 'Call')
          : mapTaskType(formData.type),
        priority: formData.priority,
        scheduledDate: dueDateTime,
        dueDate: dueDateTime,
        description: formData.description || (formData.type === 'Sample Track' ? `Sample follow-up: ${formData.customerName}` : `Follow up with ${formData.customerName}`),
        notes: formData.notes || undefined,
        approvalStatus: approvalStatus,
        lastContacted: selectedCustomerForTask?.lastContact ? new Date(selectedCustomerForTask.lastContact).toISOString() : undefined,
        lastEngagement: selectedCustomerForTask?.lastEngagement ? new Date(selectedCustomerForTask.lastEngagement).toISOString() : undefined,
        relatedSample: formData.type === 'Sample Track' && createdSampleIds.length > 0 ? createdSampleIds[0] : undefined,
      }

      const res = await createFollowUp(taskData)
      if (res.success) {
        // Wait a bit for async HubSpot sync to complete
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Reload task to check if HubSpot sync was successful
        const updatedRes = await getFollowUp(res.data._id)
        const approvalMessage = approvalStatus === 'Approved'
          ? 'Task has been created and is visible in tasks list.'
          : 'Task will appear in tasks list.'

        const sampleMessage = formData.type === 'Sample Track' && createdSamplesCount > 0
          ? (createdSamplesCount === 1 ? ' 1 sample created.' : ` ${createdSamplesCount} samples created.`)
          : ''
        const successMessage = updatedRes.success && updatedRes.data.hubspotTaskId
          ? `Task created successfully and posted to HubSpot!${sampleMessage} ${approvalMessage}`
          : `Task created successfully!${sampleMessage} You can push it to HubSpot manually if needed. ${approvalMessage}`

        Swal.fire({
          icon: 'success',
          title: 'Task Created!',
          text: successMessage,
          confirmButtonColor: '#e9931c'
        })
        setShowCreateForm(false)
        resetForm()
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to create task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error creating task',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTaskClick = async (task) => {
    try {
      // Visit target tasks: fetch visit target by ID (not follow-up)
      if (task.isVisitTarget || task.visitTargetId) {
        const vtId = task.visitTargetId || task._id
        const res = await getVisitTarget(vtId)
        if (res.success && res.data) {
          const vt = res.data
          const taskLike = {
            _id: vt._id,
            id: vt._id,
            isVisitTarget: true,
            visitTargetId: vt._id,
            followUpNumber: 'VT-' + String(vt._id).slice(-6),
            description: vt.description || vt.name || `Visit: ${vt.name || vt.customerName || 'Customer'}`,
            customerName: vt.name || vt.customerName || 'Visit Request',
            customerEmail: vt.address ? '' : '',
            type: 'Visit',
            approvalStatus: vt.approvalStatus || 'Pending',
            status: vt.status || 'Pending',
            dueDate: vt.visitDate || vt.createdAt,
            visitDate: vt.visitDate,
            notes: vt.notes || '',
            address: vt.address,
            city: vt.city,
            state: vt.state,
            pincode: vt.pincode,
            priority: vt.priority || 'Medium',
            salesman: vt.salesman,
            createdBy: vt.createdBy,
            createdAt: vt.createdAt,
            customer: vt.customerId || vt.customer,
            visitTarget: vt.name
          }
          setSelectedTask(taskLike)
          setShowTaskDetail(true)
          setModalActiveTab('overview')
          const index = filtered.findIndex(t => (t._id || t.visitTargetId) === vtId)
          setCurrentTaskIndex(index >= 0 ? index : 0)
          setTaskActivities([])
          setTaskCustomerDetails(null)
          setTaskQuotations([])
          setRelatedTasks([])
          return
        }
        Swal.fire({ icon: 'error', title: 'Error', text: res.message || 'Visit target not found', confirmButtonColor: '#e9931c' })
        return
      }

      const res = await getFollowUp(task._id)
      if (res.success) {
        setSelectedTask(res.data)
        setShowTaskDetail(true)
        setModalActiveTab('overview')
        // Find current task index in filtered list
        const index = filtered.findIndex(t => t._id === task._id)
        setCurrentTaskIndex(index >= 0 ? index : 0)

        // Parse activities from notes (Meeting gets link + meetLink for Join Google Meet)
        if (res.data.notes) {
          try {
            setTaskActivities(parseNotesToActivities(res.data.notes))
          } catch (e) {
            console.error('Error parsing activities from notes:', e)
            setTaskActivities([])
          }
        } else {
          setTaskActivities([])
        }
        // Related tasks will be loaded below, don't reset here

        // Load customer details if customer ID exists
        // For HubSpot tasks, customer data might be in task itself
        if (res.data.source === 'hubspot') {
          // Extract name from task description if not available (e.g., "Follow up with Fran Simpson" -> "Fran Simpson")
          let extractedName = ''
          if (res.data.description) {
            const desc = res.data.description
            // Try to extract name from patterns like "Follow up with [Name]", "Call [Name]", etc.
            const nameMatch = desc.match(/(?:follow up|call|email|meeting|visit|task).*?with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
              desc.match(/(?:follow up|call|email|meeting|visit|task)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
              desc.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
            if (nameMatch && nameMatch[1]) {
              extractedName = nameMatch[1].trim()
            }
          }

          // HubSpot tasks - create customer details from task data
          const customerName = res.data.customerName || res.data.associatedContactName || extractedName || ''
          const customerEmail = res.data.customerEmail || res.data.associatedContactEmail || ''

          if (customerEmail || customerName) {
            setTaskCustomerDetails({
              name: customerName,
              firstName: customerName,
              email: customerEmail,
              phone: res.data.customerPhone || '',
              associatedContactName: res.data.associatedContactName || customerName || '',
              associatedContactEmail: res.data.associatedContactEmail || customerEmail || '',
              associatedCompanyName: res.data.associatedCompanyName || '',
              company: res.data.associatedCompanyName || '',
              source: 'hubspot'
            })
          } else {
            setTaskCustomerDetails(null)
          }

          // Fetch HubSpot deals for this contact
          if (customerEmail) {
            try {
              const dealsRes = await fetch(`/api/hubspot/deals?contactEmail=${encodeURIComponent(customerEmail)}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
              if (dealsRes.ok) {
                const dealsData = await dealsRes.json()
                setHubspotDeals(dealsData.deals || [])
              } else {
                setHubspotDeals([])
              }
            } catch (e) {
              console.error('Error fetching HubSpot deals:', e)
              setHubspotDeals([])
            }
          } else {
            setHubspotDeals([])
          }
        } else if (res.data.customer && typeof res.data.customer === 'object' && res.data.customer._id) {
          try {
            const customerRes = await getCustomer(res.data.customer._id)
            if (customerRes.success) {
              setTaskCustomerDetails(customerRes.data)
            } else {
              setTaskCustomerDetails(null)
            }
          } catch (e) {
            console.error('Error loading customer details:', e)
            setTaskCustomerDetails(null)
          }
        } else if (res.data.customer && typeof res.data.customer === 'string') {
          try {
            const customerRes = await getCustomer(res.data.customer)
            if (customerRes.success) {
              setTaskCustomerDetails(customerRes.data)
            } else {
              setTaskCustomerDetails(null)
            }
          } catch (e) {
            console.error('Error loading customer details:', e)
            setTaskCustomerDetails(null)
          }
        } else {
          // Fallback: Try to create customer details from task data if available
          if (res.data.customerEmail || res.data.customerName) {
            setTaskCustomerDetails({
              name: res.data.customerName || res.data.associatedContactName || '',
              firstName: res.data.customerName || res.data.associatedContactName || '',
              email: res.data.customerEmail || res.data.associatedContactEmail || '',
              phone: res.data.customerPhone || '',
              associatedContactName: res.data.associatedContactName || res.data.customerName || '',
              associatedContactEmail: res.data.associatedContactEmail || res.data.customerEmail || '',
              associatedCompanyName: res.data.associatedCompanyName || '',
              company: res.data.associatedCompanyName || ''
            })
          } else {
            setTaskCustomerDetails(null)
          }
        }

        // Load quotations for this customer
        // For HubSpot tasks, use task's email/name directly
        const taskEmail = res.data.customerEmail ||
          res.data.associatedContactEmail ||
          (res.data.customer && typeof res.data.customer === 'object' ? res.data.customer.email : '') ||
          (res.data.source === 'hubspot' ? res.data.customerEmail : '')
        const taskName = res.data.customerName ||
          res.data.associatedContactName ||
          (res.data.customer && typeof res.data.customer === 'object' ? (res.data.customer.name || res.data.customer.firstName) : '') ||
          (res.data.source === 'hubspot' ? res.data.customerName : '')

        if (taskEmail || taskName) {
          try {
            const searchQuery = taskEmail || taskName
            const quotationsRes = await getQuotations({
              search: searchQuery
            })
            if (quotationsRes.success && quotationsRes.data) {
              // Filter quotations that match customer email or name
              const matchingQuotations = quotationsRes.data.filter(q => {
                return (
                  (q.customerEmail && taskEmail && q.customerEmail.toLowerCase() === taskEmail.toLowerCase()) ||
                  (q.customerName && taskName && q.customerName.toLowerCase().includes(taskName.toLowerCase()))
                )
              })
              setTaskQuotations(matchingQuotations)
            } else {
              setTaskQuotations([])
            }
          } catch (e) {
            console.error('Error loading quotations:', e)
            setTaskQuotations([])
          }
        } else {
          setTaskQuotations([])
        }

        // Load sales targets for this customer/salesman
        try {
          const salesmanId = res.data.salesman && typeof res.data.salesman === 'object'
            ? res.data.salesman._id
            : res.data.salesman
          const targetsRes = await getSalesTargets({
            salesman: salesmanId || '',
            status: 'Active'
          })
          if (targetsRes.success && targetsRes.data) {
            setSalesTargets(targetsRes.data)
          } else {
            setSalesTargets([])
          }
        } catch (e) {
          console.error('Error loading sales targets:', e)
          setSalesTargets([])
        }

        // Load related tasks for same email/user
        try {
          const taskEmail = res.data.customerEmail ||
            (res.data.customer && typeof res.data.customer === 'object' ? res.data.customer.email : '') ||
            res.data.associatedContactEmail
          const taskName = res.data.customerName ||
            (res.data.customer && typeof res.data.customer === 'object' ? (res.data.customer.name || res.data.customer.firstName) : '') ||
            res.data.associatedContactName

          if (taskEmail || taskName || res.data.customer) {
            const allTasksRes = await getFollowUps({})
            if (allTasksRes.success && allTasksRes.data) {
              // Filter tasks that match the same customer - strict matching
              const matchingTasks = allTasksRes.data.filter(t => {
                // Skip current task
                if (t._id === res.data._id) return false

                // Priority 1: Match by customer ID (most reliable)
                if (res.data.customer && t.customer) {
                  const currentCustomerId = typeof res.data.customer === 'object' ? res.data.customer._id : res.data.customer
                  const taskCustomerId = typeof t.customer === 'object' ? t.customer._id : t.customer
                  if (currentCustomerId && taskCustomerId && currentCustomerId.toString() === taskCustomerId.toString()) {
                    return true
                  }
                }

                // Priority 2: Match by email (exact match only)
                if (taskEmail) {
                  const tEmail = t.customerEmail ||
                    (t.customer && typeof t.customer === 'object' ? t.customer.email : '') ||
                    t.associatedContactEmail
                  if (tEmail && taskEmail.toLowerCase().trim() === tEmail.toLowerCase().trim()) {
                    return true
                  }
                }

                // Priority 3: Match by name (exact match only, not partial)
                if (taskName) {
                  const tName = t.customerName ||
                    (t.customer && typeof t.customer === 'object' ? (t.customer.name || t.customer.firstName) : '') ||
                    t.associatedContactName
                  if (tName && taskName.toLowerCase().trim() === tName.toLowerCase().trim()) {
                    return true
                  }
                }

                return false
              })

              // Show ALL tasks for this customer (no duplicate removal in activities)
              // Sort by dueDate or createdAt (newest first)
              matchingTasks.sort((a, b) => {
                const dateA = new Date(a.dueDate || a.createdAt || 0)
                const dateB = new Date(b.dueDate || b.createdAt || 0)
                return dateB.getTime() - dateA.getTime() // Newest first
              })

              setRelatedTasks(matchingTasks)
            } else {
              setRelatedTasks([])
            }
          } else {
            setRelatedTasks([])
          }
        } catch (e) {
          console.error('Error loading related tasks:', e)
          setRelatedTasks([])
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
        const swalContainer = document.querySelector('.swal2-container')
        if (swalContainer) swalContainer.style.zIndex = '99999'
      }
    })
    if (!result.isConfirmed) return

    const isVisitTarget = selectedTask?.isVisitTarget || selectedTask?.visitTargetId
    try {
      let res
      if (isVisitTarget) {
        res = await updateVisitTarget(taskId, { status: 'Completed', completedAt: new Date() })
      } else {
        res = await updateFollowUp(taskId, {
          status: 'Completed',
          completedDate: new Date(),
        })
      }
      if (res.success) {
        if (isVisitTarget) {
          const updatedRes = await getVisitTarget(taskId)
          if (updatedRes.success && updatedRes.data) {
            const vt = updatedRes.data
            setSelectedTask({
              ...selectedTask,
              status: 'Completed',
              completedAt: vt.completedAt,
              completedDate: vt.completedAt
            })
          }
        } else {
          const updatedRes = await getFollowUp(taskId)
          if (updatedRes.success) setSelectedTask(updatedRes.data)
        }
        await loadTasks()
        // Check if this is the last task
        const isLastTask = currentTaskIndex === filtered.length - 1

        // Show success message with high z-index to appear on top
        await Swal.fire({
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

        if (isLastTask) {
          // Close modal if it's the last task
          setShowTaskDetail(false)
          // Don't reset state - keep it for when modal reopens
          // setSelectedTask(null)
          // setTaskCustomerDetails(null)
          // setTaskQuotations([])
          // setTaskActivities([])
          // setRelatedTasks([])
        } else {
          // Move to next task
          handleNextTask()
        }
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

  const handleDeleteTask = async (taskId, taskFromRow = null) => {
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: 'Are you sure you want to delete this task? It will be removed everywhere (Admin Tasks, Salesman dashboard, Sales Tracking). This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes',
      cancelButtonText: 'No'
    })
    if (!result.isConfirmed) return

    const taskToCheck = taskFromRow || selectedTask
    const isVisitTarget = taskToCheck?.isVisitTarget || taskToCheck?.visitTargetId
    try {
      const res = isVisitTarget ? await deleteVisitTarget(taskId) : await deleteFollowUp(taskId)
      if (res.success) {
        if (selectedTask && (selectedTask._id === taskId || selectedTask.id === taskId)) {
          setSelectedTask(null)
          setShowTaskDetail(false)
        }
        setTasks((prev) => prev.filter((t) => (t._id || t.id)?.toString() !== String(taskId)))
        await loadTasks()
        await Swal.fire({
          icon: 'success',
          title: 'Task Deleted',
          text: 'Task has been deleted. It is removed from Admin Tasks, Salesman dashboard, and Sales Tracking.',
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to delete task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting task',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleApproveTask = async (taskId) => {
    const confirmResult = await Swal.fire({
      icon: 'question',
      title: 'Approve Task?',
      text: 'Approve this task? It will be posted to HubSpot and the salesman will be notified.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6b7280',
    })

    if (!confirmResult.isConfirmed) return

    try {
      // Check if this is a visit target
      const task = tasks.find(t => t._id === taskId)
      const isVisitTarget = task?.isVisitTarget || task?.visitTargetId

      let res
      if (isVisitTarget) {
        // Approve visit target
        const visitTargetId = task.visitTargetId || taskId
        res = await updateVisitTarget(visitTargetId, { approvalStatus: 'Approved' })
      } else {
        // Approve regular task
        res = await approveFollowUp(taskId)
      }

      if (res.success) {
        if (isVisitTarget) {
          Swal.fire({
            icon: 'success',
            title: 'Visit Request Approved!',
            text: 'Visit request approved successfully! A task has been created for the salesman.',
            confirmButtonColor: '#e9931c'
          })
        } else {
          // Wait a bit for async HubSpot sync
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Reload to check HubSpot sync status
          const updatedRes = await getFollowUp(taskId)
          if (updatedRes.success && updatedRes.data.hubspotTaskId) {
            Swal.fire({
              icon: 'success',
              title: 'Task Approved!',
              text: 'Task approved successfully! It has been posted to HubSpot. Salesman will be notified.',
              confirmButtonColor: '#e9931c'
            })
          } else {
            Swal.fire({
              icon: 'success',
              title: 'Task Approved!',
              text: 'Task approved successfully! HubSpot sync is in progress. Salesman will be notified.',
              confirmButtonColor: '#e9931c'
            })
          }
        }
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to approve task',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error approving task',
        confirmButtonColor: '#e9931c',
      })
    }
  }

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await updateFollowUp(taskId, { taskStatus: newStatus })
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Status Updated!',
          text: `Task status updated to ${newStatus}`,
          confirmButtonColor: '#e9931c',
          timer: 2000,
          timerProgressBar: true
        })
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to update task status',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error updating task status:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error updating task status',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleStartTask = (task) => {
    setTaskToStart(task)
    setMeterPicture(null)
    setMeterReading('')
    setShowStartTaskModal(true)
  }

  const handleMeterPictureUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setMeterPicture(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCaptureMeterPicture = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // Use back camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setMeterPicture(event.target.result)
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  const handleConfirmStartTask = async () => {
    if (!meterPicture) {
      Swal.fire({
        icon: 'warning',
        title: 'Meter Picture Required',
        text: 'Please upload meter picture to start the task',
        confirmButtonColor: '#e9931c'
      })
      return
    }

    try {
      const updateData = {
        startedAt: new Date(),
        meterPicture: meterPicture,
        meterReading: meterReading || '',
        status: 'Today' // Keep status as Today when started
      }

      const res = await updateFollowUp(taskToStart._id, updateData)
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Task Started!',
          text: 'Task has been started successfully with meter picture',
          confirmButtonColor: '#e9931c'
        })
        setShowStartTaskModal(false)
        setTaskToStart(null)
        setMeterPicture(null)
        setMeterReading('')
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to start task',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error starting task:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error starting task',
        confirmButtonColor: '#e9931c'
      })
    }
  }

  const handleRejectTask = async (taskId) => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Reject Task',
      text: 'Enter rejection reason (optional):',
      input: 'text',
      inputPlaceholder: 'Enter reason...',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Reject',
      cancelButtonText: 'Cancel'
    })
    if (!isConfirmed) return

    try {
      // Check if this is a visit target
      const task = tasks.find(t => t._id === taskId)
      const isVisitTarget = task?.isVisitTarget || task?.visitTargetId

      let res
      if (isVisitTarget) {
        // Reject visit target
        const visitTargetId = task.visitTargetId || taskId
        res = await updateVisitTarget(visitTargetId, {
          approvalStatus: 'Rejected',
          rejectionReason: reason || ''
        })
      } else {
        // Reject regular task
        res = await rejectFollowUp(taskId, reason || '')
      }

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: isVisitTarget ? 'Visit Request Rejected' : 'Task Rejected',
          text: isVisitTarget ? 'Visit request rejected successfully.' : 'Task rejected successfully.',
          confirmButtonColor: '#e9931c'
        })
        await loadTasks()
        setShowTaskDetail(false)
        setSelectedTask(null)
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to reject task',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error rejecting task',
        confirmButtonColor: '#e9931c',
      })
    }
  }

  const handlePushToHubSpot = async (taskId) => {
    const result = await Swal.fire({
      title: 'Push to HubSpot?',
      text: 'This can only be done once to prevent duplicates',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#e9931c',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Push',
      cancelButtonText: 'Cancel'
    })
    if (!result.isConfirmed) return

    setPushingToHubSpot(true)
    try {
      const res = await pushToHubSpot(taskId)
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Task successfully pushed to HubSpot!',
          confirmButtonColor: '#e9931c'
        })
        // Reload task details to get updated hubspotTaskId
        if (selectedTask && selectedTask._id === taskId) {
          const updatedRes = await getFollowUp(taskId)
          if (updatedRes.success) {
            setSelectedTask(updatedRes.data)
          }
        }
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: res.message || 'Failed to push task to HubSpot',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing task to HubSpot',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingToHubSpot(false)
    }
  }

  const handleImportFromHubSpot = async () => {
    setImporting(true)
    try {
      const res = await importHubSpotTasksToDb()
      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          text: 'Tasks imported successfully from HubSpot!',
          confirmButtonColor: '#e9931c'
        })
        await loadTasks()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: res.message || 'Failed to import tasks',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (e) {
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error importing tasks',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setImporting(false)
    }
  }

  const handleCustomerSelect = (customerId) => {
    if (customerId) {
      const customer = customers.find(c => c._id === customerId)
      if (customer) {
        const isHubSpotCustomer = customer.source === 'hubspot' || customer.isHubSpot
        const contactName = customer.associatedContactName || customer.contactPerson || customer.name || customer.firstName || ''
        const contactEmail = customer.email || ''
        const companyName = customer.associatedCompanyName || customer.company || ''

        setFormData({
          ...formData,
          customer: isHubSpotCustomer ? '' : customerId,
          customerName: customer.name || customer.firstName || '',
          customerEmail: customer.email || '',
          customerPhone: customer.phone || '',
          associatedContactName: contactName,
          associatedContactEmail: contactEmail,
          associatedCompanyName: companyName,
          associatedCompanyDomain: customer.associatedCompanyDomain || formData.associatedCompanyDomain || '',
        })
      }
    } else {
      setFormData({
        ...formData,
        customer: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        associatedContactName: '',
        associatedContactEmail: '',
        associatedCompanyName: '',
        associatedCompanyDomain: '',
      })
    }
  }

  const resetForm = () => {
    setSelectedItems([])
    setAddItemProduct('')
    setAddItemQty(1)
    setSampleVisitDate(getLocalDateString())
    setSampleExpectedDate('')
    setFormData({
      salesman: '',
      customer: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      associatedContactName: '',
      associatedContactEmail: '',
      associatedCompanyName: '',
      associatedCompanyDomain: '',
      type: 'Visit Target',
      followUpType: 'Call',
      relatedSample: '',
      priority: 'Medium',
      dueDate: '',
      dueTime: '09:00',
      description: '',
      notes: '',
    })
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
    return 'bg-gray-100 text-gray-800'
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
      setSelectedRows(paginatedTasks.map(t => t._id))
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

  const handleBulkDeleteTasks = async () => {
    if (selectedRows.length === 0) return
    const result = await Swal.fire({
      title: 'Bulk Delete Tasks?',
      html: `Delete <strong>${selectedRows.length}</strong> selected task(s)? This cannot be undone. They will be removed from Admin Tasks, Salesman dashboard, and Sales Tracking.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete',
    })
    if (!result.isConfirmed) return
    let deleted = 0
    let failed = 0
    for (const taskId of selectedRows) {
      const task = tasks.find(t => (t._id || t.id)?.toString() === String(taskId))
      const isVisitTarget = task?.isVisitTarget || task?.visitTargetId
      const idToDelete = isVisitTarget ? (task?.visitTargetId || taskId) : taskId
      try {
        const res = isVisitTarget ? await deleteVisitTarget(idToDelete) : await deleteFollowUp(idToDelete)
        if (res?.success) deleted++
        else failed++
      } catch (_) {
        failed++
      }
    }
    setSelectedRows([])
    if (selectedTask && selectedRows.some(id => (selectedTask._id || selectedTask.id)?.toString() === String(id))) {
      setSelectedTask(null)
      setShowTaskDetail(false)
    }
    await loadTasks()
    Swal.fire({
      icon: failed ? (deleted ? 'warning' : 'error') : 'success',
      title: failed ? (deleted ? 'Partially done' : 'Delete failed') : 'Deleted',
      text: deleted ? `Deleted ${deleted} task(s).${failed ? ` ${failed} failed.` : ''}` : 'Could not delete tasks.',
      confirmButtonColor: '#e9931c',
    })
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
          // Prioritize HubSpot type (hs_task_type) over mapped type (type)
          aVal = (a.hs_task_type || a.type || '').toLowerCase()
          bVal = (b.hs_task_type || b.type || '').toLowerCase()
          break
        case 'status':
          aVal = (a.status || '').toLowerCase()
          bVal = (b.status || '').toLowerCase()
          break
        case 'salesman':
          aVal = (a.salesman?.name || a.salesman?.email || '').toLowerCase()
          bVal = (b.salesman?.name || b.salesman?.email || '').toLowerCase()
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

  // Calculate counts for each tab
  const tabCounts = useMemo(() => {
    const counts = {
      All: tasks.length,
      HubSpotImported: tasks.filter(t => {
        // Tasks imported from HubSpot have source === 'hubspot'
        return t.source === 'hubspot'
      }).length,
      PushedToHubSpot: tasks.filter(t => {
        const hasHubSpotId = t.hubspotTaskId && t.hubspotTaskId !== '' && t.hubspotTaskId !== null
        return hasHubSpotId
      }).length,
      NotPushed: tasks.filter(t => {
        const noHubSpotId = !t.hubspotTaskId || t.hubspotTaskId === '' || t.hubspotTaskId === null
        return noHubSpotId
      }).length,
      Overdue: tasks.filter(t => t.status === 'Overdue').length,
      Today: tasks.filter(t => t.status === 'Today').length,
      Upcoming: tasks.filter(t => t.status === 'Upcoming').length,
      Completed: tasks.filter(t => t.status === 'Completed').length,
    }
    return counts
  }, [tasks])

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
      if (filterType === 'myCreationOnly') {
        return { ...prev, myCreationOnly: false }
      }
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
      salesman: [],
      dueDateRange: null,
      timeRange: null,
      myCreationOnly: false
    })
    setSearch('')
    setFilterSearch({
      taskType: '',
      priority: '',
      salesman: '',
      dueDate: '',
      time: ''
    })
  }

  const hasActiveFilters = activeFilters.taskType.length > 0 ||
    activeFilters.priority.length > 0 ||
    activeFilters.salesman.length > 0 ||
    activeFilters.dueDateRange !== null ||
    activeFilters.timeRange !== null ||
    activeFilters.myCreationOnly ||
    search.trim() !== ''

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 px-0 sm:px-0 pt-2 lg:pt-0" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      {/* Header – responsive for mobile */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold truncate" style={{ color: '#1f2937', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Tasks</h2>
          <p className="text-xs sm:text-sm truncate" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            {loading ? 'Loading...' : `${sortedTasks.length} of ${tasks.length} tasks`} | Manage tasks & assign to salesmen
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={handleImportFromHubSpot}
            disabled={importing}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            style={{
              backgroundColor: appTheme.status.info.main,
              color: appTheme.text.white
            }}
          >
            {importing ? <FaSpinner className="animate-spin w-4 h-4" /> : <FaSync className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span className="hidden sm:inline">Import from HubSpot</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            onClick={() => setShowImportExcelModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all shadow-md hover:shadow-lg active:scale-95 bg-green-600 text-white hover:bg-green-700"
          >
            <FaFileExcel className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
            style={{
              backgroundColor: appTheme.primary.main,
              color: appTheme.text.white
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = appTheme.primary.dark}
            onMouseLeave={(e) => e.target.style.backgroundColor = appTheme.primary.main}
          >
            <FaPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Tab Bar – horizontal scroll on mobile */}
      <div className="flex overflow-x-auto gap-2 mb-3 sm:mb-4 border-b border-gray-200 pb-2 -mx-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((tab) => {
          const count = tabCounts[tab.id] ?? 0
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                setCurrentPage(1)
              }}
              className={`flex-shrink-0 px-3 py-2 sm:px-4 rounded-t-lg text-xs sm:text-sm font-medium transition-colors ${isActive
                ? 'bg-[#e9931c] text-white border-b-2 border-[#e9931c] -mb-0.5'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-b-2 border-transparent'
                }`}
            >
              {tab.label}
              {count !== undefined && (
                <span className={`ml-1.5 ${isActive ? 'text-white/90' : 'text-gray-500'}`}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm mb-3 sm:mb-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {/* Active Filter Tags */}
          {activeFilters.taskType.map(type => (
            <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
              Task type: {type}
              <button onClick={() => removeFilter('taskType', type)} className="hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.priority.map(priority => (
            <span key={priority} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
              Priority: {priority}
              <button onClick={() => removeFilter('priority', priority)} className="hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          ))}
          {activeFilters.salesman.map(salesmanId => {
            const salesman = salesmen.find(s => (s._id || s.id) === salesmanId)
            return salesman ? (
              <span key={salesmanId} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                Assigned to: {salesman.name}
                <button onClick={() => removeFilter('salesman', salesmanId)} className="hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
              </span>
            ) : null
          })}
          {activeFilters.dueDateRange && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
              Due date: {activeFilters.dueDateRange}
              <button onClick={() => removeFilter('dueDateRange')} className="hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </span>
          )}
          {activeFilters.myCreationOnly && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#e9931c]/20 text-gray-800 rounded-full text-xs font-medium">
              My creation only
              <button onClick={() => removeFilter('myCreationOnly')} className="hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center">×</button>
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
          {/* Salesman filter – visible like Customer Management */}
          <span className="text-sm text-gray-600 font-medium">Salesman:</span>
          <select
            value={activeFilters.salesman.length > 0 ? activeFilters.salesman[0] : ''}
            onChange={(e) => {
              const v = e.target.value
              setActiveFilters(prev => ({ ...prev, salesman: v ? [v] : [] }))
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#e9931c] focus:border-[#e9931c]"
            title="Filter tasks by assigned salesman"
          >
            <option value="">All</option>
            {salesmen.map((s) => (
              <option key={s._id || s.id} value={s._id || s.id}>{s.name || s.email || 'Salesman'}</option>
            ))}
          </select>
          {/* My creation only */}
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={activeFilters.myCreationOnly}
              onChange={(e) => setActiveFilters(prev => ({ ...prev, myCreationOnly: e.target.checked }))}
              className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
            />
            <span>My creation only</span>
          </label>
          {/* Task Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTaskTypeDropdown(!showTaskTypeDropdown)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
                setShowSalesmanDropdown(false)
                if (!showTaskTypeDropdown) {
                  setFilterSearch(prev => ({ ...prev, taskType: '' }))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Task type</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showTaskTypeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-60 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search task types..."
                      value={filterSearch.taskType}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, taskType: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {TASK_TYPES.filter((type, index, self) => {
                    // Remove duplicates (case-insensitive)
                    const isUnique = index === self.findIndex(t => t.toLowerCase() === type.toLowerCase())
                    // Filter by search term
                    const matchesSearch = !filterSearch.taskType || type.toLowerCase().includes(filterSearch.taskType.toLowerCase())
                    return isUnique && matchesSearch
                  }).map(type => (
                    <label key={type} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.taskType.some(ft => ft.toLowerCase() === type.toLowerCase())}
                        onChange={() => {
                          // Check if already selected (case-insensitive)
                          const isSelected = activeFilters.taskType.some(ft => ft.toLowerCase() === type.toLowerCase())
                          if (isSelected) {
                            // Remove all case variants
                            const newFilters = activeFilters.taskType.filter(ft => ft.toLowerCase() !== type.toLowerCase())
                            setActiveFilters(prev => ({ ...prev, taskType: newFilters }))
                          } else {
                            // Add this type
                            handleFilterChange('taskType', type, true)
                          }
                        }}
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
                setShowSalesmanDropdown(false)
                if (!showDueDateDropdown) {
                  setFilterSearch(prev => ({ ...prev, dueDate: '' }))
                }
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
                      placeholder="Search date filters..."
                      value={filterSearch.dueDate}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, dueDate: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                  ].filter(option =>
                    !filterSearch.dueDate || option.label.toLowerCase().includes(filterSearch.dueDate.toLowerCase())
                  ).map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('dueDateRange', option.value)
                        setShowDueDateDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${activeFilters.dueDateRange === option.value ? 'bg-gray-100 text-gray-800' : ''
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
                setShowSalesmanDropdown(false)
                if (!showPriorityDropdown) {
                  setFilterSearch(prev => ({ ...prev, priority: '' }))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Priority</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showPriorityDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-60 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search priorities..."
                      value={filterSearch.priority}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, priority: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {PRIORITIES.filter(priority =>
                    !filterSearch.priority || priority.toLowerCase().includes(filterSearch.priority.toLowerCase())
                  ).map(priority => (
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

          {/* Salesman/Assigned To Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSalesmanDropdown(!showSalesmanDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
                setShowTimeDropdown(false)
                if (!showSalesmanDropdown) {
                  setFilterSearch(prev => ({ ...prev, salesman: '' }))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Assigned to</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showSalesmanDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-60 overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                    <input
                      type="text"
                      placeholder="Search salesmen..."
                      value={filterSearch.salesman}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearch(prev => ({ ...prev, salesman: e.target.value }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e9931c]"
                    />
                  </div>
                </div>
                <div className="py-1">
                  {salesmen.filter(salesman => {
                    const searchTerm = filterSearch.salesman.toLowerCase()
                    if (!searchTerm) return true
                    const name = (salesman.name || '').toLowerCase()
                    const email = (salesman.email || '').toLowerCase()
                    return name.includes(searchTerm) || email.includes(searchTerm)
                  }).map(salesman => (
                    <label key={salesman._id || salesman.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeFilters.salesman.includes((salesman._id || salesman.id).toString())}
                        onChange={() => handleFilterChange('salesman', (salesman._id || salesman.id).toString(), true)}
                        className="rounded border-gray-300 text-[#e9931c] focus:ring-[#e9931c]"
                      />
                      <span className="text-sm">{salesman.name || salesman.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Time Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTimeDropdown(!showTimeDropdown)
                setShowTaskTypeDropdown(false)
                setShowDueDateDropdown(false)
                setShowPriorityDropdown(false)
                setShowSalesmanDropdown(false)
                if (!showTimeDropdown) {
                  setFilterSearch(prev => ({ ...prev, time: '' }))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <span>Time</span>
              <FaChevronDown className="w-3 h-3" />
            </button>
            {showTimeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]" onMouseDown={(e) => e.stopPropagation()}>
                <div className="py-1">
                  {[
                    { value: 'morning', label: 'Morning (6 AM - 12 PM)' },
                    { value: 'afternoon', label: 'Afternoon (12 PM - 6 PM)' },
                    { value: 'evening', label: 'Evening (6 PM - 12 AM)' },
                    { value: 'night', label: 'Night (12 AM - 6 AM)' }
                  ].filter(option =>
                    !filterSearch.time || option.label.toLowerCase().includes(filterSearch.time.toLowerCase())
                  ).map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleFilterChange('timeRange', option.value)
                        setShowTimeDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${activeFilters.timeRange === option.value ? 'bg-gray-100 text-gray-800' : ''
                        }`}
                    >
                      {option.label}
                    </button>
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
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-gray-500 focus-within:border-gray-500 transition-all">
            <FaSearch style={{ color: '#9ca3af', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} className="flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title, contact, company, type, status, priority, notes..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#1f2937', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
            />
            {search && search.trim() && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSearch('')
                }}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
                title="Clear search"
                type="button"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Save view
          </button>
          {selectedRows.length > 0 && (
            <>
              <button className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                Start {selectedRows.length} tasks
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteTasks}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <FaTrash className="w-3.5 h-3.5" />
                Bulk Delete ({selectedRows.length})
              </button>
            </>
          )}
          <button className="text-sm text-gray-600 hover:text-gray-800 underline">
            Edit columns
          </button>
        </div>
      </div>

      {/* Task Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: appTheme.background.white, boxShadow: appTheme.shadow.md }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FaSpinner className="animate-spin" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} size={32} />
          </div>
        ) : paginatedTasks.length === 0 ? (
          <div className="text-center py-12">
            <FaCalendarAlt className="mx-auto mb-4" style={{ color: '#d1d5db', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} size={48} />
            <p className="font-medium" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>No tasks found</p>
            <p className="text-sm mt-2" style={{ color: '#9ca3af', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              {search ? 'Try a different search term' : 'Create your first task to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-lg border border-gray-200" style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full border-collapse" style={{ minWidth: '1600px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
              <thead className="bg-gray-50 border-b" style={{ borderColor: appTheme.border.light }}>
                <tr>
                  <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.length === paginatedTasks.length && paginatedTasks.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                      style={{ accentColor: appTheme.primary.main }}
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      STATUS
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[200px]"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center">
                      TITLE
                      <SortIcon field="description" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[150px]"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('customerName')}
                  >
                    <div className="flex items-center">
                      ASSOCIATED CONTACT
                      <SortIcon field="customerName" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[150px]" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    ASSOCIATED COMPANY
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap min-w-[150px]"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('salesman')}
                  >
                    <div className="flex items-center">
                      ASSIGNED TO
                      <SortIcon field="salesman" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    LAST CONTACT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    LAST ENGAGEMENT
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center">
                      TASK TYPE
                      <SortIcon field="type" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap"
                    style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center">
                      DUE DATE
                      <SortIcon field="dueDate" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky right-0 bg-gray-50 z-10" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
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
                      className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(task._id)}
                          onChange={() => handleSelectRow(task._id)}
                          className="rounded border-gray-300"
                          style={{ accentColor: appTheme.primary.main }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap group relative">
                          <StatusIcon className="w-4 h-4" style={{ color: statusStyle.text }} />
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', color: '#1f2937' }}>
                            {task.status || '—'}
                          </span>
                          {/* Show HubSpot badge if task is pushed to HubSpot */}
                          {task.hubspotTaskId && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 transition-all hover:opacity-80 cursor-default"
                              style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
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
                            style={{
                              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                              color: '#1f2937'
                            }}
                          >
                            {task.description || `Follow up with ${task.customerName}`}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {(() => {
                            // Get associated contact - prioritize from customer object, then task fields
                            const associatedContactName = (task.customer && typeof task.customer === 'object' ? task.customer.associatedContactName : null) ||
                              task.associatedContactName ||
                              (task.customerName && task.customerName !== 'HubSpot Contact' ? task.customerName : '') ||
                              '';
                            const associatedContactEmail = (task.customer && typeof task.customer === 'object' ? task.customer.associatedContactEmail : null) ||
                              task.associatedContactEmail ||
                              task.customerEmail ||
                              '';

                            if (!associatedContactName && !associatedContactEmail) {
                              return <span className="text-sm text-gray-400">—</span>;
                            }

                            return (
                              <>
                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {(associatedContactName || associatedContactEmail || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: appTheme.text.primary }}>
                                    {associatedContactName || '—'}
                                  </p>
                                  {associatedContactEmail && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {associatedContactEmail}
                                    </p>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[150px]">
                          {(() => {
                            // Show associated company - prioritize from customer object, then task fields
                            const companyName = (task.customer && typeof task.customer === 'object' ? (task.customer.associatedCompanyName || task.customer.company) : null) ||
                              task.associatedCompanyName ||
                              '';

                            if (!companyName || !companyName.trim()) {
                              return <span className="text-sm text-gray-400" title="No company associated">—</span>;
                            }

                            return (
                              <>
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-gray-600">
                                    {companyName.trim()[0].toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm truncate" style={{ color: appTheme.text.primary }}>
                                  {companyName.trim()}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-[150px]">
                          {(() => {
                            // Show assigned salesman (from HubSpot owner if available, otherwise from salesman field)
                            // Priority: hubspot_owner_name > salesman.name > salesman.email
                            const hubspotOwnerName = (task.hubspot_owner_name || '').trim();
                            const salesmanName = (task.salesman?.name || '').trim();
                            const salesmanEmail = (task.salesman?.email || '').trim();

                            // Use HubSpot owner name if available, otherwise use salesman name, then email
                            let displayName = hubspotOwnerName || salesmanName || salesmanEmail || 'No Owner';
                            const displayEmail = task.hubspot_owner_email || salesmanEmail || '';
                            const createdByName = task.createdBy?.name || task.createdBy?.email || '';

                            return (
                              <>
                                {displayName && displayName !== 'No Owner' && (
                                  <div className="flex items-center gap-2">
                                    <FaUser className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate" style={{ color: '#1f2937', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} title={hubspotOwnerName ? "HubSpot Owner" : "Assigned Salesman"}>
                                        {displayName}
                                      </span>
                                      {displayEmail && displayEmail !== displayName && (
                                        <span className="text-xs truncate" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }} title="Email">
                                          {displayEmail}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {displayName === 'No Owner' && (
                                  <span className="text-sm text-gray-400 italic">No Owner</span>
                                )}
                                {createdByName && createdByName !== displayName && createdByName !== salesmanEmail && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 truncate" title="Created By">
                                      Created: {createdByName}
                                    </span>
                                  </div>
                                )}
                                {!displayName && !createdByName && (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const lastContact = task.lastContacted || (task.customer && typeof task.customer === 'object' ? task.customer.lastContact : null);
                          if (lastContact) {
                            return (
                              <span className="text-sm" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                                {new Date(lastContact).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            );
                          }
                          return <span className="text-sm text-gray-400">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const lastEngagement = task.lastEngagement || (task.customer && typeof task.customer === 'object' ? task.customer.lastEngagement : null);
                          if (lastEngagement) {
                            return (
                              <span className="text-sm" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                                {new Date(lastEngagement).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            );
                          }
                          return <span className="text-sm text-gray-400">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                          {getTaskTypeLabel(task.hs_task_type || task.type, task.isVisitTarget)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.dueDate ? (
                          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap" style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                            <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs" style={{ color: '#9ca3af' }}>
                              {new Date(task.dueDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sticky right-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Show Push button for tasks that can be pushed to HubSpot */}
                          {/* Logic: 
                            - Admin-created tasks: No approval needed, show if not pushed and not imported
                            - Salesman-created tasks: Must be approved, show if approved + not pushed + not imported
                          */}
                          {task.source !== 'hubspot' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePushToHubSpot(task._id)
                              }}
                              disabled={pushingToHubSpot || (task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${(task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null)
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-50'
                                : 'text-white hover:opacity-90 disabled:opacity-50'
                                }`}
                              style={!(task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null) ? { backgroundColor: appTheme.status.info.main } : {}}
                              title={(task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null) ? "Already Pushed to HubSpot" : "Push to HubSpot"}
                            >
                              {pushingToHubSpot ? (
                                <FaSpinner className="animate-spin" />
                              ) : (task.hubspotTaskId && task.hubspotTaskId !== '' && task.hubspotTaskId !== null) ? (
                                <>
                                  <FaCheckCircle />
                                  Pushed
                                </>
                              ) : (
                                <>
                                  <FaCloudUploadAlt />
                                  Push
                                </>
                              )}
                            </button>
                          )}
                          {/* Show Imported badge for HubSpot imported tasks */}
                          {task.source === 'hubspot' && (
                            <span
                              className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              title="Imported from HubSpot"
                            >
                              Imported
                            </span>
                          )}
                          {/* Show Started badge if task is started */}
                          {task.startedAt && (
                            <span
                              className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                              title={`Started at ${new Date(task.startedAt).toLocaleString()}`}
                            >
                              Started
                            </span>
                          )}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTask(task._id, task)
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Task"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-lg p-3 sm:p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${currentPage === pageNum
                      ? 'text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    style={currentPage === pageNum ? {
                      backgroundColor: appTheme.primary.main
                    } : {}}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
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
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Salesman Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Assign to Salesman <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.salesman}
                    onChange={(e) => setFormData({ ...formData, salesman: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  >
                    <option value="">Select a salesman...</option>
                    {salesmen.map((salesman) => (
                      <option key={salesman._id || salesman.id} value={salesman._id || salesman.id}>
                        {salesman.name || salesman.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                    Customer (Optional)
                  </label>
                  <select
                    value={formData.customer}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                    style={{
                      borderColor: appTheme.border.medium,
                      focusRingColor: appTheme.primary.main
                    }}
                  >
                    <option value="">Select a customer...</option>
                    {/* Show both App-created and HubSpot-imported customers */}
                    {customers.length > 0 && (
                      <>
                        {customers.filter(c => c.source !== 'hubspot' && !c.isHubSpot).length > 0 && (
                          <optgroup label="App Customers">
                            {customers.filter(c => c.source !== 'hubspot' && !c.isHubSpot).map((customer) => (
                              <option key={customer._id} value={customer._id}>
                                {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {customers.filter(c => c.source === 'hubspot' || c.isHubSpot).length > 0 && (
                          <optgroup label="HubSpot Customers">
                            {customers.filter(c => c.source === 'hubspot' || c.isHubSpot).map((customer) => (
                              <option key={customer._id} value={customer._id}>
                                {customer.name || customer.firstName} {customer.email ? `(${customer.email})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
                  </select>
                </div>

                {/* Customer Name */}
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

                {/* Customer Email */}
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

                {/* Customer Phone */}
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

                {/* Last Contact & Last Engagement (auto-filled from selected customer, sent with task) */}
                {formData.customer && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Last Contact
                      </label>
                      <div
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                        style={{ borderColor: appTheme.border.medium, color: appTheme.text.secondary }}
                        title="From customer; will be saved with task"
                      >
                        {(() => {
                          const sel = customers.find(c => c._id === formData.customer)
                          const lastContact = sel?.lastContact
                          return lastContact
                            ? new Date(lastContact).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Last Engagement
                      </label>
                      <div
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-sm"
                        style={{ borderColor: appTheme.border.medium, color: appTheme.text.secondary }}
                        title="From customer; will be saved with task"
                      >
                        {(() => {
                          const sel = customers.find(c => c._id === formData.customer)
                          const lastEngagement = sel?.lastEngagement
                          return lastEngagement
                            ? new Date(lastEngagement).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Associated Contact (Optional) */}
                <div className="border-t pt-4 mt-4" style={{ borderColor: appTheme.border.light }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: appTheme.text.primary }}>
                    Associated Contact (Optional)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Contact Name
                      </label>
                      <input
                        type="text"
                        value={formData.associatedContactName}
                        onChange={(e) => setFormData({ ...formData, associatedContactName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter contact name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={formData.associatedContactEmail}
                        onChange={(e) => setFormData({ ...formData, associatedContactEmail: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter contact email"
                      />
                    </div>
                  </div>
                </div>

                {/* Associated Company (Optional) */}
                <div className="border-t pt-4 mt-4" style={{ borderColor: appTheme.border.light }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: appTheme.text.primary }}>
                    Associated Company (Optional)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={formData.associatedCompanyName}
                        onChange={(e) => setFormData({ ...formData, associatedCompanyName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                        Company Domain
                      </label>
                      <input
                        type="text"
                        value={formData.associatedCompanyDomain}
                        onChange={(e) => setFormData({ ...formData, associatedCompanyDomain: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2"
                        style={{
                          borderColor: appTheme.border.medium,
                          focusRingColor: appTheme.primary.main
                        }}
                        placeholder="e.g., example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Type and Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                      Task Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value
                        setFormData({
                          ...formData,
                          type: newType,
                          followUpType: newType === 'Follow-up' ? (formData.followUpType || 'Call') : '',
                          relatedSample: newType === 'Sample Track' ? formData.relatedSample : ''
                        })
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
                </div>

                {/* Follow-up Type - Show only when Follow-up is selected */}
                {formData.type === 'Follow-up' && (
                  <div>
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
                      <option value="">Select follow-up type</option>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Visit">Visit</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

                {/* Sample Tracker – Add Item Section – Show only when Sample Track is selected */}
                {formData.type === 'Sample Track' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: appTheme.text.primary }}>
                          Visit Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={sampleVisitDate}
                          onChange={(e) => setSampleVisitDate(e.target.value)}
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
                          value={sampleExpectedDate}
                          onChange={(e) => setSampleExpectedDate(e.target.value)}
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
                          if (e.key !== 'Enter') return
                          e.preventDefault()
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
                          onClick={() => {
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
                          }}
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
                          Select a product and quantity above, then click <strong>+</strong> or press <strong>Enter</strong> to add. Add at least one item to enable &quot;Create Task&quot;.
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
                                onClick={() => setSelectedItems(prev => prev.filter((_, i) => i !== index))}
                                className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Due Date and Time */}
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Description */}
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

                {/* Notes */}
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
                      Creating...
                    </span>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Tasks from Excel / CSV Modal */}
      {showImportExcelModal && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto min-h-[100dvh]">
          <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:rounded-2xl shadow-xl flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0 pb-[env(safe-area-inset-bottom)] sm:pb-0">
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
              <p className="text-sm text-gray-600">Upload a CSV from your device. First row = headers: <strong>customerName</strong>, <strong>salesmanEmail</strong> (or salesmanId), <strong>dueDate</strong>. Optional: type, description, priority, customerEmail, notes.</p>
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
                          <th className="text-left p-2">Salesman</th>
                          <th className="text-left p-2">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importExcelPreview.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2">{row.customerName || '—'}</td>
                            <td className="p-2">{row.salesmanEmail || row.salesmanId || '—'}</td>
                            <td className="p-2">{row.dueDate || '—'}</td>
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
        <div className="fixed inset-0 z-50 bg-white overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="h-full flex flex-col">
            {/* Header Bar */}
            <div className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setShowTaskDetail(false)
                    // Don't reset selectedTask - keep it for when modal reopens
                    // setSelectedTask(null)
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-base md:text-xl xl:text-2xl font-semibold text-gray-900 line-clamp-1">
                    {selectedTask.description || `Follow up with ${selectedTask.associatedContactName || selectedTask.customerName || 'Contact'}`}
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
                    className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium hover:opacity-90 transition-colors text-sm md:text-base whitespace-nowrap"
                    style={{
                      backgroundColor: appTheme.primary.main,
                      color: appTheme.text.white
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = appTheme.primary.dark}
                    onMouseLeave={(e) => e.target.style.backgroundColor = appTheme.primary.main}
                  >
                    Complete
                  </button>
                )}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('navigateToTab', { detail: 'live-tracking' }))
                  }}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium hover:opacity-90 transition-colors flex items-center gap-2 text-sm md:text-base whitespace-nowrap"
                  style={{
                    backgroundColor: appTheme.primary.main,
                    color: appTheme.text.white
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = appTheme.primary.dark}
                  onMouseLeave={(e) => e.target.style.backgroundColor = appTheme.primary.main}
                >
                  <FaMapMarkerAlt className="w-4 h-4" />
                  <span className="hidden md:inline">Live Tracking</span><span className="md:hidden">Track</span>
                </button>
                <button
                  onClick={() => selectedTask && handleDeleteTask(selectedTask._id)}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium hover:opacity-90 transition-colors flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 text-sm md:text-base whitespace-nowrap"
                >
                  <FaTrash className="w-4 h-4" />
                  <span className="hidden md:inline">Delete Task</span><span className="md:hidden">Delete</span>
                </button>
              </div>
            </div>

            {/* Main Content - Three Panel Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Contact Information */}
              <div className="hidden lg:block w-72 xl:w-80 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
                {(() => {
                  // Prioritize customer's associated contact from customer creation
                  // For HubSpot tasks, check task data directly
                  const displayName = taskCustomerDetails?.associatedContactName ||
                    selectedTask.associatedContactName ||
                    taskCustomerDetails?.name ||
                    selectedTask.customerName ||
                    (selectedTask.source === 'hubspot' ? (selectedTask.customerName || selectedTask.associatedContactName) : '') ||
                    '';
                  const displayEmail = taskCustomerDetails?.associatedContactEmail ||
                    selectedTask.associatedContactEmail ||
                    taskCustomerDetails?.email ||
                    selectedTask.customerEmail ||
                    (selectedTask.source === 'hubspot' ? (selectedTask.customerEmail || selectedTask.associatedContactEmail) : '') ||
                    '';
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
                              // Focus typing pad after a short delay to ensure tab is active
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
                              // Prioritize associated contact email from customer creation
                              // For HubSpot tasks, check task data directly
                              const email = taskCustomerDetails?.associatedContactEmail ||
                                taskCustomerDetails?.email ||
                                displayEmail ||
                                selectedTask.associatedContactEmail ||
                                selectedTask.customerEmail ||
                                (selectedTask.source === 'hubspot' && selectedTask.customerEmail) ||
                                '';
                              if (email) {
                                window.location.href = `mailto:${email}`

                                // Save email activity to backend so "Email sent" shows in activities
                                try {
                                  if (selectedTask && selectedTask._id) {
                                    const currentNotes = selectedTask.notes || ''
                                    const activityNote = `[${formatActivityDateTime(new Date())}] Email: Sent to ${email}`
                                    const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                    if (selectedTask.isVisitTarget) {
                                      await updateVisitTarget(selectedTask._id, { notes: updatedNotes })
                                      const updatedRes = await getVisitTarget(selectedTask._id)
                                      if (updatedRes.success && updatedRes.data) setSelectedTask(prev => ({ ...prev, notes: updatedNotes, ...updatedRes.data }))
                                    } else {
                                      await updateFollowUp(selectedTask._id, { notes: updatedNotes })
                                      const updatedRes = await getFollowUp(selectedTask._id)
                                      if (updatedRes.success) setSelectedTask(updatedRes.data)
                                      else setSelectedTask(prev => ({ ...prev, notes: updatedNotes }))
                                    }
                                    setTaskActivities(parseNotesToActivities(updatedNotes))
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
                              // Prioritize phone from customer details
                              // For HubSpot tasks, check task data directly
                              const phone = taskCustomerDetails?.phone ||
                                selectedTask.customerPhone ||
                                (selectedTask.source === 'hubspot' && selectedTask.customerPhone) ||
                                '';
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

                                    // Save call activity to backend
                                    try {
                                      if (selectedTask && selectedTask._id) {
                                        const currentNotes = selectedTask.notes || ''
                                        const activityNote = `[${formatActivityDateTime(new Date())}] Call: Called ${phone}`
                                        const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                        await updateFollowUp(selectedTask._id, {
                                          notes: updatedNotes
                                        })

                                        // Add to activities
                                        const newActivity = {
                                          type: 'Call',
                                          content: `Called ${phone}`,
                                          date: new Date().toISOString(),
                                          createdAt: new Date().toISOString()
                                        }
                                        setTaskActivities([...taskActivities, newActivity])

                                        // Reload task to get updated push status
                                        const updatedRes = await getFollowUp(selectedTask._id)
                                        if (updatedRes.success) {
                                          setSelectedTask(updatedRes.data)
                                        } else {
                                          // Fallback: Update selectedTask manually
                                          const updatedTask = { ...selectedTask, notes: updatedNotes }
                                          setSelectedTask(updatedTask)
                                        }

                                        // Reload tasks list to update push button status
                                        await loadTasks()
                                      }
                                    } catch (e) {
                                      console.error('Error saving call activity:', e)
                                    }
                                  } else if (result.isDenied) {
                                    // Open WhatsApp with phone number (remove any non-digit characters)
                                    const cleanPhone = phone.replace(/\D/g, '')
                                    window.open(`https://wa.me/${cleanPhone}`, '_blank')

                                    // Save WhatsApp activity to backend
                                    try {
                                      if (selectedTask && selectedTask._id) {
                                        const currentNotes = selectedTask.notes || ''
                                        const activityNote = `[${formatActivityDateTime(new Date())}] WhatsApp: Messaged ${phone}`
                                        const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                        await updateFollowUp(selectedTask._id, {
                                          notes: updatedNotes
                                        })

                                        // Add to activities
                                        const newActivity = {
                                          type: 'WhatsApp',
                                          content: `WhatsApp message to ${phone}`,
                                          date: new Date().toISOString(),
                                          createdAt: new Date().toISOString()
                                        }
                                        setTaskActivities([...taskActivities, newActivity])

                                        // Reload task to get updated push status
                                        const updatedRes = await getFollowUp(selectedTask._id)
                                        if (updatedRes.success) {
                                          setSelectedTask(updatedRes.data)
                                        } else {
                                          // Fallback: Update selectedTask manually
                                          const updatedTask = { ...selectedTask, notes: updatedNotes }
                                          setSelectedTask(updatedTask)
                                        }

                                        // Reload tasks list to update push button status
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
                              // Filter activities to show only tasks
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FaCalendarAlt className="w-4 h-4" />
                            Task
                          </button>
                          <button
                            onClick={() => {
                              setShowMeetingModal(true)
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
                          {(selectedTask.customerPhone || taskCustomerDetails?.phone || (selectedTask.source === 'hubspot' && selectedTask.customerPhone)) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                              <p className="text-sm text-gray-900">
                                {taskCustomerDetails?.phone ||
                                  selectedTask.customerPhone ||
                                  (selectedTask.source === 'hubspot' ? selectedTask.customerPhone : '') ||
                                  '—'}
                              </p>
                            </div>
                          )}
                          {(taskCustomerDetails?.company || selectedTask.customer?.company || selectedTask.associatedCompanyName) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Company</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.company || selectedTask.customer?.company || selectedTask.associatedCompanyName || '—'}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.address || selectedTask.customer?.address) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Address</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.address || selectedTask.customer?.address || '—'}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.city || selectedTask.customer?.city) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">City</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.city || selectedTask.customer?.city || '—'}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.state || selectedTask.customer?.state) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">State</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.state || selectedTask.customer?.state || '—'}</p>
                            </div>
                          )}
                          {(taskCustomerDetails?.postcode || taskCustomerDetails?.pincode || selectedTask.customer?.postcode || selectedTask.customer?.pincode) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Pincode</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.postcode || taskCustomerDetails?.pincode || selectedTask.customer?.postcode || selectedTask.customer?.pincode || '—'}</p>
                            </div>
                          )}
                          {(() => {
                            // Extract name from task description if it's a HubSpot task and name is not available
                            let customerName = taskCustomerDetails?.name || selectedTask.customerName || displayName || ''

                            // If name is missing or looks like a HubSpot Task ID, try to extract from description
                            if ((!customerName || customerName.includes('HubSpot Task')) && selectedTask.description) {
                              const desc = selectedTask.description
                              const nameMatch = desc.match(/(?:follow up|call|email|meeting|visit|task).*?with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                                desc.match(/(?:follow up|call|email|meeting|visit|task)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                                desc.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
                              if (nameMatch && nameMatch[1]) {
                                customerName = nameMatch[1].trim()
                              }
                            }

                            // Don't show if it's still a HubSpot Task ID
                            if (!customerName || customerName.includes('HubSpot Task')) return null

                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Customer</p>
                                <p className="text-sm text-gray-900">{customerName}</p>
                              </div>
                            )
                          })()}
                          {(taskCustomerDetails?.associatedCompanyName || selectedTask.associatedCompanyName) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Associated Company</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.associatedCompanyName || selectedTask.associatedCompanyName || '—'}</p>
                            </div>
                          )}
                          {(() => {
                            // Show Associated Contact from customer creation (if exists) - always show if available
                            let associatedContactName = taskCustomerDetails?.associatedContactName ||
                              selectedTask.associatedContactName ||
                              (selectedTask.customer && typeof selectedTask.customer === 'object' ? selectedTask.customer.associatedContactName : '') ||
                              '';
                            const associatedContactEmail = taskCustomerDetails?.associatedContactEmail ||
                              selectedTask.associatedContactEmail ||
                              (selectedTask.customer && typeof selectedTask.customer === 'object' ? selectedTask.customer.associatedContactEmail : '') ||
                              '';

                            // If name is missing or looks like a HubSpot Task ID, try to extract from description
                            if ((!associatedContactName || associatedContactName.includes('HubSpot Task')) && selectedTask.description) {
                              const desc = selectedTask.description
                              const nameMatch = desc.match(/(?:follow up|call|email|meeting|visit|task).*?with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                                desc.match(/(?:follow up|call|email|meeting|visit|task)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i) ||
                                desc.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
                              if (nameMatch && nameMatch[1]) {
                                associatedContactName = nameMatch[1].trim()
                              }
                            }

                            // Don't show if it's still a HubSpot Task ID or empty
                            if ((!associatedContactName || associatedContactName.includes('HubSpot Task')) && !associatedContactEmail) return null;

                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Associated Contact</p>
                                <p className="text-sm text-gray-900">{associatedContactName && !associatedContactName.includes('HubSpot Task') ? associatedContactName : '—'}</p>
                                {associatedContactEmail && (
                                  <p className="text-xs text-gray-500 mt-1">{associatedContactEmail}</p>
                                )}
                              </div>
                            );
                          })()}
                          {(() => {
                            // Show assigned salesman - prioritize HubSpot owner name, then salesman name
                            const hubspotOwnerName = (selectedTask.hubspot_owner_name || '').trim();
                            const salesmanName = (selectedTask.salesman?.name || '').trim();
                            const salesmanEmail = (selectedTask.salesman?.email || '').trim();
                            const displayName = hubspotOwnerName || salesmanName || salesmanEmail || '';
                            const displayEmail = selectedTask.hubspot_owner_email || salesmanEmail || '';

                            if (!displayName) return null;

                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  {hubspotOwnerName ? 'HubSpot Owner' : 'Contact Owner'}
                                </p>
                                <p className="text-sm text-gray-900">
                                  {displayName}
                                  {displayEmail && displayEmail !== displayName && (
                                    <span className="ml-2 text-xs text-gray-500">({displayEmail})</span>
                                  )}
                                </p>
                              </div>
                            );
                          })()}
                          {(taskCustomerDetails?.lastContact || selectedTask.customer?.lastContact) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Last Contact</p>
                              <p className="text-sm text-gray-900">
                                {taskCustomerDetails?.lastContact
                                  ? new Date(taskCustomerDetails.lastContact).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                  : selectedTask.customer?.lastContact
                                    ? new Date(selectedTask.customer.lastContact).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                    : '—'}
                              </p>
                            </div>
                          )}
                          {(taskCustomerDetails?.lastEngagement || selectedTask.customer?.lastEngagement) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Last Engagement</p>
                              <p className="text-sm text-gray-900">
                                {taskCustomerDetails?.lastEngagement
                                  ? new Date(taskCustomerDetails.lastEngagement).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                  : selectedTask.customer?.lastEngagement
                                    ? new Date(selectedTask.customer.lastEngagement).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                    : '—'}
                              </p>
                            </div>
                          )}
                          {(taskCustomerDetails?.status || selectedTask.customer?.status) && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Lead Status</p>
                              <p className="text-sm text-gray-900">{taskCustomerDetails?.status || selectedTask.customer?.status || '—'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>

              {/* Center Panel - Task Details with Tabs */}
              <div className="flex-1 bg-white flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setModalActiveTab('overview')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'overview'
                        ? 'border-gray-600 text-gray-800'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setModalActiveTab('activities')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'activities'
                        ? 'border-gray-600 text-gray-800'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => setModalActiveTab('contact')}
                      className={`lg:hidden py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'contact'
                        ? 'border-gray-600 text-gray-800'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Contact
                    </button>
                    <button
                      onClick={() => setModalActiveTab('associations')}
                      className={`lg:hidden py-4 px-1 border-b-2 font-medium text-sm transition-colors ${modalActiveTab === 'associations'
                        ? 'border-gray-600 text-gray-800'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      Associations
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className={modalActiveTab === 'activities' ? 'flex-1 flex flex-col overflow-hidden p-6' : 'flex-1 overflow-y-auto p-6'}>
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
                            <p className="text-sm font-medium text-gray-900">{getTaskTypeLabel(selectedTask.hs_task_type || selectedTask.type, selectedTask.isVisitTarget)}</p>
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
                          {selectedTask.hubspotTaskId && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">HubSpot Task ID</p>
                              <p className="text-sm font-medium text-gray-900 font-mono">{selectedTask.hubspotTaskId}</p>
                            </div>
                          )}
                          {selectedTask.hs_task_queue && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Queue</p>
                              <p className="text-sm font-medium text-gray-900">{selectedTask.hs_task_queue}</p>
                            </div>
                          )}
                          {selectedTask.hs_task_reminder && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Reminder</p>
                              <p className="text-sm font-medium text-gray-900">{selectedTask.hs_task_reminder}</p>
                            </div>
                          )}
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
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedTask.updatedAt
                                ? `${new Date(selectedTask.updatedAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} ${new Date(selectedTask.updatedAt).toLocaleTimeString('en-GB', {
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
                          {selectedTask.notes && (() => {
                            const parsedActivities = parseNotesToActivities(selectedTask.notes)
                            return (
                              <div>
                                <p className="text-xs text-gray-500 mb-3">Activity History</p>
                                {parsedActivities.length > 0 ? (
                                  <div className="space-y-3">
                                    {parsedActivities.map((activity, idx) => {
                                      const d = activity.date ? new Date(activity.date) : new Date()
                                      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                                      return (
                                        <div
                                          key={idx}
                                          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${activity.type === 'Note' ? 'bg-blue-100 text-blue-800' :
                                                  activity.type === 'Meeting' ? 'bg-purple-100 text-purple-800' :
                                                    activity.type === 'Email' ? 'bg-green-100 text-green-800' :
                                                      activity.type === 'Call' ? 'bg-orange-100 text-orange-800' :
                                                        activity.type === 'WhatsApp' ? 'bg-green-100 text-green-800' :
                                                          'bg-gray-100 text-gray-800'
                                                  }`}>
                                                  {activity.type === 'Note' && <FaStickyNote className="w-3 h-3 mr-1" />}
                                                  {activity.type === 'Meeting' && <FaCalendarAlt className="w-3 h-3 mr-1" />}
                                                  {activity.type === 'Email' && <FaEnvelope className="w-3 h-3 mr-1" />}
                                                  {activity.type === 'Call' && <FaPhone className="w-3 h-3 mr-1" />}
                                                  {activity.type === 'WhatsApp' && <FaPhone className="w-3 h-3 mr-1" />}
                                                  {activity.type}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {dateStr} {timeStr}
                                                </span>
                                              </div>
                                              <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                                {activity.content}
                                              </p>
                                              {activity.type === 'Meeting' && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  {activity.meetLink && (
                                                    <a href={activity.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                                                      Join Google Meet
                                                    </a>
                                                  )}
                                                  {activity.link && (
                                                    <a href={activity.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                      <FaCalendarAlt className="w-3 h-3" /> Open Calendar
                                                    </a>
                                                  )}
                                                </div>
                                              )}
                                              {activity.type !== 'Meeting' && activity.link && (
                                                <a href={activity.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                  Open Link
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No activities recorded yet</p>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* Related Items */}
                      {(selectedTask.relatedQuotation || selectedTask.relatedSample || selectedTask.relatedOrder || selectedTask.visitTarget) && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-4">Related Items</h3>
                          <div className="space-y-2">
                            {selectedTask.relatedQuotation && (
                              <div className="flex items-center gap-2">
                                <FaFileAlt className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Quotation: {selectedTask.relatedQuotation?.quotationNumber || selectedTask.relatedQuotation}
                                </span>
                              </div>
                            )}
                            {selectedTask.relatedSample && (
                              <div className="flex items-center gap-2">
                                <FaFlask className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Sample: {selectedTask.relatedSample?.sampleNumber || selectedTask.relatedSample}
                                </span>
                              </div>
                            )}
                            {selectedTask.relatedOrder && (
                              <div className="flex items-center gap-2">
                                <FaShoppingCart className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Order: {selectedTask.relatedOrder?.soNumber || selectedTask.relatedOrder}
                                </span>
                              </div>
                            )}
                            {selectedTask.visitTarget && (
                              <div className="flex items-center gap-2">
                                <FaMapMarkerAlt className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  Visit Target: {selectedTask.visitTarget?.name || selectedTask.visitTarget}
                                </span>
                              </div>
                            )}
                          </div>
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
                                      year: 'numeric'
                                    })} ${new Date(selectedTask.completedDate).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false
                                    })} GMT+5`
                                    : selectedTask.dueDate
                                      ? `${new Date(selectedTask.dueDate).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })} ${new Date(selectedTask.dueDate).toLocaleTimeString('en-GB', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                      })} GMT+5`
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
                    <>
                      {/* Fixed Header and Typing Box - No Scroll */}
                      <div className="flex-shrink-0 space-y-4 pb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Activities</h3>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                placeholder="Search activities"
                                value={activitiesSearch}
                                onChange={(e) => setActivitiesSearch(e.target.value)}
                                className="pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <button
                              onClick={() => {
                                // Focus typing pad
                                setTimeout(() => {
                                  if (noteInputRef.current) {
                                    noteInputRef.current.focus()
                                  }
                                }, 100)
                              }}
                              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Create activities
                            </button>
                          </div>
                        </div>

                        {/* Typing Pad - Fixed at Top, No Scroll */}
                        <div className="pb-4 border-b border-gray-200">
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <textarea
                                ref={noteInputRef}
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (noteInput.trim()) {
                                      // Handle note save in separate async function
                                      const handleSaveNote = async () => {
                                        const noteContent = noteInput.trim()
                                        const newActivity = {
                                          type: 'Note',
                                          content: noteContent,
                                          date: new Date().toISOString(),
                                          createdAt: new Date().toISOString()
                                        }
                                        const updatedActivities = [...taskActivities, newActivity]
                                        setTaskActivities(updatedActivities)
                                        setNoteInput('')

                                        // Save to backend
                                        try {
                                          if (selectedTask && selectedTask._id) {
                                            const currentNotes = selectedTask.notes || ''
                                            const activityNote = `[${formatActivityDateTime(new Date())}] Note: ${noteContent}`
                                            const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                            await updateFollowUp(selectedTask._id, {
                                              notes: updatedNotes
                                            })

                                            // Reload task to get updated push status and refresh activities
                                            const updatedRes = await getFollowUp(selectedTask._id)
                                            if (updatedRes.success) {
                                              setSelectedTask(updatedRes.data)
                                              setTaskActivities(parseNotesToActivities(updatedNotes))
                                            } else {
                                              // Fallback: Update selectedTask manually
                                              const updatedTask = { ...selectedTask, notes: updatedNotes }
                                              setSelectedTask(updatedTask)
                                            }

                                            // Reload tasks list to update push button status
                                            await loadTasks()
                                          }
                                        } catch (e) {
                                          console.error('Error saving note:', e)
                                        }

                                        Swal.fire({
                                          icon: 'success',
                                          title: 'Note Added!',
                                          text: 'Note has been added successfully',
                                          confirmButtonColor: '#1f2937',
                                          timer: 1500,
                                          timerProgressBar: true
                                        })
                                      }
                                      handleSaveNote()
                                    }
                                  }
                                }}
                                placeholder="Type a note and press Enter to add..."
                                rows={3}
                                className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
                                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                              />
                            </div>
                            <button
                              onClick={async () => {
                                if (noteInput.trim()) {
                                  // Add note to activities
                                  const newActivity = {
                                    type: 'Note',
                                    content: noteInput.trim(),
                                    date: new Date().toISOString(),
                                    createdAt: new Date().toISOString()
                                  }
                                  const updatedActivities = [...taskActivities, newActivity]
                                  setTaskActivities(updatedActivities)
                                  const noteContent = noteInput.trim()
                                  setNoteInput('')

                                  // Save to backend
                                  try {
                                    if (selectedTask && selectedTask._id) {
                                      const currentNotes = selectedTask.notes || ''
                                      const activityNote = `[${formatActivityDateTime(new Date())}] Note: ${noteContent}`
                                      const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                                      await updateFollowUp(selectedTask._id, {
                                        notes: updatedNotes
                                      })

                                      // Reload task to get updated push status
                                      const updatedRes = await getFollowUp(selectedTask._id)
                                      if (updatedRes.success) {
                                        setSelectedTask(updatedRes.data)
                                      } else {
                                        // Fallback: Update selectedTask manually
                                        const updatedTask = { ...selectedTask, notes: updatedNotes }
                                        setSelectedTask(updatedTask)
                                      }

                                      // Reload tasks list to update push button status
                                      await loadTasks()
                                    }
                                  } catch (e) {
                                    console.error('Error saving note:', e)
                                    Swal.fire({
                                      icon: 'error',
                                      title: 'Error',
                                      text: 'Failed to save note. Please try again.',
                                      confirmButtonColor: '#e9931c'
                                    })
                                    return
                                  }

                                  Swal.fire({
                                    icon: 'success',
                                    title: 'Note Added!',
                                    text: 'Note has been added successfully',
                                    confirmButtonColor: '#1f2937',
                                    timer: 1500,
                                    timerProgressBar: true
                                  })
                                }
                              }}
                              disabled={!noteInput.trim()}
                              className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                              style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                            >
                              <FaStickyNote className="w-4 h-4" />
                              <span className="text-sm font-medium">Add</span>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">Press Enter to add note, or click Add button</p>
                        </div>
                      </div>

                      {/* Activities List - Scrollable Only */}
                      <div className="flex-1 overflow-y-auto pr-2 pt-4 min-h-0">
                        <div className="space-y-4">
                          {(() => {
                            // Combine all activities into one array
                            const allActivities = []

                            // Add current task as activity
                            if (selectedTask) {
                              allActivities.push({
                                type: 'Task',
                                id: selectedTask._id,
                                content: selectedTask.description || `Follow up with ${selectedTask.customerName || selectedTask.associatedContactName || 'Contact'}`,
                                date: selectedTask.dueDate || selectedTask.createdAt || new Date(),
                                task: selectedTask,
                                isCurrentTask: true
                              })
                            }

                            // Add related tasks as activities
                            relatedTasks.forEach((relatedTask) => {
                              allActivities.push({
                                type: 'Task',
                                id: relatedTask._id,
                                content: relatedTask.description || relatedTask.hs_task_subject || `Follow up with ${relatedTask.customerName || relatedTask.associatedContactName || 'Contact'}`,
                                date: relatedTask.dueDate || relatedTask.createdAt || new Date(),
                                task: relatedTask,
                                isRelatedTask: true
                              })
                            })

                            // Add notes, meetings, calls, emails from taskActivities
                            taskActivities.forEach((activity) => {
                              allActivities.push({
                                ...activity,
                                date: activity.date || activity.createdAt || new Date()
                              })
                            })

                            // Sort by date/time (newest first) - ensure proper date parsing
                            allActivities.sort((a, b) => {
                              let dateA = new Date(0)
                              let dateB = new Date(0)

                              // Parse dateA
                              if (a.date) {
                                dateA = new Date(a.date)
                                if (isNaN(dateA.getTime())) {
                                  dateA = new Date(0)
                                }
                              } else if (a.createdAt) {
                                dateA = new Date(a.createdAt)
                                if (isNaN(dateA.getTime())) {
                                  dateA = new Date(0)
                                }
                              }

                              // Parse dateB
                              if (b.date) {
                                dateB = new Date(b.date)
                                if (isNaN(dateB.getTime())) {
                                  dateB = new Date(0)
                                }
                              } else if (b.createdAt) {
                                dateB = new Date(b.createdAt)
                                if (isNaN(dateB.getTime())) {
                                  dateB = new Date(0)
                                }
                              }

                              // Sort: newest first (larger timestamp first)
                              return dateB.getTime() - dateA.getTime()
                            })

                            // Apply search filter if search term exists
                            let filteredActivities = allActivities
                            if (activitiesSearch.trim()) {
                              const searchTerm = activitiesSearch.trim().toLowerCase()
                              filteredActivities = allActivities.filter(activity => {
                                // Search in content
                                const content = (activity.content || activity.note || activity.description || '').toLowerCase()
                                // Search in type
                                const type = (activity.type || '').toLowerCase()
                                // Search in task description if it's a task
                                const taskDesc = activity.task ? (activity.task.description || activity.task.hs_task_subject || '').toLowerCase() : ''
                                // Search in date
                                const dateStr = activity.date ? new Date(activity.date).toLocaleString('en-GB').toLowerCase() : ''

                                return content.includes(searchTerm) ||
                                  type.includes(searchTerm) ||
                                  taskDesc.includes(searchTerm) ||
                                  dateStr.includes(searchTerm)
                              })
                            }

                            if (filteredActivities.length === 0) {
                              return selectedTask ? (
                                <div className="text-center py-8">
                                  <FaStickyNote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                  <p className="text-gray-500 text-sm">
                                    {activitiesSearch.trim() ? 'No activities found matching your search' : 'No activities yet'}
                                  </p>
                                  {!activitiesSearch.trim() && (
                                    <button
                                      onClick={() => {
                                        if (noteInputRef.current) {
                                          noteInputRef.current.focus()
                                        }
                                      }}
                                      className="mt-3 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                      Add your first note
                                    </button>
                                  )}
                                </div>
                              ) : null
                            }

                            return filteredActivities.map((activity, index) => {
                              // Render Task type
                              if (activity.type === 'Task') {
                                const task = activity.task || selectedTask
                                return (
                                  <div
                                    key={activity.id || `task-${index}`}
                                    className={`flex items-start gap-3 ${activity.isRelatedTask ? 'cursor-pointer' : ''}`}
                                    onClick={activity.isRelatedTask ? async () => {
                                      await handleTaskClick(task)
                                    } : undefined}
                                  >
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <FaBriefcase className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`bg-gray-100 rounded-lg p-3 ${activity.isRelatedTask ? 'hover:bg-gray-200 transition-colors' : ''}`}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-medium text-gray-700">
                                            {task?.type || task?.hs_task_type || 'Task'}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {activity.date
                                              ? `${new Date(activity.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short'
                                              })} ${new Date(activity.date).toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}`
                                              : '—'}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-900 mb-1">{activity.content}</p>
                                        {activity.isRelatedTask && task && (
                                          <div className="flex items-center gap-2 mt-2">
                                            {task.status && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                                                {task.status}
                                              </span>
                                            )}
                                            {task.priority && (
                                              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                                                {task.priority}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Render Note type
                              if (activity.type === 'Note') {
                                return (
                                  <div key={`note-${index}`} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <FaStickyNote className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-gray-100 rounded-lg p-3 hover:bg-gray-200 transition-colors cursor-pointer"
                                        onClick={() => {
                                          Swal.fire({
                                            title: 'Note',
                                            html: `
                                            <div class="text-left">
                                              <p class="text-sm text-gray-600 mb-2">
                                                <strong>Date:</strong> ${activity.date ? new Date(activity.date).toLocaleString('en-GB') : 'N/A'}
                                              </p>
                                              <p class="text-sm text-gray-900">${activity.content || activity.note || '—'}</p>
                                            </div>
                                          `,
                                            confirmButtonColor: '#e9931c'
                                          })
                                        }}
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-medium text-gray-700">Note</span>
                                          <span className="text-xs text-gray-500">
                                            {activity.date
                                              ? `${new Date(activity.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short'
                                              })} ${new Date(activity.date).toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}`
                                              : new Date().toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{activity.content || activity.note || '—'}</p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Render Meeting type
                              if (activity.type === 'Meeting') {
                                return (
                                  <div key={`meeting-${index}`} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                      <FaCalendarAlt className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-gray-100 rounded-lg p-3 hover:bg-gray-200 transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-medium text-gray-700">Meeting</span>
                                          <span className="text-xs text-gray-500">
                                            {activity.date
                                              ? `${new Date(activity.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short'
                                              })} ${new Date(activity.date).toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}`
                                              : new Date().toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-900 mb-2">{activity.content || 'Meeting'}</p>
                                        <div className="flex flex-wrap gap-2">
                                          {activity.meetLink && (
                                            <a
                                              href={activity.meetLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              Join Google Meet
                                            </a>
                                          )}
                                          {activity.link && (
                                            <a
                                              href={activity.link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-xs font-medium hover:bg-gray-300 transition-colors"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              Open Google Calendar
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Render Email, Call, WhatsApp types
                              if (activity.type === 'Email' || activity.type === 'Call' || activity.type === 'WhatsApp') {
                                const iconMap = {
                                  Email: FaEnvelope,
                                  Call: FaPhone,
                                  WhatsApp: FaPhone
                                }
                                const Icon = iconMap[activity.type] || FaStickyNote

                                return (
                                  <div key={`${activity.type}-${index}`} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <Icon className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="bg-gray-100 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs font-medium text-gray-700">{activity.type}</span>
                                          <span className="text-xs text-gray-500">
                                            {activity.date
                                              ? `${new Date(activity.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short'
                                              })} ${new Date(activity.date).toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}`
                                              : new Date().toLocaleTimeString('en-GB', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                              })}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-900">{activity.content || activity.type}</p>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              return null
                            })
                          })()}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Mobile Mobile Only - Contact Info Tab Content */}
                  {modalActiveTab === 'contact' && (
                    <div className="lg:hidden space-y-6">
                      {/* This is the same content from Left Panel but shown as a tab on mobile */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
                        {/* Reusing the logic from the left panel rendering... */}
                        {(() => {
                          const contact = selectedTask.associatedContact || selectedTask.customer
                          const name = contact?.name || contact?.firstName || selectedTask.associatedContactName || selectedTask.customerName || 'Contact'
                          const email = contact?.email || selectedTask.associatedContactEmail || selectedTask.customerEmail
                          const phone = contact?.phone || selectedTask.associatedContactPhone || selectedTask.customerPhone
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
                                  {name[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{name}</p>
                                  <p className="text-sm text-gray-500">{email || 'No email'}</p>
                                </div>
                              </div>
                              <div className="pt-4 border-t border-gray-100 space-y-3">
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
                                  <p className="text-sm font-medium">{phone || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase tracking-wider">Company</p>
                                  <p className="text-sm font-medium">{contact?.company || '—'}</p>
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
                      {/* Associated Companies */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Associations</h3>
                        <p className="text-sm text-gray-500 mb-2 font-medium">Companies</p>
                        {selectedTask.customer?.company ? (
                          <div className="p-3 bg-gray-50 rounded border border-gray-100 mb-4 font-medium text-sm">
                            {selectedTask.customer.company}
                          </div>
                        ) : <p className="text-xs text-gray-400 mb-4">No companies associated</p>}

                        <p className="text-sm text-gray-500 mb-2 font-medium">Deals</p>
                        <p className="text-xs text-gray-400 mb-4">No deals associated</p>

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
                      Companies ({(() => {
                        // Check all possible sources for company name - prioritize customer's associatedCompanyName
                        const companyName = taskCustomerDetails?.associatedCompanyName ||
                          taskCustomerDetails?.company ||
                          selectedTask.associatedCompanyName ||
                          (selectedTask.customer && typeof selectedTask.customer === 'object' ? (selectedTask.customer.associatedCompanyName || selectedTask.customer.company) : '') ||
                          '';
                        return companyName && companyName.trim() ? 1 : 0;
                      })()})
                    </h3>
                  </div>
                  {(() => {
                    // Get company name from all possible sources - prioritize customer's associatedCompanyName from customer creation
                    const companyName = taskCustomerDetails?.associatedCompanyName ||
                      taskCustomerDetails?.company ||
                      selectedTask.associatedCompanyName ||
                      (selectedTask.customer && typeof selectedTask.customer === 'object' ? (selectedTask.customer.associatedCompanyName || selectedTask.customer.company) : '') ||
                      '';
                    const companyDomain = selectedTask.associatedCompanyDomain || taskCustomerDetails?.associatedCompanyDomain || '';
                    const companyPhone = taskCustomerDetails?.phone || selectedTask.customerPhone || '';

                    if (!companyName || !companyName.trim()) {
                      return <p className="text-sm text-gray-500">No companies associated</p>;
                    }

                    return (
                      <div className="space-y-4">
                        <div className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-semibold text-gray-600">
                                {companyName.trim()[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {companyName.trim()}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">Primary</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            {companyDomain && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Company Domain Name</p>
                                <p className="text-gray-900">{companyDomain}</p>
                              </div>
                            )}
                            {companyPhone && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                                <p className="text-gray-900">{companyPhone}</p>
                              </div>
                            )}
                          </div>
                          <button className="mt-3 text-xs text-gray-700 hover:underline">
                            Add association label
                          </button>
                        </div>
                        <button className="text-sm text-gray-700 hover:underline">
                          View all associated Companies
                        </button>
                      </div>
                    );
                  })()}

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Deals ({taskQuotations.length + hubspotDeals.length})</h3>
                    {(taskQuotations.length > 0 || hubspotDeals.length > 0) ? (
                      <div className="space-y-3">
                        {/* HubSpot Deals */}
                        {hubspotDeals.map((deal) => (
                          <div
                            key={deal.id || deal.dealId}
                            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer bg-blue-50"
                            onClick={() => {
                              Swal.fire({
                                title: deal.properties?.dealname || 'HubSpot Deal',
                                html: `
                                  <div class="text-left" style="font-family: Inter, system-ui, -apple-system, sans-serif;">
                                    <div class="space-y-2 text-sm">
                                      <div class="flex justify-between">
                                        <span class="text-gray-600">Deal Name:</span>
                                        <span class="text-gray-900 font-medium">${deal.properties?.dealname || '—'}</span>
                                      </div>
                                      ${deal.properties?.amount ? `
                                        <div class="flex justify-between">
                                          <span class="text-gray-600">Amount:</span>
                                          <span class="text-gray-900 font-medium">£${Number(deal.properties.amount || 0).toFixed(2)}</span>
                                        </div>
                                      ` : ''}
                                      ${deal.properties?.dealstage ? `
                                        <div class="flex justify-between">
                                          <span class="text-gray-600">Stage:</span>
                                          <span class="text-gray-900 font-medium">${deal.properties.dealstage}</span>
                                        </div>
                                      ` : ''}
                                      ${deal.properties?.pipeline ? `
                                        <div class="flex justify-between">
                                          <span class="text-gray-600">Pipeline:</span>
                                          <span class="text-gray-900 font-medium">${deal.properties.pipeline}</span>
                                        </div>
                                      ` : ''}
                                      ${deal.properties?.closedate ? `
                                        <div class="flex justify-between">
                                          <span class="text-gray-600">Close Date:</span>
                                          <span class="text-gray-900 font-medium">${new Date(deal.properties.closedate).toLocaleDateString('en-GB')}</span>
                                        </div>
                                      ` : ''}
                                    </div>
                                  </div>
                                `,
                                confirmButtonColor: '#e9931c',
                                width: '500px'
                              })
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{deal.properties?.dealname || 'HubSpot Deal'}</p>
                                {deal.properties?.amount && (
                                  <p className="text-xs text-gray-500 mt-1">£{Number(deal.properties.amount || 0).toFixed(2)}</p>
                                )}
                              </div>
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">HubSpot</span>
                            </div>
                          </div>
                        ))}
                        {/* Local Quotations */}
                        {taskQuotations.map((quotation) => (
                          <div
                            key={quotation._id || quotation.id}
                            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={async () => {
                              try {
                                const quotationId = quotation._id || quotation.id
                                const res = await getQuotation(quotationId)
                                if (res.success && res.data) {
                                  const quote = res.data
                                  const itemsHtml = quote.items && quote.items.length > 0
                                    ? quote.items.map((item, idx) => {
                                      const itemQuantity = item.quantity || 1
                                      const itemPrice = item.price || item.unitPrice || 0
                                      const itemTotal = item.total || item.lineTotal || (itemQuantity * itemPrice)
                                      const itemTotalFormatted = Number(itemTotal || 0).toFixed(2)
                                      const itemPriceFormatted = Number(itemPrice || 0).toFixed(2)
                                      const discountHtml = item.discount ? `<p class="text-gray-500">Discount: £${Number(item.discount || 0).toFixed(2)}</p>` : ''

                                      return `
                                          <div class="text-xs text-gray-600 border-b border-gray-100 pb-2">
                                            <div class="flex justify-between items-start">
                                              <div class="flex-1">
                                                <p class="font-medium text-gray-900">${item.productName || item.name || 'Product'}</p>
                                                <p class="text-gray-500">Qty: ${itemQuantity} × £${itemPriceFormatted}</p>
                                                ${discountHtml}
                                              </div>
                                              <p class="font-medium text-gray-900">£${itemTotalFormatted}</p>
                                            </div>
                                          </div>
                                        `
                                    }).join('')
                                    : '<p class="text-xs text-gray-500 mt-2">No items</p>'

                                  const itemsSectionHtml = quote.items && quote.items.length > 0
                                    ? `
                                      <div class="mt-3 border-t border-gray-200 pt-3">
                                        <p class="text-xs font-semibold text-gray-700 mb-2">Items:</p>
                                        <div class="space-y-2">
                                          ${itemsHtml}
                                        </div>
                                      </div>
                                    `
                                    : itemsHtml

                                  Swal.fire({
                                    title: quote.quotationNumber || `Quote #${quotationId?.slice(-6)}`,
                                    html: `
                                      <div class="text-left" style="font-family: Inter, system-ui, -apple-system, sans-serif;">
                                        <div class="space-y-2 text-sm">
                                          <div class="flex justify-between">
                                            <span class="text-gray-600">Customer:</span>
                                            <span class="text-gray-900 font-medium">${quote.customerName || '—'}</span>
                                          </div>
                                          ${quote.customerEmail ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Email:</span>
                                              <span class="text-gray-900">${quote.customerEmail}</span>
                                            </div>
                                          ` : ''}
                                          ${quote.customerPhone ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Phone:</span>
                                              <span class="text-gray-900">${quote.customerPhone}</span>
                                            </div>
                                          ` : ''}
                                          ${quote.customerAddress ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Address:</span>
                                              <span class="text-gray-900">${quote.customerAddress}</span>
                                            </div>
                                          ` : ''}
                                          <div class="flex justify-between">
                                            <span class="text-gray-600">Status:</span>
                                            <span class="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs">${quote.status || 'Pending'}</span>
                                          </div>
                                          ${quote.validUntil ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Valid Until:</span>
                                              <span class="text-gray-900">${new Date(quote.validUntil).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}</span>
                                            </div>
                                          ` : ''}
                                          ${quote.createdAt ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Created:</span>
                                              <span class="text-gray-900">${new Date(quote.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}</span>
                                            </div>
                                          ` : ''}
                                        </div>
                                        ${itemsSectionHtml}
                                        <div class="mt-4 pt-3 border-t border-gray-200 space-y-1 text-sm">
                                          ${quote.subtotal ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Subtotal:</span>
                                              <span class="text-gray-900">£${Number(quote.subtotal || 0).toFixed(2)}</span>
                                            </div>
                                          ` : ''}
                                          ${quote.discount ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Discount:</span>
                                              <span class="text-gray-900">£${Number(quote.discount || 0).toFixed(2)}</span>
                                            </div>
                                          ` : ''}
                                          ${quote.tax ? `
                                            <div class="flex justify-between">
                                              <span class="text-gray-600">Tax:</span>
                                              <span class="text-gray-900">£${Number(quote.tax || 0).toFixed(2)}</span>
                                            </div>
                                          ` : ''}
                                          <div class="flex justify-between font-semibold pt-2 border-t border-gray-200">
                                            <span class="text-gray-900">Total:</span>
                                            <span class="text-gray-900">£${Number(quote.total || 0).toFixed(2)}</span>
                                          </div>
                                        </div>
                                        ${quote.notes ? `
                                          <div class="mt-4 pt-3 border-t border-gray-200">
                                            <p class="text-xs font-semibold text-gray-700 mb-1">Notes:</p>
                                            <p class="text-sm text-gray-900">${quote.notes}</p>
                                          </div>
                                        ` : ''}
                                      </div>
                                    `,
                                    width: '600px',
                                    confirmButtonColor: '#1f2937',
                                    confirmButtonText: 'Close'
                                  })
                                } else {
                                  Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: res.message || 'Failed to load quotation details',
                                    confirmButtonColor: '#e9931c'
                                  })
                                }
                              } catch (e) {
                                console.error('Error loading quotation:', e)
                                Swal.fire({
                                  icon: 'error',
                                  title: 'Error',
                                  text: 'Error loading quotation details',
                                  confirmButtonColor: '#e9931c'
                                })
                              }
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {quotation.quotationNumber || `Quote #${quotation._id?.slice(-6) || quotation.id?.slice(-6)}`}
                              </span>
                              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
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
                      <p className="text-sm text-gray-500">No deals associated</p>
                    )}
                  </div>

                  {/* Sales Targets Section */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Targets ({salesTargets.length})</h3>
                    {salesTargets.length > 0 ? (
                      <div className="space-y-3">
                        {salesTargets.map((target) => (
                          <div
                            key={target._id || target.id}
                            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900">{target.targetName || 'Target'}</p>
                              <span className={`text-xs px-2 py-1 rounded ${target.status === 'Active' ? 'bg-green-100 text-green-800' :
                                target.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                                  target.status === 'Failed' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {target.status || 'Active'}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              <div className="flex justify-between">
                                <span>Type:</span>
                                <span className="font-medium">{target.targetType || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Progress:</span>
                                <span className="font-medium">{target.currentProgress || 0} / {target.targetValue || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Period:</span>
                                <span className="font-medium">{target.period || '—'}</span>
                              </div>
                              {target.progressPercentage && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-[#e9931c] h-1.5 rounded-full"
                                      style={{ width: `${Math.min(parseFloat(target.progressPercentage), 100)}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{parseFloat(target.progressPercentage)}% complete</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No targets assigned</p>
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

      {/* Note Creation Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-5 overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white rounded-t-lg sm:rounded-lg w-full max-w-[calc(100%-0.5rem)] sm:max-w-md max-h-[72dvh] sm:max-h-[90vh] overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Note</h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target)
                  const noteContent = formData.get('noteContent')
                  const noteDate = formData.get('noteDate')
                  const noteTime = formData.get('noteTime')

                  if (!noteContent) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'Note Required',
                      text: 'Please enter a note',
                      confirmButtonColor: '#e9931c'
                    })
                    return
                  }

                  const noteDateTime = noteDate && noteTime
                    ? new Date(`${noteDate}T${noteTime}`)
                    : new Date()

                  // Add note to activities
                  const newActivity = {
                    type: 'Note',
                    content: noteContent,
                    date: noteDateTime.toISOString(),
                    createdAt: new Date().toISOString()
                  }
                  const updatedActivities = [...taskActivities, newActivity]
                  setTaskActivities(updatedActivities)
                  setShowNoteModal(false)

                  // Save to backend
                  try {
                    if (selectedTask && selectedTask._id) {
                      const currentNotes = selectedTask.notes || ''
                      const activityNote = `[${formatActivityDateTime(noteDateTime)}] Note: ${noteContent}`
                      const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                      if (selectedTask.isVisitTarget) {
                        await updateVisitTarget(selectedTask._id, { notes: updatedNotes })
                        const updatedRes = await getVisitTarget(selectedTask._id)
                        if (updatedRes.success && updatedRes.data) {
                          const vt = updatedRes.data
                          setSelectedTask(prev => ({ ...prev, notes: updatedNotes, ...vt }))
                        }
                      } else {
                        await updateFollowUp(selectedTask._id, { notes: updatedNotes })
                        const updatedRes = await getFollowUp(selectedTask._id)
                        if (updatedRes.success) {
                          setSelectedTask(updatedRes.data)
                        } else {
                          setSelectedTask(prev => ({ ...prev, notes: updatedNotes }))
                        }
                        setTaskActivities(parseNotesToActivities(updatedNotes))
                      }

                      await loadTasks()
                    }
                  } catch (e) {
                    console.error('Error saving note:', e)
                    Swal.fire({
                      icon: 'error',
                      title: 'Error',
                      text: 'Failed to save note. Please try again.',
                      confirmButtonColor: '#e9931c'
                    })
                    return
                  }

                  Swal.fire({
                    icon: 'success',
                    title: 'Note Created!',
                    text: 'Note has been added successfully',
                    confirmButtonColor: '#e9931c',
                    timer: 2000,
                    timerProgressBar: true
                  })
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      name="noteDate"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                    <input
                      type="time"
                      name="noteTime"
                      defaultValue={new Date().toTimeString().slice(0, 5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                    <textarea
                      name="noteContent"
                      rows={5}
                      placeholder="Enter your note here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                      Save Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNoteModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Creation Modal */}
      {/* Start Task Modal with Meter Picture */}
      {showStartTaskModal && taskToStart && (
        <div className="fixed inset-0 bg-white sm:bg-black/50 flex items-start sm:items-center justify-center z-50 p-0 sm:p-4 md:p-5 overflow-hidden sm:overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl max-w-[calc(100%-0.5rem)] sm:max-w-md w-full max-h-[72dvh] sm:max-h-[90vh] overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Start Task</h2>
              <button
                onClick={() => {
                  setShowStartTaskModal(false)
                  setTaskToStart(null)
                  setMeterPicture(null)
                  setMeterReading('')
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Task:</strong> {taskToStart.description || taskToStart.customerName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Customer:</strong> {taskToStart.customerName}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📷 Meter Picture <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleCaptureMeterPicture}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Camera
                  </button>
                  <label
                    htmlFor="meter-picture-upload"
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload
                  </label>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMeterPictureUpload}
                  className="hidden"
                  id="meter-picture-upload"
                />
                <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  {meterPicture ? (
                    <img
                      src={meterPicture}
                      alt="Meter picture"
                      className="max-w-full max-h-full rounded-lg object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-600">No image selected</p>
                      <p className="text-xs text-gray-500 mt-1">Use camera or upload button</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meter Reading (Optional)
                </label>
                <input
                  type="text"
                  value={meterReading}
                  onChange={(e) => setMeterReading(e.target.value)}
                  placeholder="Enter meter reading..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowStartTaskModal(false)
                    setTaskToStart(null)
                    setMeterPicture(null)
                    setMeterReading('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStartTask}
                  disabled={!meterPicture}
                  className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${meterPicture
                    ? 'hover:opacity-90'
                    : 'opacity-50 cursor-not-allowed'
                    }`}
                  style={meterPicture ? { backgroundColor: appTheme.status.success.main } : { backgroundColor: '#9ca3af' }}
                >
                  Start Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMeetingModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-5 overflow-y-auto overflow-x-hidden min-h-[100dvh] sm:min-h-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0">
          <div className="bg-white rounded-t-lg sm:rounded-lg w-full max-w-[calc(100%-0.5rem)] sm:max-w-md max-h-[72dvh] sm:max-h-[90vh] overflow-hidden flex flex-col flex-shrink-0 self-start sm:static my-0 sm:my-auto min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Google Meeting</h3>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target)
                  const meetingTitle = formData.get('meetingTitle')
                  const meetingDate = formData.get('meetingDate')
                  const meetingTime = formData.get('meetingTime')
                  const meetingDuration = formData.get('meetingDuration') || '60'

                  if (!meetingTitle || !meetingDate || !meetingTime) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'Fields Required',
                      text: 'Please fill in all required fields',
                      confirmButtonColor: '#e9931c'
                    })
                    return
                  }

                  const meetingDateTime = new Date(`${meetingDate}T${meetingTime}`)
                  const endDateTime = new Date(meetingDateTime.getTime() + parseInt(meetingDuration) * 60000)

                  // Create Google Calendar link (add Meet when creating event in Calendar)
                  const meetingWith = selectedTask.customerName || selectedTask.associatedContactName || 'Contact'
                  const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meetingTitle)}&dates=${meetingDateTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDateTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(`Meeting with ${meetingWith}`)}`
                  const googleMeetLink = 'https://meet.google.com/new'

                  // Open Google Calendar in new tab
                  const calendarAnchor = document.createElement('a')
                  calendarAnchor.href = googleCalendarLink
                  calendarAnchor.target = '_blank'
                  calendarAnchor.rel = 'noopener noreferrer'
                  document.body.appendChild(calendarAnchor)
                  calendarAnchor.click()
                  document.body.removeChild(calendarAnchor)

                  // Add meeting to activities (with meetLink so "Join Google Meet" works)
                  const newActivity = {
                    type: 'Meeting',
                    content: meetingTitle,
                    date: meetingDateTime.toISOString(),
                    link: googleCalendarLink,
                    meetLink: googleMeetLink,
                    createdAt: new Date().toISOString()
                  }
                  const updatedActivities = [...taskActivities, newActivity]
                  setTaskActivities(updatedActivities)

                  // Save to backend and create Meeting task (meeting bane – sirf show nahi, actual task create)
                  try {
                    if (selectedTask && selectedTask._id) {
                      const currentNotes = selectedTask.notes || ''
                      const activityNote = `[${formatActivityDateTime(meetingDateTime)}] Meeting: ${meetingTitle} - ${googleCalendarLink} | Google Meet: ${googleMeetLink}`
                      const updatedNotes = currentNotes ? `${currentNotes}\n${activityNote}` : activityNote

                      if (selectedTask.isVisitTarget) {
                        await updateVisitTarget(selectedTask._id, { notes: updatedNotes })
                        const updatedRes = await getVisitTarget(selectedTask._id)
                        if (updatedRes.success && updatedRes.data) {
                          const vt = updatedRes.data
                          setSelectedTask(prev => ({ ...prev, notes: updatedNotes, ...vt }))
                        }
                        setTaskActivities(parseNotesToActivities(updatedNotes))
                      } else {
                        await updateFollowUp(selectedTask._id, { notes: updatedNotes })
                        const updatedRes = await getFollowUp(selectedTask._id)
                        if (updatedRes.success) setSelectedTask(updatedRes.data)
                        // Parse from the notes we just saved so meeting shows immediately in activities
                        setTaskActivities(parseNotesToActivities(updatedNotes))
                      }

                      // Create new Meeting follow-up task (meeting follow – task list mein aaye, Google Meet link ke sath)
                      let meetingTaskCreated = false
                      const salesmanRef = selectedTask.salesman
                      const salesmanId = salesmanRef != null ? (salesmanRef._id ?? salesmanRef) : null
                      const salesmanIdStr = salesmanId != null ? String(salesmanId) : ''
                      const customerRef = selectedTask.customer?._id ?? selectedTask.customer
                      const customerIdStr = customerRef != null ? String(customerRef) : undefined
                      if (salesmanIdStr) {
                        try {
                          const createRes = await createFollowUp({
                            salesman: salesmanIdStr,
                            customer: customerIdStr,
                            customerName: (selectedTask.customerName || selectedTask.name || 'Contact').trim() || 'Contact',
                            customerEmail: (selectedTask.customerEmail || '').trim() || undefined,
                            customerPhone: (selectedTask.customerPhone || '').trim() || undefined,
                            type: 'Meeting',
                            priority: 'Medium',
                            scheduledDate: meetingDateTime.toISOString(),
                            dueDate: meetingDateTime.toISOString(),
                            description: (meetingTitle || 'Meeting').trim(),
                            notes: `Meeting: ${googleCalendarLink} | Google Meet: ${googleMeetLink}`
                          })
                          if (createRes && createRes.success) {
                            meetingTaskCreated = true
                          } else {
                            console.error('Meeting task create failed:', createRes?.message, createRes)
                            Swal.fire({
                              icon: 'warning',
                              title: 'Meeting task not created',
                              text: createRes?.message || 'Meeting task could not be created. Notes saved on current task.',
                              confirmButtonColor: '#e9931c'
                            })
                          }
                        } catch (createErr) {
                          console.error('Error creating meeting task:', createErr)
                          Swal.fire({
                            icon: 'warning',
                            title: 'Meeting note saved',
                            text: 'Meeting follow-up task could not be created. Notes saved on current task.',
                            confirmButtonColor: '#e9931c'
                          })
                        }
                      } else {
                        Swal.fire({
                          icon: 'info',
                          title: 'No salesman',
                          text: 'Task has no salesman assigned. Meeting note saved; add a salesman to create a Meeting task.',
                          confirmButtonColor: '#e9931c'
                        })
                      }

                      // Refetch so new meeting task appears; if on Pending tab, load All so meeting (Approved) shows
                      if (meetingTaskCreated) {
                        setActiveTab('All')
                        await loadTasks('All')
                      } else {
                        await loadTasks()
                      }
                    }
                  } catch (e) {
                    console.error('Error saving meeting:', e)
                    Swal.fire({
                      icon: 'error',
                      title: 'Error',
                      text: e?.message || 'Failed to save meeting.',
                      confirmButtonColor: '#e9931c'
                    })
                    return
                  }

                  setShowMeetingModal(false)
                  Swal.fire({
                    icon: 'success',
                    title: 'Meeting Created!',
                    html: `Google Calendar opened.${meetingTaskCreated ? ' Meeting task added to list.' : ''}<br/><br/><a href="${googleCalendarLink}" target="_blank" class="text-gray-700 underline">Open Calendar</a> &nbsp; <a href="${googleMeetLink}" target="_blank" class="text-gray-700 underline">Start Google Meet</a>`,
                    confirmButtonColor: '#e9931c'
                  })
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title *</label>
                    <input
                      type="text"
                      name="meetingTitle"
                      placeholder="Enter meeting title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      name="meetingDate"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                    <input
                      type="time"
                      name="meetingTime"
                      defaultValue={new Date().toTimeString().slice(0, 5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                    <select
                      name="meetingDuration"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="30">30 minutes</option>
                      <option value="60" selected>60 minutes</option>
                      <option value="90">90 minutes</option>
                      <option value="120">120 minutes</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                      Create Meeting
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMeetingModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default Tasks
