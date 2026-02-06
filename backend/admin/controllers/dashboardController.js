const User = require('../../database/models/User');
const Customer = require('../../database/models/Customer');
const VisitTarget = require('../../database/models/VisitTarget');
const FollowUp = require('../../database/models/FollowUp');
const SalesTarget = require('../../database/models/SalesTarget');

// @desc    Get dashboard summary for admin (single fast API - no full list fetches)
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    const adminId = req.user?._id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Run all counts and small list fetches in parallel (no full lists, no heavy populates)
    const [
      totalSalesmen,
      activeSalesmenCount,
      totalCustomers,
      activeCustomersCount,
      completedVisits,
      pendingVisits,
      todaySchedule,
      recentActivity,
      dailyChart,
      monthlyChart,
      myTasks,
      myCustomers,
      myVisits,
      mySalesTargets,
    ] = await Promise.all([
      User.countDocuments({ role: 'salesman' }),
      User.countDocuments({ role: 'salesman', status: 'Active' }),
      Customer.countDocuments({}),
      Customer.countDocuments({ status: 'Active' }),
      VisitTarget.countDocuments({ status: 'Completed' }),
      VisitTarget.countDocuments({ status: 'Pending' }),
      VisitTarget.find({
        status: 'Pending',
        visitDate: { $gte: startOfToday, $lt: endOfToday },
      })
        .select('name address city visitDate priority')
        .sort({ visitDate: 1 })
        .limit(5)
        .lean(),
      VisitTarget.find({ status: 'Completed', completedAt: { $exists: true, $ne: null } })
        .select('name address city completedAt')
        .sort({ completedAt: -1 })
        .limit(5)
        .lean(),
      getDailyVisitChart(),
      getMonthlyVisitChart(),
      adminId
        ? FollowUp.find({ createdBy: adminId })
            .select('customerName type dueDate')
            .sort({ dueDate: 1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
      adminId
        ? Customer.find({ createdBy: adminId })
            .select('name firstName company email phone')
            .limit(5)
            .lean()
        : Promise.resolve([]),
      adminId
        ? VisitTarget.find({ createdBy: adminId })
            .select('name address city status visitDate')
            .sort({ visitDate: -1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
      adminId
        ? SalesTarget.find({ createdBy: adminId })
            .select('salesman targetAmount period status')
            .populate('salesman', 'name')
            .limit(5)
            .lean()
        : Promise.resolve([]),
    ]);

    const todayScheduleMapped = todaySchedule.map((vt) => ({
      name: vt.name,
      address: vt.address || vt.city || 'Location',
      priority: vt.priority || 'Medium',
      visitDate: vt.visitDate,
    }));

    const recentActivityMapped = recentActivity.map((vt) => ({
      type: 'visit',
      title: `Visit Completed: ${vt.name}`,
      description: vt.address || vt.city || 'Location',
      date: vt.completedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalSalesmen,
          totalCustomers,
          completedVisits,
          pendingVisits,
        },
        todaySchedule: todayScheduleMapped,
        recentActivity: recentActivityMapped,
        charts: {
          daily: dailyChart,
          monthly: monthlyChart,
        },
        overall: {
          totalSalesmen,
          activeSalesmen: activeSalesmenCount,
          totalCustomers,
          activeCustomers: activeCustomersCount,
        },
        myCreations: {
          tasks: myTasks,
          customers: myCustomers,
          visits: myVisits,
          salesTargets: mySalesTargets,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching dashboard stats',
    });
  }
};

async function getDailyVisitChart() {
  const dayStarts = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    dayStarts.push(date);
  }
  const counts = await Promise.all(
    dayStarts.map((date) => {
      const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      return VisitTarget.countDocuments({
        status: 'Completed',
        completedAt: { $gte: date, $lt: dayEnd },
      });
    })
  );
  return dayStarts.map((date, i) => ({
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    visits: counts[i],
    customers: 0,
  }));
}

async function getMonthlyVisitChart() {
  const monthInfos = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    monthInfos.push({ monthStart, monthEnd });
  }
  const counts = await Promise.all(
    monthInfos.map(({ monthStart, monthEnd }) =>
      VisitTarget.countDocuments({
        status: 'Completed',
        completedAt: { $gte: monthStart, $lte: monthEnd },
      })
    )
  );
  return monthInfos.map(({ monthStart }, i) => ({
    month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
    visits: counts[i],
    customers: 0,
  }));
}

module.exports = {
  getDashboardStats,
};
