const Milestone = require('../../database/models/Milestone');
const User = require('../../database/models/User');

// @desc    Get all milestones (admin can see all)
// @route   GET /api/admin/milestones
// @access  Private/Admin
const getMilestones = async (req, res) => {
  try {
    const { salesman, status } = req.query;
    const filter = {};

    if (salesman) {
      filter.salesman = salesman;
    }

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

// @desc    Create milestone and assign to salesman
// @route   POST /api/admin/milestones
// @access  Private/Admin
const createMilestone = async (req, res) => {
  try {
    const { name, description, latitude, longitude, address, salesmanId, priority, radius, notes } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Please provide latitude and longitude',
      });
    }

    if (!salesmanId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide salesman ID',
      });
    }

    // Verify salesman exists and is a salesman
    const salesman = await User.findById(salesmanId);
    if (!salesman) {
      return res.status(404).json({
        success: false,
        message: 'Salesman not found',
      });
    }

    if (salesman.role !== 'salesman') {
      return res.status(400).json({
        success: false,
        message: 'User is not a salesman',
      });
    }

    const milestone = await Milestone.create({
      name,
      description,
      salesman: salesmanId,
      latitude,
      longitude,
      address,
      priority: priority || 'Medium',
      proximityDistance: radius ? radius / 1000 : 0.1, // Convert meters to km
      notes,
      status: 'Pending',
    });

    const populatedMilestone = await Milestone.findById(milestone._id)
      .populate('salesman', 'name email');

    res.status(201).json({
      success: true,
      message: 'Milestone created and assigned successfully',
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
// @route   PUT /api/admin/milestones/:id
// @access  Private/Admin
const updateMilestone = async (req, res) => {
  try {
    const { name, description, latitude, longitude, address, salesmanId, priority, radius, notes, status } = req.body;

    let milestone = await Milestone.findById(req.params.id);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found',
      });
    }

    // Update fields
    if (name) milestone.name = name;
    if (description !== undefined) milestone.description = description;
    if (latitude) milestone.latitude = latitude;
    if (longitude) milestone.longitude = longitude;
    if (address !== undefined) milestone.address = address;
    if (priority) milestone.priority = priority;
    if (radius) milestone.proximityDistance = radius / 1000; // Convert meters to km
    if (notes !== undefined) milestone.notes = notes;
    if (status) milestone.status = status;

    // Update salesman if provided
    if (salesmanId) {
      const salesman = await User.findById(salesmanId);
      if (!salesman || salesman.role !== 'salesman') {
        return res.status(400).json({
          success: false,
          message: 'Invalid salesman ID',
        });
      }
      milestone.salesman = salesmanId;
    }

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

// @desc    Delete milestone
// @route   DELETE /api/admin/milestones/:id
// @access  Private/Admin
const deleteMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);

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

// @desc    Get all salesmen
// @route   GET /api/admin/milestones/salesmen
// @access  Private/Admin
const getSalesmen = async (req, res) => {
  try {
    const salesmen = await User.find({ role: 'salesman' })
      .select('name email _id')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: salesmen.length,
      data: salesmen,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching salesmen',
    });
  }
};

module.exports = {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getSalesmen,
};

