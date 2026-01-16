const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  accuracy: {
    type: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
locationSchema.index({ salesman: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);


