import RouteSegmentLog from '../models/routeSegmentLog.model.js';

/**
 * GET /api/segments/latest/:pathId
 * Returns the most recently collected segment document for a route.
 */
export const getLatestSegments = async (req, res) => {
  try {
    const doc = await RouteSegmentLog.findOne({ pathId: req.params.pathId }).sort({ collectedAt: -1 });
    if (!doc) return res.status(404).json({ error: 'No data found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/segments/history/:pathId?days=7&timeRange=14-16
 * Returns historical segment documents for a route (optionally filtered by timeRange).
 */
export const getSegmentHistory = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const filter = { pathId: req.params.pathId, date: { $gte: since } };
    if (req.query.timeRange) filter.timeRange = req.query.timeRange;

    const docs = await RouteSegmentLog.find(filter).sort({ date: -1, collectedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/segments/all-latest
 * Returns the latest segment document for each pilot route.
 */
export const getAllRoutesLatest = async (req, res) => {
  try {
    const routes = [
      'Swargate-Katraj',
      'Katraj-Kondhwa',
      'Hinjewadi-Swargate',
      'Kondhwa-Hinjewadi',
      'Kothrud-Shivajinagar'
    ];
    const results = await Promise.all(
      routes.map(pathId =>
        RouteSegmentLog.findOne({ pathId }).sort({ collectedAt: -1 })
      )
    );
    res.json(results.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/segments/stats/:pathId
 * Returns per-segment averages (avgCongestion, maxCongestion, avgDurationTraffic)
 * aggregated over the last 7 days.
 */
export const getSegmentStats = async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const docs = await RouteSegmentLog.find({
      pathId: req.params.pathId,
      date: { $gte: since },
    });

    // Group by segmentIndex, compute averages
    const stats = {};
    for (const doc of docs) {
      for (const seg of doc.segments) {
        if (!stats[seg.segmentIndex]) {
          stats[seg.segmentIndex] = {
            fromLabel: seg.fromLabel,
            toLabel: seg.toLabel,
            scores: [],
            durations: [],
          };
        }
        stats[seg.segmentIndex].scores.push(seg.congestionScore);
        stats[seg.segmentIndex].durations.push(seg.durationTraffic);
      }
    }

    const result = Object.entries(stats)
      .map(([idx, s]) => ({
        segmentIndex: parseInt(idx),
        fromLabel: s.fromLabel,
        toLabel: s.toLabel,
        avgCongestion: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
        maxCongestion: Math.max(...s.scores),
        avgDurationTraffic: s.durations.reduce((a, b) => a + b, 0) / s.durations.length,
        samples: s.scores.length,
      }))
      .sort((a, b) => a.segmentIndex - b.segmentIndex);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * GET /api/segments/top-bottlenecks
 * Returns citywide top congested sub-segments across all monitored corridors
 */
export const getTopBottlenecks = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const docs = await RouteSegmentLog.find({
      date: { $gte: since },
    }).sort({ collectedAt: -1 });

    const segmentMap = {};

    for (const doc of docs) {
      for (const seg of doc.segments) {
        const key = `${doc.pathId}:::${seg.fromLabel}:::${seg.toLabel}`;
        if (!segmentMap[key]) {
          segmentMap[key] = {
            pathId: doc.pathId,
            fromLabel: seg.fromLabel,
            toLabel: seg.toLabel,
            cause: seg.cause || 'High density urban traffic flow',
            causeCategory: seg.causeCategory || 'regular',
            scores: [],
            delays: [],
          };
        }
        segmentMap[key].scores.push(seg.congestionScore);
        if (typeof seg.delaySeconds === 'number') {
          segmentMap[key].delays.push(seg.delaySeconds);
        }
      }
    }

    const ranked = Object.values(segmentMap)
      .map(item => {
        const avgScore = item.scores.reduce((a, b) => a + b, 0) / item.scores.length;
        const avgDelay = item.delays.length > 0
          ? item.delays.reduce((a, b) => a + b, 0) / item.delays.length
          : 0;
        return {
          pathId: item.pathId,
          fromLabel: item.fromLabel,
          toLabel: item.toLabel,
          cause: item.cause,
          causeCategory: item.causeCategory,
          avgCongestionScore: Math.round(avgScore * 10) / 10,
          avgDelaySeconds: Math.round(avgDelay),
          sampleCount: item.scores.length,
          level:
            avgScore <= 10 ? 'low'
            : avgScore <= 25 ? 'medium'
            : avgScore <= 50 ? 'high'
            : 'very high'
        };
      })
      .sort((a, b) => b.avgCongestionScore - a.avgCongestionScore)
      .slice(0, 10);

    res.json({
      days,
      totalAnalyzed: Object.keys(segmentMap).length,
      topBottlenecks: ranked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
