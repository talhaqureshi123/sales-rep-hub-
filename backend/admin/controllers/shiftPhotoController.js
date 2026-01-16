const ShiftPhoto = require('../../database/models/ShiftPhoto');
const Tracking = require('../../database/models/Tracking');
const VisitTarget = require('../../database/models/VisitTarget');
const User = require('../../database/models/User');

// Helper function to sync photos from tracking sessions
const syncPhotosFromTracking = async () => {
  try {
    // Get all tracking sessions (including active ones that might have start meter)
    const trackings = await Tracking.find({})
      .populate('salesman', 'name email')
      .sort({ createdAt: -1 });

    let syncedCount = 0;

    for (const tracking of trackings) {
      // Get salesman ID (handle both ObjectId and populated)
      const salesmanId = tracking.salesman?._id || tracking.salesman;

      if (!salesmanId) {
        console.warn(`Tracking ${tracking._id} has no salesman, skipping...`);
        continue;
      }

      // Check if photos already exist for this tracking
      const existingPhotos = await ShiftPhoto.find({
        relatedTracking: tracking._id,
      });

      // Create start meter photo if exists
      if (tracking.speedometerImage) {
        const existingStartPhoto = existingPhotos.find(
          p => p.photoType === 'Meter' && 
          p.meterReading === tracking.startingKilometers &&
          p.imageUrl === tracking.speedometerImage
        );

        if (!existingStartPhoto) {
          await ShiftPhoto.findOneAndUpdate(
            {
              relatedTracking: tracking._id,
              photoType: 'Meter',
              meterReading: tracking.startingKilometers,
              imageUrl: tracking.speedometerImage,
            },
            {
              salesman: salesmanId,
              photoType: 'Meter',
              imageUrl: tracking.speedometerImage,
              meterReading: tracking.startingKilometers,
              location: tracking.startLocation ? {
                latitude: tracking.startLocation.latitude,
                longitude: tracking.startLocation.longitude,
              } : undefined,
              relatedTracking: tracking._id,
              shiftDate: tracking.startedAt || tracking.createdAt,
            },
            { upsert: true, new: true }
          );
          syncedCount++;
        }
      }

      // Create end meter photo if exists
      if (tracking.endingMeterImage && tracking.endingKilometers) {
        const existingEndPhoto = existingPhotos.find(
          p => p.photoType === 'Meter' && 
          p.meterReading === tracking.endingKilometers &&
          p.imageUrl === tracking.endingMeterImage
        );

        if (!existingEndPhoto) {
          await ShiftPhoto.findOneAndUpdate(
            {
              relatedTracking: tracking._id,
              photoType: 'Meter',
              meterReading: tracking.endingKilometers,
              imageUrl: tracking.endingMeterImage,
            },
            {
              salesman: salesmanId,
              photoType: 'Meter',
              imageUrl: tracking.endingMeterImage,
              meterReading: tracking.endingKilometers,
              location: tracking.endLocation ? {
                latitude: tracking.endLocation.latitude,
                longitude: tracking.endLocation.longitude,
              } : undefined,
              relatedTracking: tracking._id,
              shiftDate: tracking.stoppedAt || tracking.updatedAt,
            },
            { upsert: true, new: true }
          );
          syncedCount++;
        }
      }
    }

    // Also sync from VisitTargets that have meter images
    const visitTargets = await VisitTarget.find({
      meterImage: { $exists: true, $ne: null, $ne: '' },
    })
      .populate('salesman', 'name email')
      .sort({ createdAt: -1 });

    for (const visitTarget of visitTargets) {
      const salesmanId = visitTarget.salesman?._id || visitTarget.salesman;

      if (!salesmanId) continue;

      // Check if photos already exist for this visit target
      const existingPhotos = await ShiftPhoto.find({
        relatedVisitTarget: visitTarget._id,
      });

      // Create meter photo from visit target (can be start or end meter)
      if (visitTarget.meterImage) {
        const meterReading = visitTarget.endingKilometers || visitTarget.startingKilometers;
        const existingPhoto = existingPhotos.find(
          p => p.photoType === 'Meter' && 
          p.imageUrl === visitTarget.meterImage
        );

        if (!existingPhoto && meterReading) {
          await ShiftPhoto.findOneAndUpdate(
            {
              relatedVisitTarget: visitTarget._id,
              photoType: 'Meter',
              imageUrl: visitTarget.meterImage,
            },
            {
              salesman: salesmanId,
              photoType: 'Meter',
              imageUrl: visitTarget.meterImage,
              meterReading: meterReading,
              location: {
                latitude: visitTarget.latitude,
                longitude: visitTarget.longitude,
                address: visitTarget.address,
                city: visitTarget.city,
                state: visitTarget.state,
              },
              relatedVisitTarget: visitTarget._id,
              shiftDate: visitTarget.completedAt || visitTarget.visitDate || visitTarget.updatedAt || visitTarget.createdAt,
            },
            { upsert: true, new: true }
          );
          syncedCount++;
        }
      }
    }

    if (syncedCount > 0) {
      console.log(`Synced ${syncedCount} photos from tracking and visit targets`);
    }
  } catch (error) {
    console.error('Error syncing photos from tracking:', error);
  }
};

// @desc    Get all shift photos
// @route   GET /api/admin/shift-photos
// @access  Private/Admin
const getShiftPhotos = async (req, res) => {
  try {
    const { salesman, photoType, date, search } = req.query;
    const filter = {};

    if (salesman && salesman !== 'All') {
      filter.salesman = salesman;
    }
    if (photoType && photoType !== 'All') {
      filter.photoType = photoType;
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.shiftDate = { $gte: startDate, $lte: endDate };
    }
    if (search) {
      filter.$or = [
        { notes: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
      ];
    }

    // Sync photos from tracking before fetching
    await syncPhotosFromTracking();

    const photos = await ShiftPhoto.find(filter)
      .populate('salesman', 'name email')
      .populate('relatedTracking', 'startedAt stoppedAt totalDistance')
      .populate('relatedVisitTarget', 'name address')
      .sort({ shiftDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: photos.length,
      data: photos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching shift photos',
    });
  }
};

// @desc    Get single shift photo
// @route   GET /api/admin/shift-photos/:id
// @access  Private/Admin
const getShiftPhoto = async (req, res) => {
  try {
    const photo = await ShiftPhoto.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('relatedTracking', 'startedAt stoppedAt totalDistance')
      .populate('relatedVisitTarget', 'name address city');

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Shift photo not found',
      });
    }

    res.status(200).json({
      success: true,
      data: photo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching shift photo',
    });
  }
};

// @desc    Create shift photo
// @route   POST /api/admin/shift-photos
// @access  Private/Admin
const createShiftPhoto = async (req, res) => {
  try {
    const {
      salesman,
      photoType,
      imageUrl,
      meterReading,
      location,
      notes,
      relatedTracking,
      relatedVisitTarget,
      shiftDate,
    } = req.body;

    // Validate required fields
    if (!salesman) {
      return res.status(400).json({
        success: false,
        message: 'Please provide salesman',
      });
    }

    if (!photoType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide photo type',
      });
    }

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide image URL',
      });
    }

    // Verify salesman exists
    const salesmanUser = await User.findById(salesman);
    if (!salesmanUser || salesmanUser.role !== 'salesman') {
      return res.status(400).json({
        success: false,
        message: 'Invalid salesman selected',
      });
    }

    const photo = await ShiftPhoto.create({
      salesman,
      photoType,
      imageUrl,
      meterReading: meterReading || undefined,
      location: location || undefined,
      notes: notes || undefined,
      relatedTracking: relatedTracking || undefined,
      relatedVisitTarget: relatedVisitTarget || undefined,
      shiftDate: shiftDate ? new Date(shiftDate) : new Date(),
    });

    const populatedPhoto = await ShiftPhoto.findById(photo._id)
      .populate('salesman', 'name email')
      .populate('relatedTracking', 'startedAt stoppedAt')
      .populate('relatedVisitTarget', 'name address');

    res.status(201).json({
      success: true,
      message: 'Shift photo created successfully',
      data: populatedPhoto,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating shift photo',
    });
  }
};

// @desc    Delete shift photo
// @route   DELETE /api/admin/shift-photos/:id
// @access  Private/Admin
const deleteShiftPhoto = async (req, res) => {
  try {
    const photo = await ShiftPhoto.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Shift photo not found',
      });
    }

    await ShiftPhoto.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Shift photo deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting shift photo',
    });
  }
};

module.exports = {
  getShiftPhotos,
  getShiftPhoto,
  createShiftPhoto,
  deleteShiftPhoto,
};
