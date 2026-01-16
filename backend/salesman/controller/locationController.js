const Location = require('../../database/models/Location');

// @desc    Save location
// @route   POST /api/salesman/location
// @access  Private/Salesman
const saveLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide latitude and longitude',
      });
    }

    const location = await Location.create({
      salesman: req.user._id,
      latitude,
      longitude,
      accuracy,
    });

    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      data: location,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error saving location',
    });
  }
};

// @desc    Get location history
// @route   GET /api/salesman/location
// @access  Private/Salesman
const getLocationHistory = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const locations = await Location.find({ salesman: req.user._id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching location history',
    });
  }
};

// @desc    Get latest location
// @route   GET /api/salesman/location/latest
// @access  Private/Salesman
const getLatestLocation = async (req, res) => {
  try {
    const location = await Location.findOne({ salesman: req.user._id })
      .sort({ timestamp: -1 });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'No location found',
      });
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching latest location',
    });
  }
};

module.exports = {
  saveLocation,
  getLocationHistory,
  getLatestLocation,
};


