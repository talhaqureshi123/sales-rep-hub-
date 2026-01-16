const mongoose = require("mongoose");

const visitTargetSchema = new mongoose.Schema(
  {
    // ===== BASIC INFO =====
    name: {
      type: String,
      required: [true, "Visit target name is required"],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // ===== ASSIGNMENT =====
    salesman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Salesman is required"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ===== LOCATION =====
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
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

    proximityRadius: {
      type: Number,
      default: 0.1, // KM (100 meters)
    },

    // ===== VISIT STATUS =====
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },

    // ===== APPROVAL (ADMIN) =====
    // Admin-created targets are approved by default. Salesman-created requests start as Pending.
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: {
      type: String,
      trim: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    visitDate: {
      type: Date,
      required: [true, "Visit date is required"],
    },

    completedAt: {
      type: Date,
    },

    // ===== KM / ROUTE TRACKING =====
    estimatedKilometers: {
      type: Number,
      default: 0,
    },

    startingKilometers: {
      type: Number,
    },

    endingKilometers: {
      type: Number,
    },

    actualKilometers: {
      type: Number,
      default: 0,
    },

    meterImage: {
      type: String, // URL (Cloudinary / S3)
    },

    visitedAreaImage: {
      type: String, // URL (Cloudinary / S3) - Image of visited area
    },

    // ===== TRACKING SESSION =====
    trackingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tracking",
    },

    // ===== CONVERSION =====
    quotationCreated: {
      type: Boolean,
      default: false,
    },

    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },

    // ===== FEEDBACK =====
    notes: {
      type: String,
      trim: true,
    },

    comments: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // ✅ createdAt & updatedAt auto
  }
);

// ===== INDEXES =====
visitTargetSchema.index({ salesman: 1, status: 1 });
visitTargetSchema.index({ approvalStatus: 1, status: 1 });
visitTargetSchema.index({ createdBy: 1 });
visitTargetSchema.index({ visitDate: 1 });

module.exports = mongoose.model("VisitTarget", visitTargetSchema);
