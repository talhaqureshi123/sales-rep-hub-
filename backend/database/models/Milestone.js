/* COMMENTED OUT - MILESTONE FUNCTIONALITY DISABLED
const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a milestone name'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  latitude: {
    type: Number,
    required: [true, 'Please provide latitude'],
  },
  longitude: {
    type: Number,
    required: [true, 'Please provide longitude'],
  },
  address: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending',
  },
  completedAt: {
    type: Date,
  },
  meterReading: {
    type: String,
    trim: true,
  },
  capturedImage: {
    type: String,
    default: '',
  },
  notes: {
    type: String,
    trim: true,
  },
  proximityDistance: {
    type: Number,
    default: 0.1, // 100 meters in km
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
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
milestoneSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Milestone', milestoneSchema);
*/

// Return empty model to prevent errors
const mongoose = require('mongoose');
const milestoneSchema = new mongoose.Schema({});
module.exports = mongoose.model('Milestone', milestoneSchema);
