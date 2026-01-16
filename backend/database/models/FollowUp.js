const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  // If imported from HubSpot tasks, store the HubSpot task object id to prevent duplicates
  hubspotTaskId: {
    type: String,
    trim: true,
    index: true,
    unique: true,
    sparse: true,
  },
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
  visitTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitTarget',
  },
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
