const User = require("../../database/models/User");

// @desc    Get latest location for all salesmen (for live tracking)
// @route   GET /api/admin/locations/latest
// @access  Private/Admin
const getLatestSalesmenLocations = async (req, res) => {
  try {
    const activeWithinMinutes = Number(req.query.activeWithinMinutes || 5);
    const activeWithinMs =
      Number.isFinite(activeWithinMinutes) && activeWithinMinutes > 0
        ? activeWithinMinutes * 60 * 1000
        : 5 * 60 * 1000;
    const now = Date.now();

    // Aggregate from Users so we include salesmen with no location yet
    const rows = await User.aggregate([
      { $match: { role: "salesman" } },
      {
        $lookup: {
          from: "locations",
          let: { salesmanId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$salesman", "$$salesmanId"] } } },
            { $sort: { timestamp: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                latitude: 1,
                longitude: 1,
                accuracy: 1,
                timestamp: 1,
              },
            },
          ],
          as: "latestLocation",
        },
      },
      { $addFields: { latestLocation: { $arrayElemAt: ["$latestLocation", 0] } } },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          status: 1,
          latestLocation: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    const data = rows.map((u) => {
      const ts = u.latestLocation?.timestamp
        ? new Date(u.latestLocation.timestamp).getTime()
        : null;
      const lastSeenMs = ts ? now - ts : null;
      const isOnline = typeof lastSeenMs === "number" && lastSeenMs <= activeWithinMs;

      return {
        salesman: {
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.status,
        },
        latestLocation: u.latestLocation || null,
        isOnline,
        lastSeenMs,
      };
    });

    const onlineCount = data.reduce((sum, r) => sum + (r.isOnline ? 1 : 0), 0);

    res.status(200).json({
      success: true,
      count: data.length,
      onlineCount,
      activeWithinMinutes: Math.round(activeWithinMs / 60000),
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching latest salesman locations",
    });
  }
};

module.exports = {
  getLatestSalesmenLocations,
};

