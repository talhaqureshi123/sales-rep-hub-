const Milestone = require('../../database/models/Milestone');

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// @desc    Get all milestones for salesman
// @route   GET /api/salesman/milestones
// @access  Private/Salesman
const getMilestones = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { salesman: req.user._id };

    if (status) {
      filter.status = status;
    }

    const milestones = await Milestone.find(filter)
      .populate('salesman', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: milestones.length,
      data: milestones,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching milestones',
    });
  }
};

// @desc    Get single milestone
// @route   GET /api/salesman/milestones/:id
// @access  Private/Salesman
const getMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    }).populate('salesman', 'name email');

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    res.status(200).json({
      success: true,
      data: milestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching milestone',
    });
  }
};

// @desc    Create milestone
// @route   POST /api/salesman/milestones
// @access  Private/Salesman
const createMilestone = async (req, res) => {
  try {
    const { name, description, latitude, longitude, address, notes } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide latitude and longitude',
      });
    }

    const milestone = await Milestone.create({
      name,
      description,
      salesman: req.user._id,
      latitude,
      longitude,
      address,
      notes,
      status: 'Pending',
    });

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('salesman', 'name email');

    res.status(201).json({
      success: true,
      message: 'Milestone created successfully',
      data: populatedMilestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating milestone',
    });
  }
};

// @desc    Update milestone
// @route   PUT /api/salesman/milestones/:id
// @access  Private/Salesman
const updateMilestone = async (req, res) => {
  try {
    let milestone = await Milestone.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    const { name, description, latitude, longitude, address, notes, meterReading, capturedImage } = req.body;

    if (name) milestone.name = name;
    if (description !== undefined) milestone.description = description;
    if (latitude) milestone.latitude = latitude;
    if (longitude) milestone.longitude = longitude;
    if (address !== undefined) milestone.address = address;
    if (notes !== undefined) milestone.notes = notes;
    if (meterReading !== undefined) milestone.meterReading = meterReading;
    if (capturedImage !== undefined) milestone.capturedImage = capturedImage;

    await milestone.save();

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('salesman', 'name email');

    res.status(200).json({
      success: true,
      message: 'Milestone updated successfully',
      data: populatedMilestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating milestone',
    });
  }
};

// @desc    Mark milestone as complete
// @route   PUT /api/salesman/milestones/:id/complete
// @access  Private/Salesman
const markMilestoneComplete = async (req, res) => {
  try {
    const { meterReading, capturedImage, notes } = req.body;

    let milestone = await Milestone.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    milestone.status = 'Completed';
    milestone.completedAt = new Date();
    if (meterReading) milestone.meterReading = meterReading;
    if (capturedImage) milestone.capturedImage = capturedImage;
    if (notes) milestone.notes = notes;

    await milestone.save();

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('salesman', 'name email');

    res.status(200).json({
      success: true,
      message: 'Milestone marked as completed',
      data: populatedMilestone,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing milestone',
    });
  }
};

// @desc    Check proximity to milestone
// @route   POST /api/salesman/milestones/:id/check-proximity
// @access  Private/Salesman
const checkProximity = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide latitude and longitude',
      });
    }

    const milestone = await Milestone.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      milestone.latitude,
      milestone.longitude
    );

    const isWithinProximity = distance <= milestone.proximityDistance;

    res.status(200).json({
      success: true,
      data: {
        distance: distance.toFixed(2),
        isWithinProximity,
        proximityDistance: milestone.proximityDistance,
        milestone: {
          id: milestone._id,
          name: milestone.name,
          latitude: milestone.latitude,
          longitude: milestone.longitude,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking proximity',
    });
  }
};

// @desc    Delete milestone
// @route   DELETE /api/salesman/milestones/:id
// @access  Private/Salesman
const deleteMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findOne({
      _id: req.params.id,
      salesman: req.user._id,
    });

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    await milestone.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Milestone deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting milestone',
    });
  }
};

module.exports = {
  getMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  markMilestoneComplete,
  checkProximity,
  deleteMilestone,
};


