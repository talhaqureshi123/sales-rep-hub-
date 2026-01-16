const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  sampleNumber: {
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
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  productName: {
    type: String,
    required: true,
  },
  productCode: {
    type: String,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1,
  },
  status: {
    type: String,
    enum: ['Pending', 'Received', 'Converted'],
    default: 'Pending',
  },
  visitTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitTarget',
  },
  visitDate: {
    type: Date,
    default: Date.now,
  },
  expectedDate: {
    type: Date,
  },
  receivedDate: {
    type: Date,
  },
  convertedDate: {
    type: Date,
  },
  customerFeedback: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
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
sampleSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

// Generate sample number BEFORE validation (because sampleNumber is required)
sampleSchema.pre('validate', async function () {
  if (this.isNew && !this.sampleNumber) {
    const count = await mongoose.model('Sample').countDocuments();
    this.sampleNumber = `SMP${String(count + 1).padStart(6, '0')}`;
  }
});

module.exports = mongoose.model('Sample', sampleSchema);
