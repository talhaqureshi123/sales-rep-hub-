const mongoose = require('mongoose');

const salesTargetSchema = new mongoose.Schema(
  {
    salesman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide salesman'],
    },
    targetName: {
      type: String,
      required: [true, 'Please provide target name'],
      trim: true,
    },
    targetType: {
      type: String,
      enum: ['Revenue', 'Visits', 'New Customers', 'Quotes', 'Conversions', 'Orders'],
      required: [true, 'Please provide target type'],
    },
    targetValue: {
      type: Number,
      required: [true, 'Please provide target value'],
      min: 0,
    },
    period: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
      required: [true, 'Please provide period'],
    },
    startDate: {
      type: Date,
      required: [true, 'Please provide start date'],
    },
    endDate: {
      type: Date,
      required: [true, 'Please provide end date'],
    },
    currentProgress: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Failed', 'Cancelled'],
      default: 'Active',
    },
    completedAt: {
      type: Date,
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
  },
  { timestamps: true }
);

// Update updatedAt before saving
salesTargetSchema.pre('save', async function () {
  this.updatedAt = new Date();
  
  // Auto-update status based on dates and progress
  const now = new Date();
  const endDate = new Date(this.endDate);
  
  if (this.status !== 'Cancelled') {
    // Check if target is completed
    if (this.currentProgress >= this.targetValue) {
      this.status = 'Completed';
      if (!this.completedAt) {
        this.completedAt = now;
      }
    }
    // Check if target period has ended
    else if (endDate < now && this.status === 'Active') {
      // If end date passed and not completed, mark as Failed
      this.status = 'Failed';
    }
    // Check if target is still active
    else if (now >= new Date(this.startDate) && now <= endDate && this.status !== 'Completed' && this.status !== 'Failed') {
      this.status = 'Active';
    }
  }
});

// Calculate progress percentage
salesTargetSchema.virtual('progressPercentage').get(function () {
  if (this.targetValue === 0) return 0;
  return Math.min((this.currentProgress / this.targetValue) * 100, 100).toFixed(2);
});

module.exports = mongoose.model('SalesTarget', salesTargetSchema);
