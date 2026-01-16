const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startingKilometers: {
    type: Number,
    required: [true, 'Please provide starting kilometers'],
  },
  speedometerImage: {
    type: String, // Base64 encoded image or URL
    required: [true, 'Please provide speedometer image'],
  },
  startLocation: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'stopped'],
    default: 'active',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  stoppedAt: {
    type: Date,
  },
  totalDistance: {
    type: Number,
    default: 0,
  },
  endingKilometers: {
    type: Number,
  },
  endingMeterImage: {
    type: String, // Base64 encoded image or URL
  },
  visitedAreaImage: {
    type: String, // Base64 encoded image or URL
  },
  endLocation: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  // Link to visit target if tracking for specific target
  visitTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitTarget',
  },
  routeDistance: {
    type: Number, // Estimated route distance in km
    default: 0,
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
trackingSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Tracking', trackingSchema);

