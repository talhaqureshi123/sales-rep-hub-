const VisitTarget = require('../../database/models/VisitTarget');
const Quotation = require('../../database/models/Quotation');
const Customer = require('../../database/models/Customer');
const Tracking = require('../../database/models/Tracking');

// @desc    Get dashboard stats for salesman
// @route   GET /api/salesman/dashboard
// @access  Private/Salesman
const getDashboardStats = async (req, res) => {
  try {
    const salesmanId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Visits Today (Completed visit targets today)
    const visitsToday = await VisitTarget.countDocuments({
      salesman: salesmanId,
      status: 'Completed',
      completedAt: { $gte: startOfToday },
    });

    // Visits This Week
    const visitsThisWeek = await VisitTarget.countDocuments({
      salesman: salesmanId,
      status: 'Completed',
      completedAt: { $gte: startOfWeek },
    });

    // Hot Leads (Customers with status Active)
    const hotLeads = await Customer.countDocuments({
      $or: [
        { assignedSalesman: salesmanId },
        { createdBy: salesmanId },
      ],
      status: 'Active',
    });

    // Follow-ups Due (Pending visit targets)
    const followUpsDue = await VisitTarget.countDocuments({
      salesman: salesmanId,
      status: 'Pending',
    });

    // Today's Schedule (Visit targets scheduled for today)
    const todaySchedule = await VisitTarget.find({
      salesman: salesmanId,
      visitDate: {
        $gte: startOfToday,
        $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
      },
      status: { $in: ['Pending', 'In Progress'] },
    })
      .sort({ priority: 1, visitDate: 1 })
      .limit(10)
      .select('name address city visitDate priority status')
      .lean();

    // Recent Activity (Last 10 completed visit targets and approved quotations)
    const recentVisits = await VisitTarget.find({
      salesman: salesmanId,
      status: 'Completed',
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .select('name completedAt address')
      .lean();

    const recentQuotations = await Quotation.find({
      salesman: salesmanId,
      status: 'Approved',
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('quotationNumber total customerName updatedAt')
      .lean();

    const recentActivity = [
      ...recentVisits.map(v => ({
        type: 'visit',
        title: `Visit completed: ${v.name}`,
        description: v.address || 'Location visited',
        date: v.completedAt,
      })),
      ...recentQuotations.map(q => ({
        type: 'quotation',
        title: `Quotation approved: ${q.quotationNumber}`,
        description: `Customer: ${q.customerName} - £${q.total?.toLocaleString() || 0}`,
        date: q.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // Sales Chart Data (Last 7 days)
    const salesChartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayQuotations = await Quotation.find({
        salesman: salesmanId,
        status: 'Approved',
        updatedAt: { $gte: dayStart, $lt: dayEnd },
      });

      const daySales = dayQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
      const dayVisits = await VisitTarget.countDocuments({
        salesman: salesmanId,
        status: 'Completed',
        completedAt: { $gte: dayStart, $lt: dayEnd },
      });

      salesChartData.push({
        date: dayStart.toISOString().split('T')[0],
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: daySales,
        visits: dayVisits,
      });
    }

    // Monthly Sales Chart Data (Last 6 months)
    const monthlyChartData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      const monthQuotations = await Quotation.find({
        salesman: salesmanId,
        status: 'Approved',
        updatedAt: { $gte: monthStart, $lte: monthEnd },
      });

      const monthSales = monthQuotations.reduce((sum, q) => sum + (q.total || 0), 0);
      const monthVisits = await VisitTarget.countDocuments({
        salesman: salesmanId,
        status: 'Completed',
        completedAt: { $gte: monthStart, $lte: monthEnd },
      });

      monthlyChartData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        sales: monthSales,
        visits: monthVisits,
      });
    }

    // Overall Stats
    const totalSales = await Quotation.aggregate([
      { $match: { salesman: salesmanId, status: 'Approved' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const totalSalesAmount = totalSales.length > 0 ? totalSales[0].total : 0;

    const totalQuotations = await Quotation.countDocuments({ salesman: salesmanId });
    const approvedQuotations = await Quotation.countDocuments({
      salesman: salesmanId,
      status: 'Approved',
    });

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          visitsToday,
          visitsThisWeek,
          hotLeads,
          followUpsDue,
        },
        todaySchedule,
        recentActivity,
        charts: {
          daily: salesChartData,
          monthly: monthlyChartData,
        },
        overall: {
          totalSales: totalSalesAmount,
          totalQuotations,
          approvedQuotations,
          conversionRate: totalQuotations > 0 
            ? ((approvedQuotations / totalQuotations) * 100).toFixed(1)
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching dashboard stats',
    });
  }
};

module.exports = {
  getDashboardStats,
};

