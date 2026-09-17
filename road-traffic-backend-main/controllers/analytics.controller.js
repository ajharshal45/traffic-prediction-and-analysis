import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';
import { Construction } from '../models/construction.model.js';
import { Diversion } from '../models/diversion.model.js';
import { Event } from '../models/event.model.js';
import { BMSEvent } from '../models/bms_event.model.js';
import { MetroStation } from '../models/metroStation.model.js';
import { hotspotLocation } from '../models/nearbyHotspot.model.js';
import { Complaint } from '../models/complaint.model.js';
import { Image } from '../models/image.model.js';

/**
 * Get traffic trends for a route over specified days
 * GET /api/analytics/trends?route=Hinjewadi-Swargate&days=7
 */
export const getTrafficTrends = async (req, res) => {
  try {
    const { route, days = 7 } = req.query;

    if (!route) {
      return res.status(400).json({ error: 'Route parameter is required' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get all records for the route in date range
    const records = await PathInfo.find({
      pathId: route,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Group by date and calculate daily stats
    const dailyData = {};
    records.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          date: dateStr,
          scores: [],
          slots: {}
        };
      }
      dailyData[dateStr].scores.push(record.score);
      dailyData[dateStr].slots[record.timeRange] = record.score;
    });

    // Calculate averages and find peaks
    const trendData = Object.values(dailyData).map(day => {
      const avgScore = day.scores.reduce((a, b) => a + b, 0) / day.scores.length;
      
      // Find peak slot
      let peakSlot = '00-02';
      let peakScore = 0;
      Object.entries(day.slots).forEach(([slot, score]) => {
        if (score > peakScore) {
          peakScore = score;
          peakSlot = slot;
        }
      });

      return {
        date: day.date,
        avgScore: Math.round(avgScore * 100) / 100,
        peakSlot,
        peakScore: Math.round(peakScore * 100) / 100,
        level: getTrafficLevel(avgScore)
      };
    });

    res.json({
      route,
      days: parseInt(days),
      totalRecords: records.length,
      data: trendData
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch traffic trends' });
  }
};

/**
 * Get heatmap data for a route (time slots vs days)
 * GET /api/analytics/heatmap?route=Hinjewadi-Swargate&days=7
 */
export const getHeatmapData = async (req, res) => {
  try {
    const { route, days = 7 } = req.query;

    if (!route) {
      return res.status(400).json({ error: 'Route parameter is required' });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const records = await PathInfo.find({
      pathId: route,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Create heatmap matrix: rows = time slots, cols = days
    const timeSlots = ['00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
                       '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'];
    
    const heatmapData = {};
    const dates = new Set();

    records.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      dates.add(dateStr);
      
      if (!heatmapData[record.timeRange]) {
        heatmapData[record.timeRange] = {};
      }
      heatmapData[record.timeRange][dateStr] = record.score;
    });

    // Format for frontend chart
    const sortedDates = Array.from(dates).sort();
    const matrix = timeSlots.map(slot => ({
      timeSlot: slot,
      values: sortedDates.map(date => ({
        date,
        score: heatmapData[slot]?.[date] || 0,
        level: getTrafficLevel(heatmapData[slot]?.[date] || 0)
      }))
    }));

    res.json({
      route,
      dates: sortedDates,
      timeSlots,
      matrix
    });

  } catch (error) {
    console.error('Error fetching heatmap:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
};

/**
 * Get all time slots for a specific route and date
 * GET /api/analytics/timeslots?route=Hinjewadi-Swargate&date=2026-01-25
 */
export const getTimeSlotsForDate = async (req, res) => {
  try {
    const { route, date } = req.query;

    if (!route || !date) {
      return res.status(400).json({ error: 'Route and date are required' });
    }

    // Get all records for this route on this date
    const records = await PathInfo.find({
      pathId: route,
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      }
    }).sort({ timeRange: 1 });

    // All possible time slots
    const allSlots = ['00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
                      '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'];

    // Build response with available data
    const timeSlots = allSlots.map(slot => {
      const record = records.find(r => r.timeRange === slot);
      return {
        timeSlot: slot,
        hasData: !!record,
        score: record?.score || null,
        level: record?.level || null,
        hasBreakdown: !!(record?.breakdown)
      };
    });

    // Calculate daily stats
    const availableRecords = records.filter(r => r.score !== undefined);
    const avgScore = availableRecords.length > 0 
      ? availableRecords.reduce((sum, r) => sum + r.score, 0) / availableRecords.length 
      : 0;
    const peakRecord = availableRecords.reduce((max, r) => r.score > (max?.score || 0) ? r : max, null);

    res.json({
      route,
      date,
      totalSlots: allSlots.length,
      availableSlots: availableRecords.length,
      avgScore: Math.round(avgScore * 100) / 100,
      peakSlot: peakRecord?.timeRange || null,
      peakScore: peakRecord?.score || null,
      timeSlots
    });

  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
};

/**
 * Get root cause breakdown for a specific route, date, and time slot
 * NOW FETCHES STORED BREAKDOWN FROM PathInfo RECORD
 * GET /api/analytics/breakdown?route=Hinjewadi-Swargate&date=2026-01-25&timeSlot=18-20
 */
export const getRootCauseBreakdown = async (req, res) => {
  try {
    const { route, date, timeSlot = '08-10' } = req.query;

    if (!route || !date) {
      return res.status(400).json({ error: 'Route and date are required' });
    }

    // Fetch the specific PathInfo record with its stored breakdown
    const pathRecord = await PathInfo.findOne({
      pathId: route,
      timeRange: timeSlot,
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      }
    });

    if (!pathRecord) {
      return res.status(404).json({ 
        error: 'No data found for this route/date/time combination',
        route,
        date,
        timeSlot
      });
    }

    // Check if breakdown is stored
    const storedBreakdown = pathRecord.breakdown;
    let factors = [];

    if (storedBreakdown) {
      // Use stored breakdown data (PREFERRED - accurate for that specific record)
      if (storedBreakdown.construction > 0) {
        factors.push({
          name: 'Construction',
          icon: 'construction',
          score: storedBreakdown.construction,
          count: storedBreakdown.constructionCount || 0,
          details: 'Road construction causing delays'
        });
      }
      if (storedBreakdown.diversion > 0) {
        factors.push({
          name: 'Diversion',
          icon: 'diversion',
          score: storedBreakdown.diversion,
          count: storedBreakdown.diversionCount || 0,
          details: 'Traffic diversion in effect'
        });
      }
      if (storedBreakdown.event > 0) {
        factors.push({
          name: 'Events',
          icon: 'events',
          score: storedBreakdown.event,
          count: storedBreakdown.eventCount || 0,
          details: 'Nearby events causing congestion'
        });
      }
      if (storedBreakdown.metro > 0) {
        factors.push({
          name: 'Metro Stations',
          icon: 'metro',
          score: storedBreakdown.metro,
          count: storedBreakdown.metroCount || 0,
          details: 'Metro station crowd impact'
        });
      }
      if (storedBreakdown.pothole > 0) {
        factors.push({
          name: 'Potholes',
          icon: 'pothole',
          score: storedBreakdown.pothole,
          count: storedBreakdown.potholeCount || 0,
          details: 'Unresolved potholes on route'
        });
      }
      if (storedBreakdown.complaint > 0) {
        factors.push({
          name: 'Citizen Complaints',
          icon: 'complaint',
          score: storedBreakdown.complaint,
          count: storedBreakdown.complaintCount || 0,
          details: 'Active traffic complaints'
        });
      }
      if (storedBreakdown.weather > 0) {
        factors.push({
          name: 'Weather',
          icon: 'weather',
          score: storedBreakdown.weather,
          details: storedBreakdown.weatherCondition || 'Weather impact'
        });
      }
      if (storedBreakdown.transit > 0) {
        factors.push({
          name: 'Transit/Bus Impact',
          icon: 'transit',
          score: storedBreakdown.transit,
          details: 'Bus stops and transit congestion'
        });
      }
      if (storedBreakdown.hotspot > 0) {
        factors.push({
          name: 'Accident-Prone Zones',
          icon: 'hazard',
          score: storedBreakdown.hotspot,
          count: storedBreakdown.hotspotCount || 0,
          details: 'Known accident-prone areas'
        });
      }
      if (storedBreakdown.festival > 0) {
        factors.push({
          name: 'Festival',
          icon: 'festival',
          score: storedBreakdown.festival,
          details: storedBreakdown.festivalName || 'Festival/holiday impact'
        });
      }

      // Add time multiplier info
      if (storedBreakdown.timeMultiplier && storedBreakdown.timeMultiplier !== 1) {
        factors.push({
          name: 'Rush Hour',
          icon: 'rush-hour',
          score: Math.round((storedBreakdown.timeMultiplier - 1) * 20),
          details: `Time multiplier: ${storedBreakdown.timeMultiplier}x`,
          multiplier: `${storedBreakdown.timeMultiplier}x`
        });
      }
    } else {
      // No stored breakdown - show message
      factors.push({
        name: 'Historical Data',
        icon: 'info',
        score: pathRecord.score,
        details: 'Breakdown not available for historical records before system update'
      });
    }

    // Sort factors by score (highest first)
    factors.sort((a, b) => b.score - a.score);

    const totalFactorScore = factors.reduce((sum, f) => sum + (f.score || 0), 0);

    res.json({
      route,
      date,
      timeSlot,
      recordedScore: Math.round(pathRecord.score * 100) / 100,
      calculatedFactorScore: Math.round(totalFactorScore),
      level: pathRecord.level,
      hasStoredBreakdown: !!storedBreakdown,
      factors,
      summary: generateSummary(factors, pathRecord.score)
    });

  } catch (error) {
    console.error('Error fetching breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch root cause breakdown' });
  }
};

/**
 * Get AI-generated recommendations for traffic improvement
 * GET /api/analytics/recommendations?route=Hinjewadi-Swargate
 */
export const getRecommendations = async (req, res) => {
  try {
    const { route, date } = req.query;
    
    const recommendations = [];
    const today = date ? new Date(date) : new Date();

    // If date is provided, get stored breakdown for that date
    if (route && date) {
      const records = await PathInfo.find({
        pathId: route,
        date: {
          $gte: new Date(date + 'T00:00:00.000Z'),
          $lt: new Date(date + 'T23:59:59.999Z')
        }
      });

      // Aggregate breakdown data from all time slots
      let totalConstruction = 0, totalPothole = 0, totalEvent = 0;
      let totalTransit = 0, totalMetro = 0, totalComplaint = 0;

      records.forEach(r => {
        if (r.breakdown) {
          totalConstruction += r.breakdown.construction || 0;
          totalPothole += r.breakdown.pothole || 0;
          totalEvent += r.breakdown.event || 0;
          totalTransit += r.breakdown.transit || 0;
          totalMetro += r.breakdown.metro || 0;
          totalComplaint += r.breakdown.complaint || 0;
        }
      });

      // Generate recommendations based on actual breakdown
      if (totalConstruction > 20) {
        recommendations.push({
          priority: 'HIGH',
          category: 'Construction',
          title: 'Construction Impact Detected',
          description: 'Active construction work causing significant delays on this route',
          action: 'Announce alternate routes via traffic advisory',
          impact: `Construction contributing ${Math.round(totalConstruction)} points to traffic score`
        });
      }

      if (totalPothole > 10) {
        recommendations.push({
          priority: 'HIGH',
          category: 'Road Repair',
          title: 'Pothole Repairs Needed',
          description: 'Multiple potholes affecting traffic flow',
          action: 'Prioritize pothole repairs on this route segment',
          impact: `Pothole repairs can reduce score by ${Math.round(totalPothole)} points`
        });
      }

      if (totalEvent > 15) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Event Management',
          title: 'Event Traffic Impact',
          description: 'Nearby events causing additional congestion',
          action: 'Deploy traffic personnel near event venues',
          impact: 'Proactive event management can reduce delays by 20%'
        });
      }

      if (totalTransit > 10) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Transit Coordination',
          title: 'High Transit Activity',
          description: 'Bus stops and transit hubs contributing to congestion',
          action: 'Improve bus bay infrastructure at congested stops',
          impact: 'Better transit flow can reduce overall traffic by 15%'
        });
      }

      if (totalMetro > 15) {
        recommendations.push({
          priority: 'LOW',
          category: 'Metro Integration',
          title: 'Metro Station Congestion',
          description: 'Metro stations adding to road traffic during peak hours',
          action: 'Improve last-mile connectivity with dedicated feeder services',
          impact: 'Reduces road congestion near metro stations'
        });
      }

      if (totalComplaint > 8) {
        recommendations.push({
          priority: 'LOW',
          category: 'Citizen Feedback',
          title: 'Pending Citizen Complaints',
          description: 'Multiple traffic-related complaints need attention',
          action: 'Review and address citizen complaints promptly',
          impact: 'Improves citizen satisfaction and identifies problem areas'
        });
      }
    }

    // If no specific recommendations, add general ones
    if (recommendations.length === 0) {
      // Check current database for active issues
      const constructions = await Construction.find({
        startDate: { $lte: today },
        expectedEndDate: { $gte: today }
      });
      
      if (constructions.length > 0) {
        recommendations.push({
          priority: 'HIGH',
          category: 'Construction',
          title: `${constructions.length} Active Construction Site(s)`,
          description: 'Route has ongoing construction work causing delays',
          action: 'Consider announcing alternate routes to commuters',
          impact: '+25 points per construction site',
          expectedResolution: constructions[0]?.expectedEndDate?.toISOString().split('T')[0] || 'Unknown'
        });
      }

      const potholes = await Image.find({ isPothole: true, isresolved: false });
      if (potholes.length >= 3) {
        recommendations.push({
          priority: potholes.length >= 5 ? 'HIGH' : 'MEDIUM',
          category: 'Road Repair',
          title: `${potholes.length} Potholes Need Repair`,
          description: 'Multiple potholes reported by citizens, slowing traffic',
          action: 'Prioritize pothole repairs on this route',
          impact: 'Can reduce traffic score by 15-20 points after repair'
        });
      }

      const unresolvedComplaints = await Complaint.find({ isresolved: false });
      if (unresolvedComplaints.length >= 5) {
        recommendations.push({
          priority: 'LOW',
          category: 'Citizen Feedback',
          title: `${unresolvedComplaints.length} Pending Citizen Complaints`,
          description: 'Multiple traffic-related complaints awaiting resolution',
          action: 'Review and address citizen complaints',
          impact: 'Improves citizen satisfaction and identifies problem areas'
        });
      }
    }

    // If still no recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        category: 'General',
        title: 'Route Performing Well',
        description: 'No major issues detected on this route',
        action: 'Continue monitoring for any changes',
        impact: 'Maintain current traffic management practices'
      });
    }

    // Sort by priority
    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2, 'INFO': 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({
      route: route || 'All Routes',
      date: date || today.toISOString().split('T')[0],
      recommendations
    });

  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

/**
 * Get route comparison - which routes are performing worst today
 * GET /api/analytics/comparison
 */
export const getRouteComparison = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all routes
    const routes = await PathInfo.distinct('pathId');
    
    const comparison = await Promise.all(routes.map(async (route) => {
      const records = await PathInfo.find({
        pathId: route,
        date: { $gte: today, $lt: tomorrow }
      });

      if (records.length === 0) {
        return { route, avgScore: 0, recordCount: 0 };
      }

      const avgScore = records.reduce((sum, r) => sum + r.score, 0) / records.length;
      const maxScore = Math.max(...records.map(r => r.score));
      const worstSlot = records.find(r => r.score === maxScore)?.timeRange || 'N/A';

      return {
        route,
        avgScore: Math.round(avgScore * 100) / 100,
        maxScore: Math.round(maxScore * 100) / 100,
        worstSlot,
        level: getTrafficLevel(avgScore),
        recordCount: records.length
      };
    }));

    // Sort by average score (worst first)
    comparison.sort((a, b) => b.avgScore - a.avgScore);

    res.json({
      date: today.toISOString().split('T')[0],
      routes: comparison
    });

  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({ error: 'Failed to fetch route comparison' });
  }
};

/**
 * Get all available routes
 * GET /api/analytics/routes
 */
export const getAvailableRoutes = async (req, res) => {
  try {
    const routes = await PathInfo.distinct('pathId');
    res.json({ routes });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
};

// Helper functions
const getTrafficLevel = (score) => {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
};

const generateSummary = (factors, score) => {
  if (factors.length === 0) {
    return 'No significant factors affecting traffic at this time.';
  }

  const topFactor = factors[0];
  const level = getTrafficLevel(score);
  
  let summary = `Traffic is ${level} (score: ${Math.round(score)}). `;
  summary += `Primary cause: ${topFactor.name} contributing ${topFactor.score} points. `;
  
  if (factors.length > 1) {
    summary += `Other factors: ${factors.slice(1, 3).map(f => f.name).join(', ')}.`;
  }

  return summary;
};

// ========================================================================
// ADVANCED DATA SCIENCE INSIGHTS ENDPOINT
// GET /api/analytics/insights?days=30
// ========================================================================

export const getAdvancedInsights = async (req, res) => {
  try {
    const daysParam = req.query.days || '30';
    const days = daysParam === 'all' ? null : parseInt(daysParam);

    // Date range
    const endDate = new Date();
    let startDate;
    if (days) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    } else {
      startDate = new Date('2020-01-01');
    }

    const dateFilter = { $gte: startDate, $lte: endDate };

    // ----------------------------------------------------------------
    // Run all DB queries in PARALLEL
    // ----------------------------------------------------------------
    const [verifiedLogs, rawPeriodRecords] = await Promise.all([
      PredictionLog.find({ isVerified: true, predictedDate: dateFilter })
        .select('predictedScore actualScore')
        .lean(),
      PathInfo.find({ date: dateFilter })
        .select('pathId date timeRange score breakdown')
        .lean()
    ]);
    
    // Convert string scores to float to prevent string concatenation bugs
    const periodRecords = rawPeriodRecords.map(r => ({
      ...r,
      score: parseFloat(r.score) || 0
    }));

    // ----------------------------------------------------------------
    // SECTION 1: MODEL VALIDATION METRICS
    // ----------------------------------------------------------------
    let validation = {
      mae: null, mape: null, mapeSampleCount: 0, rmse: null, r2: null,
      totalSamples: verifiedLogs.length,
      accuracyBand: { within5: 0, within10: 0, within20: 0 },
      note: 'MAPE excludes samples where actual score is 0'
    };

    if (verifiedLogs.length > 0) {
      let sumAbsError = 0, sumSqError = 0, sumActual = 0;
      let mapeSum = 0, mapeSamples = 0;
      let within5 = 0, within10 = 0, within20 = 0;

      verifiedLogs.forEach(log => {
        const predicted = log.predictedScore;
        const actual = log.actualScore;
        if (actual === null || actual === undefined) return;

        const absErr = Math.abs(predicted - actual);
        sumAbsError += absErr;
        sumSqError += absErr * absErr;
        sumActual += actual;

        if (absErr <= 5)  within5++;
        if (absErr <= 10) within10++;
        if (absErr <= 20) within20++;

        if (actual !== 0) { mapeSum += absErr / actual; mapeSamples++; }
      });

      const n = verifiedLogs.length;
      validation.mae  = Math.round((sumAbsError / n) * 100) / 100;
      validation.rmse = Math.round(Math.sqrt(sumSqError / n) * 100) / 100;
      validation.mapeSampleCount = mapeSamples;
      validation.mape = mapeSamples > 0
        ? Math.round((mapeSum / mapeSamples) * 100 * 100) / 100
        : null;

      const meanActual = sumActual / n;
      let ssTot = 0, ssRes = 0;
      verifiedLogs.forEach(log => {
        if (log.actualScore === null || log.actualScore === undefined) return;
        ssRes += Math.pow(log.actualScore - log.predictedScore, 2);
        ssTot += Math.pow(log.actualScore - meanActual, 2);
      });
      validation.r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : null;

      validation.accuracyBand = {
        within5:  Math.round((within5  / n) * 1000) / 10,
        within10: Math.round((within10 / n) * 1000) / 10,
        within20: Math.round((within20 / n) * 1000) / 10
      };
    }

    // ----------------------------------------------------------------
    // SECTION 2: TRAFFIC FACTOR CONTRIBUTION (per route)
    // ----------------------------------------------------------------
    const routeGroups = {};
    periodRecords.forEach(r => {
      if (!routeGroups[r.pathId]) routeGroups[r.pathId] = [];
      routeGroups[r.pathId].push(r);
    });

    const FACTOR_LABELS = {
      construction: 'Metro/Construction',
      diversion:    'Diversion',
      event:        'Events',
      hotspot:      'Hotspots',
      pothole:      'Potholes',
      complaint:    'Complaints',
      weather:      'Weather',
      transit:      'Transit',
      metro:        'Metro Stations',
      festival:     'Festivals'
    };

    const factorContribution = {};
    Object.entries(routeGroups).forEach(([routeId, records]) => {
      const sums = {};
      Object.keys(FACTOR_LABELS).forEach(k => sums[k] = 0);

      let hasBreakdown = false;
      records.forEach(r => {
        if (r.breakdown) {
          hasBreakdown = true;
          Object.keys(FACTOR_LABELS).forEach(k => { sums[k] += r.breakdown[k] || 0; });
        }
      });

      if (!hasBreakdown) return;

      // Scale down background factors so they don't dominate the visual pie chart
      sums.weather = sums.weather * 0.15;
      sums.metro = sums.metro * 0.25;


      const totalSum = Object.values(sums).reduce((a, b) => a + b, 0);
      const contribution = {};
      Object.entries(FACTOR_LABELS).forEach(([key, label]) => {
        contribution[label] = {
          total: Math.round(sums[key] * 100) / 100,
          pct: totalSum > 0 ? Math.round((sums[key] / totalSum) * 1000) / 10 : 0
        };
      });
      factorContribution[routeId] = contribution;
    });

    // ----------------------------------------------------------------
    // SECTION 3: TREND REGRESSION (linear regression per route)
    // ----------------------------------------------------------------
    const trendRegression = {};
    Object.entries(routeGroups).forEach(([routeId, records]) => {
      const dailyMap = {};
      records.forEach(r => {
        const dateStr = new Date(r.date).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
        dailyMap[dateStr].push(parseFloat(r.score) || 0);
      });

      const dailyAvgs = Object.entries(dailyMap)
        .map(([date, scores]) => ({
          date,
          avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (dailyAvgs.length < 3) {
        trendRegression[routeId] = { slope: 0, direction: 'stable', r2: 0, dailyAvgs };
        return;
      }

      const n = dailyAvgs.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      dailyAvgs.forEach((d, i) => {
        sumX += i; sumY += d.avg; sumXY += i * d.avg; sumX2 += i * i;
      });

      const denom = (n * sumX2 - sumX * sumX);
      const slope     = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;
      const meanY = sumY / n;

      let ssTotReg = 0, ssResReg = 0;
      dailyAvgs.forEach((d, i) => {
        ssResReg += Math.pow(d.avg - (slope * i + intercept), 2);
        ssTotReg += Math.pow(d.avg - meanY, 2);
      });
      const r2Reg = ssTotReg > 0 ? Math.round((1 - ssResReg / ssTotReg) * 1000) / 1000 : 0;

      const roundedSlope = Math.round(slope * 100) / 100;
      const direction = roundedSlope > 0.1 ? 'worsening' : roundedSlope < -0.1 ? 'improving' : 'stable';

      trendRegression[routeId] = { slope: roundedSlope, direction, r2: r2Reg, dailyAvgs };
    });

    // ----------------------------------------------------------------
    // SECTION 4: ROUTE STATISTICS
    // ----------------------------------------------------------------
    const routeStats = {};
    Object.entries(routeGroups).forEach(([routeId, records]) => {
      const scores = records.map(r => r.score).sort((a, b) => a - b);
      const n = scores.length;
      const mean = scores.reduce((a, b) => a + b, 0) / n;
      const median = n % 2 === 0
        ? (scores[n / 2 - 1] + scores[n / 2]) / 2
        : scores[Math.floor(n / 2)];
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;

      const slotAvgs = {};
      records.forEach(r => {
        if (!slotAvgs[r.timeRange]) slotAvgs[r.timeRange] = { sum: 0, count: 0 };
        slotAvgs[r.timeRange].sum += r.score;
        slotAvgs[r.timeRange].count++;
      });
      let peakHour = 'N/A', peakAvg = 0;
      Object.entries(slotAvgs).forEach(([slot, data]) => {
        const avg = data.sum / data.count;
        if (avg > peakAvg) { peakAvg = avg; peakHour = slot; }
      });

      routeStats[routeId] = {
        mean:        Math.round(mean * 100) / 100,
        median:      Math.round(median * 100) / 100,
        std:         Math.round(Math.sqrt(variance) * 100) / 100,
        min:         Math.round(Math.min(...scores) * 100) / 100,
        max:         Math.round(Math.max(...scores) * 100) / 100,
        peakHour,
        recordCount: n
      };
    });

    // ----------------------------------------------------------------
    // SECTION 5: AUTOMATED INSIGHTS
    // ----------------------------------------------------------------
    const insights = [];

    // Worsening routes
    Object.entries(trendRegression).forEach(([routeId, data]) => {
      if (data.slope > 0.2) {
        insights.push(
          `${routeId.replace(/-/g, ' → ')} is showing a steady increase in traffic over the selected period. Traffic is getting heavier day by day on this route.`
        );
      }
    });

    // Improving routes
    Object.entries(trendRegression).forEach(([routeId, data]) => {
      if (data.slope < -0.2) {
        insights.push(
          `${routeId.replace(/-/g, ' → ')} is showing an improvement in traffic flow over the selected period. Congestion on this route has been easing.`
        );
      }
    });

    // Dominant factor per route
    Object.entries(factorContribution).forEach(([routeId, factors]) => {
      const sorted = Object.entries(factors).sort((a, b) => b[1].pct - a[1].pct);
      if (sorted.length > 0 && sorted[0][1].pct > 30) {
        insights.push(
          `${sorted[0][0]} is the biggest contributor to traffic scores on ${routeId.replace(/-/g, ' → ')}, accounting for ${sorted[0][1].pct}% of the total score.`
        );
      }
    });

    // Best/worst route
    const routeEntries = Object.entries(routeStats);
    if (routeEntries.length >= 2) {
      const sorted = routeEntries.sort((a, b) => b[1].mean - a[1].mean);
      const worst = sorted[0];
      const best  = sorted[sorted.length - 1];
      insights.push(
        `${worst[0].replace(/-/g, ' → ')} has the highest average traffic score (${worst[1].mean}) — it is the most congested route in this period.`
      );
      insights.push(
        `${best[0].replace(/-/g, ' → ')} has the lowest average traffic score (${best[1].mean}), making it the least congested route.`
      );
    }

    // Prediction accuracy
    if (validation.mae !== null) {
      const accuracy = validation.r2 !== null ? Math.round(validation.r2 * 100) : null;
      insights.push(
        `On average, traffic predictions are off by ${validation.mae} points.${accuracy !== null ? ` The model explains ${accuracy}% of actual traffic variation.` : ''}`
      );
    }

    // Peak hour insight
    const peakCounts = {};
    Object.values(routeStats).forEach(s => {
      peakCounts[s.peakHour] = (peakCounts[s.peakHour] || 0) + 1;
    });
    const mostCommonPeak = Object.entries(peakCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonPeak) {
      insights.push(
        `The busiest time slot across routes is ${mostCommonPeak[0]}, when traffic scores tend to peak.`
      );
    }

    // ----------------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------------
    res.json({
      period: {
        days: days || 'all',
        startDate: startDate.toISOString().split('T')[0],
        endDate:   endDate.toISOString().split('T')[0]
      },
      validation,
      factorContribution,
      trendRegression,
      routeStats,
      insights: insights.slice(0, 10)
    });

  } catch (error) {
    console.error('Error computing advanced insights:', error);
    res.status(500).json({ error: 'Failed to compute advanced insights' });
  }
};