const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productCode: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    unique: true,
    required: true,
  },
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: {
    type: String,
    required: [true, 'Please provide customer name'],
    trim: true,
  },
  customerEmail: {
    type: String,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  customerPhone: {
    type: String,
    trim: true,
  },
  customerAddress: {
    type: String,
    trim: true,
  },
  validUntil: {
    type: Date,
  },
  items: [quotationItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Approved', 'Rejected'],
    default: 'Draft',
  },
  notes: {
    type: String,
    trim: true,
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
quotationSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Quotation', quotationSchema);


