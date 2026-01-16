const Tracking = require('../../database/models/Tracking');
const VisitTarget = require('../../database/models/VisitTarget');

// @desc    Get all tracking sessions (shifts) for admin
// @route   GET /api/admin/tracking
// @access  Private/Admin
const getAllTracking = async (req, res) => {
  try {
    const { salesman, status, date, search } = req.query;
    const filter = {};

    if (salesman && salesman !== 'All') {
      filter.salesman = salesman;
    }
    if (status && status !== 'All') {
      filter.status = status;
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const trackings = await Tracking.find(filter)
      .populate('salesman', 'name email')
      .populate('visitTarget', 'name address visitedAreaImage')
      .sort({ createdAt: -1 });

    // Get visit counts and visited area images for each tracking session
    const trackingsWithVisits = await Promise.all(
      trackings.map(async (tracking) => {
        const trackingIdTargets = await VisitTarget.find({
          trackingId: tracking._id,
        }).select('visitedAreaImage estimatedKilometers actualKilometers status updatedAt completedAt salesman visitDate');

        const salesmanId = tracking.salesman?._id || tracking.salesman;
        const shiftDate = tracking.startedAt || tracking.createdAt;
        const shiftStart = new Date(shiftDate);
        shiftStart.setHours(0, 0, 0, 0);
        const shiftEnd = new Date(shiftDate);
        shiftEnd.setHours(23, 59, 59, 999);

        const dateTargets = salesmanId
          ? await VisitTarget.find({
              salesman: salesmanId,
              visitDate: { $gte: shiftStart, $lte: shiftEnd },
            }).select('visitedAreaImage estimatedKilometers actualKilometers status updatedAt completedAt salesman visitDate')
          : [];

        const visitTargetsMap = new Map();
        trackingIdTargets.forEach((vt) => visitTargetsMap.set(String(vt._id), vt));
        dateTargets.forEach((vt) => {
          const id = String(vt._id);
          if (!visitTargetsMap.has(id)) {
            visitTargetsMap.set(id, vt);
          }
        });

        const visitTargets = Array.from(visitTargetsMap.values());

        // Count visits
        const visitCount = visitTargets.length;

        // Get visited area images for collage (latest first)
        const visitedAreaImages = visitTargets
          .filter((vt) => !!vt.visitedAreaImage)
          .sort((a, b) => {
            const ta = new Date(a.completedAt || a.updatedAt || 0).getTime();
            const tb = new Date(b.completedAt || b.updatedAt || 0).getTime();
            return tb - ta;
          })
          .map((vt) => vt.visitedAreaImage);

        // Keep a single primary image for backward compatibility (use latest)
        const visitedAreaImage = visitedAreaImages[0] || null;

        // Sum estimated kilometers for the shift
        const estimatedKilometers = visitTargets.reduce((sum, vt) => {
          const v = Number(vt.estimatedKilometers || 0);
          return sum + (Number.isNaN(v) ? 0 : v);
        }, 0);

        // Sum actual kilometers from visit targets (if used)
        const actualKilometers = visitTargets.reduce((sum, vt) => {
          const v = Number(vt.actualKilometers || 0);
          return sum + (Number.isNaN(v) ? 0 : v);
        }, 0);

        return {
          ...tracking.toObject(),
          visitCount,
          visitedAreaImage: visitedAreaImage || tracking.visitedAreaImage || null,
          visitedAreaImages,
          estimatedKilometers,
          actualKilometers,
          shiftDate,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: trackingsWithVisits.length,
      data: trackingsWithVisits,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching tracking sessions',
    });
  }
};

// @desc    Get single tracking session
// @route   GET /api/admin/tracking/:id
// @access  Private/Admin
const getTracking = async (req, res) => {
  try {
    const tracking = await Tracking.findById(req.params.id)
      .populate('salesman', 'name email phone')
      .populate('visitTarget', 'name address city');

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Tracking session not found',
      });
    }

    // Get visit count
    const visitCount = await VisitTarget.countDocuments({
      trackingId: tracking._id,
    });

    res.status(200).json({
      success: true,
      data: {
        ...tracking.toObject(),
        visitCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching tracking session',
    });
  }
};

// @desc    Get all active tracking sessions for live tracking
// @route   GET /api/admin/tracking/active
// @access  Private/Admin
const getActiveTrackingSessions = async (req, res) => {
  try {
    const activeTrackings = await Tracking.find({
      status: 'active',
    })
      .populate('salesman', 'name email phone')
      .sort({ startedAt: -1 });

    // Calculate total distance for all active sessions
    const totalDistance = activeTrackings.reduce((sum, tracking) => {
      return sum + (tracking.totalDistance || 0);
    }, 0);

    res.status(200).json({
      success: true,
      count: activeTrackings.length,
      totalDistance,
      data: activeTrackings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching active tracking sessions',
    });
  }
};

module.exports = {
  getAllTracking,
  getTracking,
  getActiveTrackingSessions,
};
