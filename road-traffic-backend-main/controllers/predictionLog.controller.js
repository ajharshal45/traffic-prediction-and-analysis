import PredictionLog from '../models/predictionLog.model.js';

/**
 * GET /prediction-logs
 * List all prediction logs (paginated, newest first)
 * Query params: ?page=1&limit=20&pathId=Swargate-Katraj&verified=true
 */
export const getPredictionLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.pathId) filter.pathId = req.query.pathId;
    if (req.query.verified === 'true') filter.isVerified = true;
    if (req.query.verified === 'false') filter.isVerified = false;

    const [logs, total] = await Promise.all([
      PredictionLog.find(filter)
        .sort({ predictedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PredictionLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching prediction logs:', error);
    res.status(500).json({ error: 'Failed to fetch prediction logs.' });
  }
};

/**
 * GET /prediction-logs/accuracy
 * Overall accuracy stats across all verified predictions
 * Query params: ?pathId=Swargate-Katraj (optional filter)
 */
export const getAccuracyStats = async (req, res) => {
  try {
    const matchFilter = { isVerified: true };
    if (req.query.pathId) matchFilter.pathId = req.query.pathId;

    const stats = await PredictionLog.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          avgAccuracy: { $avg: '$accuracy' },
          minAccuracy: { $min: '$accuracy' },
          maxAccuracy: { $max: '$accuracy' },
          avgPredicted: { $avg: '$predictedScore' },
          avgActual: { $avg: '$actualScore' },
          totalVerified: { $sum: 1 },
        },
      },
    ]);

    const totalUnverified = await PredictionLog.countDocuments({
      ...matchFilter,
      isVerified: false,
    });

    if (stats.length === 0) {
      return res.json({
        avgAccuracy: null,
        minAccuracy: null,
        maxAccuracy: null,
        avgPredicted: null,
        avgActual: null,
        totalVerified: 0,
        totalUnverified,
        message: 'No verified predictions yet.',
      });
    }

    const s = stats[0];
    res.json({
      avgAccuracy: Math.round(s.avgAccuracy * 100) / 100,
      minAccuracy: Math.round(s.minAccuracy * 100) / 100,
      maxAccuracy: Math.round(s.maxAccuracy * 100) / 100,
      avgPredicted: Math.round(s.avgPredicted * 100) / 100,
      avgActual: Math.round(s.avgActual * 100) / 100,
      totalVerified: s.totalVerified,
      totalUnverified,
    });
  } catch (error) {
    console.error('Error fetching accuracy stats:', error);
    res.status(500).json({ error: 'Failed to fetch accuracy stats.' });
  }
};

/**
 * GET /prediction-logs/accuracy/:pathId
 * Accuracy stats for a specific route, broken down by time slot
 */
export const getAccuracyByRoute = async (req, res) => {
  try {
    const { pathId } = req.params;

    const [overall, byTimeSlot] = await Promise.all([
      // Overall stats for this route
      PredictionLog.aggregate([
        { $match: { pathId, isVerified: true } },
        {
          $group: {
            _id: null,
            avgAccuracy: { $avg: '$accuracy' },
            minAccuracy: { $min: '$accuracy' },
            maxAccuracy: { $max: '$accuracy' },
            avgPredicted: { $avg: '$predictedScore' },
            avgActual: { $avg: '$actualScore' },
            totalVerified: { $sum: 1 },
          },
        },
      ]),
      // Breakdown by time slot
      PredictionLog.aggregate([
        { $match: { pathId, isVerified: true } },
        {
          $group: {
            _id: '$timeRange',
            avgAccuracy: { $avg: '$accuracy' },
            avgPredicted: { $avg: '$predictedScore' },
            avgActual: { $avg: '$actualScore' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalUnverified = await PredictionLog.countDocuments({
      pathId,
      isVerified: false,
    });

    if (overall.length === 0) {
      return res.json({
        pathId,
        overall: null,
        byTimeSlot: [],
        totalUnverified,
        message: 'No verified predictions for this route yet.',
      });
    }

    const o = overall[0];
    res.json({
      pathId,
      overall: {
        avgAccuracy: Math.round(o.avgAccuracy * 100) / 100,
        minAccuracy: Math.round(o.minAccuracy * 100) / 100,
        maxAccuracy: Math.round(o.maxAccuracy * 100) / 100,
        avgPredicted: Math.round(o.avgPredicted * 100) / 100,
        avgActual: Math.round(o.avgActual * 100) / 100,
        totalVerified: o.totalVerified,
      },
      byTimeSlot: byTimeSlot.map(slot => ({
        timeRange: slot._id,
        avgAccuracy: Math.round(slot.avgAccuracy * 100) / 100,
        avgPredicted: Math.round(slot.avgPredicted * 100) / 100,
        avgActual: Math.round(slot.avgActual * 100) / 100,
        count: slot.count,
      })),
      totalUnverified,
    });
  } catch (error) {
    console.error('Error fetching route accuracy:', error);
    res.status(500).json({ error: 'Failed to fetch route accuracy.' });
  }
};

/**
 * GET /prediction-logs/accuracy/trend
 * Daily accuracy trend for the last N days
 * Query params: ?days=7&pathId=X (optional)
 */
export const getAccuracyTrend = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const matchFilter = { isVerified: true, predictedDate: { $gte: startDate } };
    if (req.query.pathId) matchFilter.pathId = req.query.pathId;

    const trend = await PredictionLog.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$predictedDate' } },
          avgAccuracy: { $avg: '$accuracy' },
          avgPredicted: { $avg: '$predictedScore' },
          avgActual: { $avg: '$actualScore' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      days,
      trend: trend.map(t => ({
        date: t._id,
        avgAccuracy: Math.round(t.avgAccuracy * 100) / 100,
        avgPredicted: Math.round(t.avgPredicted * 100) / 100,
        avgActual: Math.round(t.avgActual * 100) / 100,
        count: t.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching accuracy trend:', error);
    res.status(500).json({ error: 'Failed to fetch accuracy trend.' });
  }
};

