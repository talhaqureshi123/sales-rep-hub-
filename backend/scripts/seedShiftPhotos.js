/**
 * Seed one Tracking document with sample shift photos for testing Shift Photos page.
 * Shift photos in DB come ONLY when a salesman does: Start Tracking (with meter photo) → Stop Tracking (with end meter + optional visited area photo).
 *
 * Usage (from project root): node backend/scripts/seedShiftPhotos.js
 */

const connectDB = require('../database/connection');
const User = require('../database/models/User');
const Tracking = require('../database/models/Tracking');

// Tiny 1x1 PNG as base64 (valid image for DB)
const SAMPLE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function seedShiftPhotos() {
  try {
    await connectDB();

    const salesman = await User.findOne({ role: 'salesman' });
    if (!salesman) {
      console.error('No salesman user found. Run seedUsers.js first or create a salesman user.');
      process.exit(1);
    }

    const existing = await Tracking.findOne({
      salesman: salesman._id,
      status: 'stopped',
      speedometerImage: { $exists: true, $ne: '' },
    });
    if (existing) {
      console.log('Sample shift photo (Tracking) already exists. Shift Photos page should show data.');
      console.log('Tracking id:', existing._id.toString());
      process.exit(0);
    }

    const tracking = await Tracking.create({
      salesman: salesman._id,
      startingKilometers: 1000,
      speedometerImage: SAMPLE_BASE64,
      startLocation: { latitude: 24.86, longitude: 67.0 },
      status: 'stopped',
      startedAt: new Date(),
      stoppedAt: new Date(),
      endingKilometers: 1050,
      endingMeterImage: SAMPLE_BASE64,
      visitedAreaImage: SAMPLE_BASE64,
      endLocation: { latitude: 24.87, longitude: 67.01 },
      totalDistance: 50,
    });

    console.log('Created sample Tracking with shift photos. Id:', tracking._id.toString());
    console.log('Open Admin → Shift Photos to verify.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seedShiftPhotos();
