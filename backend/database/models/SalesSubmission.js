const mongoose = require('mongoose');

const salesSubmissionSchema = new mongoose.Schema(
  {
    submissionNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
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
      required: true,
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
    salesDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    salesAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    salesDescription: {
      type: String,
      trim: true,
    },
    // Uploaded documents/proofs
    documents: [{
      fileName: {
        type: String,
        required: true,
      },
      fileUrl: {
        type: String,
        required: true,
      },
      fileType: {
        type: String, // 'image', 'pdf', 'document'
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    // Approval workflow
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Generate submission number before validation
salesSubmissionSchema.pre('validate', async function () {
  if (!this.submissionNumber) {
    try {
      const SalesSubmission = mongoose.model('SalesSubmission');
      const count = await SalesSubmission.countDocuments();
      this.submissionNumber = `SS${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      // If model doesn't exist yet (first time), start from 1
      this.submissionNumber = `SS${String(1).padStart(6, '0')}`;
    }
  }
});

// Indexes
salesSubmissionSchema.index({ salesman: 1, approvalStatus: 1 });
salesSubmissionSchema.index({ approvalStatus: 1 });
salesSubmissionSchema.index({ salesDate: -1 });

module.exports = mongoose.model('SalesSubmission', salesSubmissionSchema);
