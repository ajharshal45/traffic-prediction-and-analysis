import PathInfo from '../models/pathinfo.model.js';
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
