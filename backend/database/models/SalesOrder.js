const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productCode: {
    type: String,
    trim: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  spec: {
    type: String,
    trim: true,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  unit: {
    type: String,
    default: 'Rolls',
    trim: true,
  },
  lineTotal: {
    type: Number,
    required: true,
    min: 0,
  },
});

const salesOrderSchema = new mongoose.Schema(
  {
    // Section A: Order Information
    soNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      uppercase: true,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    salesPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    salesPersonEmail: {
      type: String,
      trim: true,
    },
    poNumber: {
      type: String,
      trim: true,
    },
    orderSource: {
      type: String,
      required: true,
      trim: true,
    },

    // Section B: Customer Details
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      trim: true,
    },
    billingAddress: {
      type: String,
      trim: true,
    },
    deliveryAddress: {
      type: String,
      trim: true,
    },

    // Section C: Product Line Items
    items: [orderItemSchema],

    // Section D: Order Totals
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    vat: {
      type: Number,
      default: 0,
      min: 0,
    },
    vatRate: {
      type: Number,
      default: 20, // 20%
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Section E: Payment Information
    paymentMethod: {
      type: String,
      trim: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentReceived: {
      type: Boolean,
      default: false,
    },
    balanceRemaining: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Section F: Status & Workflow
    orderStatus: {
      type: String,
      enum: ['Draft', 'Pending', 'Confirmed', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'],
      default: 'Draft',
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    expectedDispatchDate: {
      type: Date,
    },
    actualDispatchDate: {
      type: Date,
    },
    orderNotes: {
      type: String,
      trim: true,
    },

    // Section G: Internal Flags
    sendToAdmin: {
      type: Boolean,
      default: false,
    },
    stockDeducted: {
      type: Boolean,
      default: false,
    },
    sendToWarehouse: {
      type: Boolean,
      default: false,
    },
    creditLimitCheck: {
      type: Boolean,
      default: false,
    },

    // Customer Signature
    customerSignature: {
      type: String, // Base64 encoded signature image
      default: '',
    },

    // HubSpot Sync (optional)
    hubspotOrderId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    hubspotLastSyncedAt: {
      type: Date,
      default: null,
    },
    hubspotLastSyncError: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Calculate totals before saving
salesOrderSchema.pre('save', function (next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  
  // Calculate VAT (20%)
  this.vat = (this.subtotal - this.discount + this.deliveryCharges) * (this.vatRate / 100);
  
  // Calculate grand total
  this.grandTotal = this.subtotal - this.discount + this.deliveryCharges + this.vat;
  
  // Calculate balance remaining
  this.balanceRemaining = this.grandTotal - this.amountPaid;
  
  next();
});

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
