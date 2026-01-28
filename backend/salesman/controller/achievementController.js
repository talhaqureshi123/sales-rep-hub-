const VisitTarget = require('../../database/models/VisitTarget');
const Quotation = require('../../database/models/Quotation');
const Customer = require('../../database/models/Customer');
const User = require('../../database/models/User');

// @desc    Get achievement stats for salesman
// @route   GET /api/salesman/achievements
// @access  Private/Salesman
const getAchievementStats = async (req, res) => {
  try {
    const salesmanId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get visit targets stats
    const totalVisitTargets = await VisitTarget.countDocuments({ salesman: salesmanId });
    const completedVisitTargets = await VisitTarget.countDocuments({
      salesman: salesmanId,
      status: 'Completed',
    });
    const monthlyCompletedTargets = await VisitTarget.countDocuments({
      salesman: salesmanId,
      status: 'Completed',
      completedAt: { $gte: startOfMonth },
    });

    // Get quotations stats
    const totalQuotations = await Quotation.countDocuments({ salesman: salesmanId });
    const approvedQuotations = await Quotation.countDocuments({
      salesman: salesmanId,
      status: 'Approved',
    });
    
    // Get total sales amount
    const quotations = await Quotation.find({ salesman: salesmanId });
    const totalSales = quotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const approvedSales = quotations
      .filter(q => q.status === 'Approved')
      .reduce((sum, q) => sum + (q.total || 0), 0);
    
    const monthlyQuotations = await Quotation.find({
      salesman: salesmanId,
      createdAt: { $gte: startOfMonth },
    });
    const monthlySales = monthlyQuotations.reduce((sum, q) => sum + (q.total || 0), 0);

    // Get customers stats
    const totalCustomers = await Customer.countDocuments({
      $or: [
        { assignedSalesman: salesmanId },
        { createdBy: salesmanId },
      ],
    });
    const activeCustomers = await Customer.countDocuments({
      $or: [
        { assignedSalesman: salesmanId },
        { createdBy: salesmanId },
      ],
      status: 'Active',
    });

    // Calculate conversion rate (Approved Quotations / Total Quotations)
    const conversionRate = totalQuotations > 0 
      ? ((approvedQuotations / totalQuotations) * 100).toFixed(1)
      : 0;

    // Calculate GRPA (Group Real Performance Award)
    // Get all salesmen data for comparison
    const allSalesmen = await User.find({ role: 'salesman' });
    const groupStats = await Promise.all(
      allSalesmen.map(async (salesman) => {
        const sales = await Quotation.find({ salesman: salesman._id });
        const totalSalesAmount = sales.reduce((sum, q) => sum + (q.total || 0), 0);
        const completedTargets = await VisitTarget.countDocuments({
          salesman: salesman._id,
          status: 'Completed',
        });
        return {
          salesmanId: salesman._id,
          name: salesman.name,
          totalSales: totalSalesAmount,
          completedTargets,
        };
      })
    );

    // Calculate GRPA score (combination of sales and completed targets)
    const grpaScores = groupStats.map(stat => ({
      ...stat,
      score: (stat.totalSales * 0.6) + (stat.completedTargets * 10000 * 0.4), // Weighted score
    }));

    // Sort by score and find current salesman's rank
    grpaScores.sort((a, b) => b.score - a.score);
    const currentSalesmanRank = grpaScores.findIndex(
      s => s.salesmanId.toString() === salesmanId.toString()
    ) + 1;
    const totalSalesmen = grpaScores.length;
    const grpaPercentage = totalSalesmen > 0 
      ? (((totalSalesmen - currentSalesmanRank + 1) / totalSalesmen) * 100).toFixed(1)
      : 0;

    // Get recent achievements
    const recentCompletedTargets = await VisitTarget.find({
      salesman: salesmanId,
      status: 'Completed',
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .select('name completedAt');

    const recentApprovedQuotations = await Quotation.find({
      salesman: salesmanId,
      status: 'Approved',
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('quotationNumber total updatedAt');

    const achievements = [
      ...recentCompletedTargets.map((target, index) => ({
        id: `target-${target._id}`,
        title: 'Visit Target Completed',
        description: `Completed visit to ${target.name}`,
        date: target.completedAt ? new Date(target.completedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        conversion: `${conversionRate}%`,
        status: 'completed',
        type: 'visit_target',
      })),
      ...recentApprovedQuotations.map((quotation, index) => ({
        id: `quotation-${quotation._id}`,
        title: 'Quotation Approved',
        description: `Quotation ${quotation.quotationNumber} approved`,
        date: quotation.updatedAt ? new Date(quotation.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        conversion: `£${(quotation.total || 0).toFixed(2)}`,
        status: 'completed',
        type: 'quotation',
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    // Monthly target (can be configured, using 150000 as default)
    const monthlyTarget = 150000;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalSales: totalSales,
          monthlySales: monthlySales,
          monthlyTarget: monthlyTarget,
          conversionRate: parseFloat(conversionRate),
          completedTargets: completedVisitTargets,
          totalTargets: totalVisitTargets,
          totalCustomers: totalCustomers,
          activeCustomers: activeCustomers,
          totalQuotations: totalQuotations,
          approvedQuotations: approvedQuotations,
        },
        grpa: {
          rank: currentSalesmanRank,
          totalSalesmen: totalSalesmen,
          percentage: parseFloat(grpaPercentage),
          score: grpaScores.find(s => s.salesmanId.toString() === salesmanId.toString())?.score || 0,
        },
        achievements: achievements,
      },
    });
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching achievement stats',
    });
  }
};

module.exports = {
  getAchievementStats,
};

