const mongoose = require('mongoose');

const shiftPhotoSchema = new mongoose.Schema(
  {
    salesman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    photoType: {
      type: String,
      enum: ['Meter', 'Location', 'Visit'],
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    meterReading: {
      type: Number,
    },
    location: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
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
    },
    notes: {
      type: String,
      trim: true,
    },
    relatedTracking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tracking',
    },
    relatedVisitTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitTarget',
    },
    shiftDate: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Update updatedAt before saving
shiftPhotoSchema.pre('save', async function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('ShiftPhoto', shiftPhotoSchema);
