const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  // ============================================
  // HUBSPOT INTEGRATION FIELDS
  // ============================================
  // If imported from HubSpot tasks, store the HubSpot task object id to prevent duplicates
  hubspotTaskId: {
    type: String,
    trim: true,
    index: true,
    unique: true,
    sparse: true,
  },
  // Original HubSpot task properties (for reference and sync)
  hs_createdate: {
    type: Date,
    // HubSpot creation date
  },
  hs_lastmodifieddate: {
    type: Date,
    // HubSpot last modified date
  },
  hs_task_subject: {
    type: String,
    trim: true,
    // Original HubSpot task subject
  },
  hs_task_body: {
    type: String,
    trim: true,
    // Original HubSpot task body/notes
  },
  hs_task_status: {
    type: String,
    trim: true,
    // Original HubSpot task status (e.g., 'NOT_STARTED', 'COMPLETED')
  },
  hs_task_priority: {
    type: String,
    trim: true,
    // Original HubSpot task priority (e.g., 'HIGH', 'MEDIUM', 'LOW', 'NONE')
  },
  hs_task_type: {
    type: String,
    trim: true,
    // Original HubSpot task type (e.g., 'TODO', 'CALL', 'EMAIL')
  },
  hs_timestamp: {
    type: Date,
    // Original HubSpot timestamp (due date in epoch milliseconds)
  },
  hubspot_owner_id: {
    type: String,
    trim: true,
    // HubSpot owner/assigned user ID
  },
  hubspot_owner_name: {
    type: String,
    trim: true,
    // HubSpot owner/assigned user name
  },
  hubspot_owner_email: {
    type: String,
    trim: true,
    // HubSpot owner/assigned user email
  },
  hs_task_queue: {
    type: String,
    trim: true,
    // HubSpot task queue
  },
  hs_task_reminder: {
    type: String,
    trim: true,
    // HubSpot task reminder
  },
  // HubSpot sync metadata
  hubspotLastSyncedAt: {
    type: Date,
    // When task was last synced with HubSpot
  },
  hubspotSyncError: {
    type: String,
    trim: true,
    // Any errors during HubSpot sync
  },
  source: {
    type: String,
    enum: ['app', 'hubspot', 'imported'],
    default: 'app',
    // Source of task: 'app' (created in app), 'hubspot' (imported from HubSpot), 'imported' (other import)
  },

  // ============================================
  // CORE TASK FIELDS
  // ============================================
  followUpNumber: {
    type: String,
    unique: true,
    required: true,
  },
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  customerName: {
    type: String,
    required: [true, 'Please provide customer name'],
    trim: true,
  },
  customerEmail: {
    type: String,
    trim: true,
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['Call', 'Visit', 'Email', 'Quote Follow-up', 'Sample Feedback', 'Order Check'],
    required: true,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
  },
  status: {
    type: String,
    enum: ['Overdue', 'Today', 'Upcoming', 'Completed'],
    default: 'Upcoming',
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  completedDate: {
    type: Date,
  },
  description: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },

  // ============================================
  // ASSOCIATED ENTITIES (HUBSPOT-STYLE)
  // ============================================
  // Associated Contact (HubSpot contact reference)
  associatedContactId: {
    type: String,
    trim: true,
    // HubSpot contact ID
  },
  associatedContactName: {
    type: String,
    trim: true,
    // Contact name from HubSpot
  },
  associatedContactEmail: {
    type: String,
    trim: true,
    // Contact email from HubSpot
  },
  // Associated Company (HubSpot company reference)
  associatedCompanyId: {
    type: String,
    trim: true,
    // HubSpot company ID
  },
  associatedCompanyName: {
    type: String,
    trim: true,
    // Company name from HubSpot
  },
  associatedCompanyDomain: {
    type: String,
    trim: true,
    // Company domain from HubSpot
  },

  // ============================================
  // RELATED ITEMS (HUBSPOT-STYLE)
  // ============================================
  relatedQuotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
  },
  relatedSample: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sample',
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    // ref: 'Order', // If Order model exists
  },
  // HubSpot-style related items (arrays for multiple associations)
  relatedDeals: [{
    type: String,
    trim: true,
    // HubSpot deal IDs
  }],
  relatedQuotes: [{
    type: String,
    trim: true,
    // HubSpot quote IDs
  }],
  relatedTickets: [{
    type: String,
    trim: true,
    // HubSpot ticket IDs
  }],
  visitTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitTarget',
  },

  // ============================================
  // ACTIVITY & ENGAGEMENT FIELDS (HUBSPOT-STYLE)
  // ============================================
  lastContacted: {
    type: Date,
    // Last time contact was reached
  },
  lastEngagement: {
    type: Date,
    // Last engagement date (any interaction)
  },
  lifecycleStage: {
    type: String,
    trim: true,
    enum: ['Lead', 'Marketing Qualified Lead', 'Sales Qualified Lead', 'Opportunity', 'Customer', 'Evangelist', 'Other'],
    // Lifecycle stage from HubSpot
  },

  // ============================================
  // APPROVAL & WORKFLOW FIELDS
  // ============================================
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Approved', // Admin created tasks are auto-approved
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
    trim: true,
  },

  // ============================================
  // METADATA FIELDS
  // ============================================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt before saving
followUpSchema.pre('save', async function () {
  this.updatedAt = new Date();
  
  // Auto-update status based on dueDate
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(this.dueDate);
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  
  if (this.status !== 'Completed') {
    if (dueDateOnly < today) {
      this.status = 'Overdue';
    } else if (dueDateOnly.getTime() === today.getTime()) {
      this.status = 'Today';
    } else {
      this.status = 'Upcoming';
    }
  }
});

// Generate follow-up number before validation (so required validation passes)
followUpSchema.pre('validate', async function () {
  if (this.isNew && !this.followUpNumber) {
    const count = await mongoose.model('FollowUp').countDocuments();
    this.followUpNumber = `FU${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = mongoose.model('FollowUp', followUpSchema);
