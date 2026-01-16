const Tracking = require('../../database/models/Tracking');

// @desc    Start tracking session
// @route   POST /api/salesman/tracking/start
// @access  Private/Salesman
const startTracking = async (req, res) => {
  try {
    const { startingKilometers, speedometerImage, latitude, longitude } = req.body;

    // Validate required fields
    if (!startingKilometers || !speedometerImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide starting kilometers and speedometer image',
      });
    }

    // Check if there's an active tracking session
    const activeTracking = await Tracking.findOne({
      salesman: req.user._id,
      status: 'active',
    });

    if (activeTracking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active tracking session. Please stop it first.',
      });
    }

    // Create new tracking session
    const tracking = await Tracking.create({
      salesman: req.user._id,
      startingKilometers: parseFloat(startingKilometers),
      speedometerImage,
      startLocation: {
        latitude: latitude || null,
        longitude: longitude || null,
      },
      status: 'active',
    });

    res.status(201).json({
      success: true,
      message: 'Tracking started successfully',
      data: tracking,
    });
  } catch (error) {
    console.error('Error starting tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting tracking session',
      error: error.message,
    });
  }
};

// @desc    Stop tracking session
// @route   PUT /api/salesman/tracking/stop/:id
// @access  Private/Salesman
const stopTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const { endingKilometers, endingMeterImage, visitedAreaImage, latitude, longitude } = req.body;

    const tracking = await Tracking.findOne({
      _id: id,
      salesman: req.user._id,
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking session not found',
      });
    }

    if (tracking.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Tracking session is not active',
      });
    }

    // Validate required fields (end meter photo is mandatory for shift photos)
    if (endingKilometers === undefined || endingKilometers === null || endingKilometers === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide ending kilometers',
      });
    }

    if (!endingMeterImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide ending meter image',
      });
    }

    // Calculate total distance
    const endingKmNum = parseFloat(endingKilometers);
    const totalDistance = endingKmNum - tracking.startingKilometers;

    tracking.endingKilometers = endingKmNum;
    tracking.endingMeterImage = endingMeterImage;
    if (visitedAreaImage !== undefined) {
      tracking.visitedAreaImage = visitedAreaImage;
    }
    tracking.endLocation = {
      latitude: latitude || null,
      longitude: longitude || null,
    };

    tracking.status = 'stopped';
    tracking.stoppedAt = Date.now();
    tracking.totalDistance = totalDistance > 0 ? totalDistance : 0;

    await tracking.save();

    res.status(200).json({
      success: true,
      message: 'Tracking stopped successfully',
      data: tracking,
    });
  } catch (error) {
    console.error('Error stopping tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Error stopping tracking session',
      error: error.message,
    });
  }
};

// @desc    Get active tracking session
// @route   GET /api/salesman/tracking/active
// @access  Private/Salesman
const getActiveTracking = async (req, res) => {
  try {
    const tracking = await Tracking.findOne({
      salesman: req.user._id,
      status: 'active',
    }).populate('salesman', 'name email');

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'No active tracking session found',
      });
    }

    res.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (error) {
    console.error('Error getting active tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting active tracking session',
      error: error.message,
    });
  }
};

// @desc    Get all tracking sessions for salesman
// @route   GET /api/salesman/tracking
// @access  Private/Salesman
const getAllTracking = async (req, res) => {
  try {
    const trackingSessions = await Tracking.find({
      salesman: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate('salesman', 'name email');

    res.status(200).json({
      success: true,
      count: trackingSessions.length,
      data: trackingSessions,
    });
  } catch (error) {
    console.error('Error getting tracking sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tracking sessions',
      error: error.message,
    });
  }
};

module.exports = {
  startTracking,
  stopTracking,
  getActiveTracking,
  getAllTracking,
};

