const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      required: [true, "Please provide a product code"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Please provide a product name"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Please provide a price"],
      min: 0,
    },
    category: {
      type: String,
      required: [true, "Please provide a category"],
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "Please provide stock quantity"],
      min: 0,
      default: 0,
    },
    image: {
      type: String,
      default: "",
    },
    qrCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    keyFeatures: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true } // ✅ put timestamps as the second argument of mongoose.Schema
);

// No need for pre('save') hook now because timestamps will handle updatedAt automatically

module.exports = mongoose.model("Product", productSchema);
