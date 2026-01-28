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
      enum: ['Orders'],
      required: [true, 'Please provide target type'],
      default: 'Orders',
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
    // ===== APPROVAL (ADMIN) =====
    // Admin-created targets are approved by default
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Approved',
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
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
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);
  endDate.setHours(23, 59, 59, 999); // End of end date day
  
  if (this.status === 'Cancelled') return;
  
  // 1. Target achieved
  if (this.currentProgress >= this.targetValue) {
    this.status = 'Completed';
    if (!this.completedAt) this.completedAt = now;
    return;
  }
  
  // 2. Period still running (today is before or on end date) → always Active
  if (now <= endDate && now >= startDate) {
    this.status = 'Active';
    return;
  }
  
  // 3. Period has ended (past end date) - Keep as Active (admin can manually change to Failed if needed)
  if (now > endDate) {
    // Don't auto-set to Failed - keep as Active so admin can review
    // Admin can manually change status if needed
    if (this.status === 'Active' && (this.currentProgress || 0) < this.targetValue) {
      // Keep as Active even after period ends - admin decides
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
