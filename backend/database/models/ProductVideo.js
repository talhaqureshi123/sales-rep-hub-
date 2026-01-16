const mongoose = require('mongoose');

const productVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a video title'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please provide a category'],
      trim: true,
    },
    videoUrl: {
      type: String,
      required: [true, 'Please provide a video URL'],
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    duration: {
      type: String, // Format: MM:SS (e.g., "2:30")
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductVideo', productVideoSchema);
