const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please provide first name'],
    trim: true,
  },
  name: {
    type: String,
    trim: true,
  },
  contactPerson: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  pincode: {
    type: String,
    trim: true,
  },
  postcode: {
    type: String,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
  },
  orderPotential: {
    type: String,
    trim: true,
  },
  monthlySpend: {
    type: Number,
    default: 0,
    min: 0,
  },
  // REMOVED: assignedSalesman - Customers and Salesmen are separate entities
  // Salesmen are assigned to Tasks/FollowUps, not directly to Customers
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Not Visited', 'Visited', 'Follow-up Needed', 'Qualified Lead', 'Not Interested'],
    default: 'Not Visited',
  },
  notes: {
    type: String,
    trim: true,
  },
  competitorInfo: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  source: {
    type: String,
    enum: ['app', 'hubspot'],
    default: 'app',
  },
  view: {
    type: String,
    enum: ['admin', 'salesman', 'admin_salesman'],
    default: 'admin_salesman', // Default: visible to both admin and salesman
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
customerSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

// Index for efficient queries
// REMOVED: assignedSalesman index (field removed)
customerSchema.index({ createdBy: 1 });
customerSchema.index({ status: 1 });

module.exports = mongoose.model('Customer', customerSchema);


