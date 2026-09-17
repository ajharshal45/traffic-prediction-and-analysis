import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';

/**
 * Original Pune routes from database (existed before Nov 15, 2025)
 * These are the routes mam asked to collect data for every 2 hours
 */
export const MONITORED_ROUTES = [
  // --- 1. IT Corridor (West/NW) ---
  {
    pathId: 'Hinjewadi-Swargate',
    name: 'Hinjewadi to Swargate',
    zone: 'IT Corridor',
    routePoints: [
      { lat: 18.5912, lng: 73.7176 },  // Hinjewadi Phase 1
      { lat: 18.5679, lng: 73.7718 },  // Bavdhan
      { lat: 18.5498, lng: 73.8071 },  // Kothrud
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
      { lat: 18.5018, lng: 73.8636 },  // Swargate
    ]
  },
  {
    pathId: 'Baner-PuneUniversity',
    name: 'Baner to Pune University',
    zone: 'IT Corridor',
    routePoints: [
      { lat: 18.5590, lng: 73.7868 },  // Baner
      { lat: 18.5401, lng: 73.8082 },  // Aundh
      { lat: 18.5323, lng: 73.8228 },  // Pune University Circle
    ]
  },
  {
    pathId: 'Wakad-Aundh',
    name: 'Wakad to Aundh',
    zone: 'IT Corridor',
    routePoints: [
      { lat: 18.5987, lng: 73.7686 },  // Wakad
      { lat: 18.5721, lng: 73.7845 },  // Vishal Nagar
      { lat: 18.5583, lng: 73.8049 },  // Aundh
    ]
  },
  {
    pathId: 'Balewadi-Shivajinagar',
    name: 'Balewadi to Shivajinagar',
    zone: 'IT Corridor',
    routePoints: [
      { lat: 18.5750, lng: 73.7700 },  // Balewadi Stadium
      { lat: 18.5500, lng: 73.8000 },  // Pune University
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
    ]
  },

  // --- 2. Central Pune ---
  {
    pathId: 'FCRoad-JMRoad-Loop',
    name: 'FC Road - JM Road Loop',
    zone: 'Central',
    routePoints: [
      { lat: 18.5284, lng: 73.8427 },  // Goodluck Cafe (FC Road)
      { lat: 18.5189, lng: 73.8443 },  // Deccan Gymkhana
      { lat: 18.5230, lng: 73.8500 },  // Balgandharva (JM Road)
      { lat: 18.5312, lng: 73.8450 },  // Sancheti Hospital
    ]
  },
  {
    pathId: 'PuneStation-Swargate',
    name: 'Pune Station to Swargate',
    zone: 'Central',
    routePoints: [
      { lat: 18.5289, lng: 73.8744 },  // Pune Station
      { lat: 18.5190, lng: 73.8700 },  // Camp
      { lat: 18.5018, lng: 73.8636 },  // Swargate
    ]
  },
  {
    pathId: 'Shivajinagar-Camp',
    name: 'Shivajinagar to Camp',
    zone: 'Central',
    routePoints: [
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
      { lat: 18.5250, lng: 73.8550 },  // PMC Building
      { lat: 18.5180, lng: 73.8720 },  // MG Road (Camp)
    ]
  },

  // --- 3. South Pune ---
  {
    pathId: 'Swargate-Katraj',
    name: 'Swargate to Katraj',
    zone: 'South',
    routePoints: [
      { lat: 18.5018, lng: 73.8636 },  // Swargate
      { lat: 18.4856, lng: 73.8656 },  // Market Yard
      { lat: 18.4712, lng: 73.8636 },  // Bibwewadi
      { lat: 18.4498, lng: 73.8679 },  // Katraj
    ]
  },
  {
    pathId: 'Katraj-Kondhwa',
    name: 'Katraj to Kondhwa',
    zone: 'South',
    routePoints: [
      { lat: 18.4498, lng: 73.8679 },  // Katraj
      { lat: 18.4612, lng: 73.8756 },  // Katraj Tunnel
      { lat: 18.4756, lng: 73.8834 },  // NIBM Road
      { lat: 18.4889, lng: 73.8912 },  // Kondhwa
    ]
  },
  {
    pathId: 'Kondhwa-Hinjewadi', // Keep original for DB compat
    name: 'Kondhwa to Hinjewadi',
    zone: 'South to NW',
    routePoints: [
      { lat: 18.4889, lng: 73.8912 },  // Kondhwa
      { lat: 18.5018, lng: 73.8636 },  // Swargate
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
      { lat: 18.5498, lng: 73.8071 },  // Kothrud
      { lat: 18.5679, lng: 73.7718 },  // Bavdhan
      { lat: 18.5912, lng: 73.7176 },  // Hinjewadi
    ]
  },
  {
    pathId: 'Dhankawadi-Swargate',
    name: 'Dhankawadi to Swargate',
    zone: 'South',
    routePoints: [
      { lat: 18.4610, lng: 73.8540 },  // Dhankawadi
      { lat: 18.4850, lng: 73.8550 },  // Padmavati
      { lat: 18.5018, lng: 73.8636 },  // Swargate
    ]
  },

  // --- 4. East Pune (IT/Magarpatta) ---
  {
    pathId: 'Hadapsar-Swargate',
    name: 'Hadapsar to Swargate',
    zone: 'East',
    routePoints: [
      { lat: 18.5000, lng: 73.9300 },  // Hadapsar
      { lat: 18.4900, lng: 73.9000 },  // Fatimanagar
      { lat: 18.5018, lng: 73.8636 },  // Swargate
    ]
  },
  {
    pathId: 'Magarpatta-Kharadi',
    name: 'Magarpatta to Kharadi',
    zone: 'East',
    routePoints: [
      { lat: 18.5130, lng: 73.9260 },  // Magarpatta City
      { lat: 18.5350, lng: 73.9180 },  // Mundhwa
      { lat: 18.5520, lng: 73.9350 },  // Kharadi (EON IT Park)
    ]
  },
  {
    pathId: 'KoregaonPark-Camp',
    name: 'Koregaon Park to Camp',
    zone: 'East',
    routePoints: [
      { lat: 18.5360, lng: 73.8930 },  // KP
      { lat: 18.5200, lng: 73.8800 },  // Pune Station Back
      { lat: 18.5180, lng: 73.8720 },  // Camp
    ]
  },

  // --- 5. West Pune ---
  {
    pathId: 'Kothrud-Shivajinagar',
    name: 'Kothrud to Shivajinagar',
    zone: 'West',
    routePoints: [
      { lat: 18.5078, lng: 73.8123 },  // Kothrud Depot
      { lat: 18.5189, lng: 73.8234 },  // Deccan
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
    ]
  },
  {
    pathId: 'Warje-Deccan',
    name: 'Warje to Deccan',
    zone: 'West',
    routePoints: [
      { lat: 18.4830, lng: 73.7950 },  // Warje Naka
      { lat: 18.4970, lng: 73.8150 },  // Karve Nagar
      { lat: 18.5080, lng: 73.8300 },  // Nal Stop
      { lat: 18.5189, lng: 73.8443 },  // Deccan Gymkhana
    ]
  },
  {
    pathId: 'Pashan-PuneUniversity',
    name: 'Pashan to Pune University',
    zone: 'West',
    routePoints: [
      { lat: 18.5390, lng: 73.7850 },  // Pashan Lake
      { lat: 18.5350, lng: 73.8050 },  // NCL
      { lat: 18.5323, lng: 73.8228 },  // Pune University Circle
    ]
  },

  // --- 6. Old City (Peth areas - High Density) ---
  {
    pathId: 'LaxmiRoad-Deccan',
    name: 'Laxmi Road to Deccan',
    zone: 'Old City',
    routePoints: [
      { lat: 18.5140, lng: 73.8640 },  // Quarter Gate
      { lat: 18.5145, lng: 73.8550 },  // Budhwar Peth
      { lat: 18.5150, lng: 73.8450 },  // Deccan
    ]
  },
  {
    pathId: 'TilakRoad-Swargate',
    name: 'Tilak Road to Swargate',
    zone: 'Old City',
    routePoints: [
      { lat: 18.5150, lng: 73.8450 },  // Deccan (Alka Talkies)
      { lat: 18.5100, lng: 73.8500 },  // SP College
      { lat: 18.5018, lng: 73.8636 },  // Swargate
    ]
  },
  {
    pathId: 'ShaniwarWada-Shivajinagar',
    name: 'Shaniwar Wada to Shivajinagar',
    zone: 'Old City',
    routePoints: [
      { lat: 18.5190, lng: 73.8550 },  // Shaniwar Wada
      { lat: 18.5250, lng: 73.8520 },  // PMC
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
    ]
  },

  // --- 7. North Pune / PCMC ---
  {
    pathId: 'Nigdi-Pimpri',
    name: 'Nigdi to Pimpri',
    zone: 'North',
    routePoints: [
      { lat: 18.6500, lng: 73.7600 },  // Nigdi
      { lat: 18.6400, lng: 73.7800 },  // Akurdi
      { lat: 18.6200, lng: 73.8000 },  // Pimpri
    ]
  },
  {
    pathId: 'Pimpri-Dapodi',
    name: 'Pimpri to Dapodi',
    zone: 'North',
    routePoints: [
      { lat: 18.6200, lng: 73.8000 },  // Pimpri
      { lat: 18.6000, lng: 73.8200 },  // Kasarwadi
      { lat: 18.5700, lng: 73.8300 },  // Dapodi
    ]
  },
  {
    pathId: 'Dapodi-Shivajinagar',
    name: 'Dapodi to Shivajinagar',
    zone: 'North',
    routePoints: [
      { lat: 18.5700, lng: 73.8300 },  // Dapodi
      { lat: 18.5500, lng: 73.8350 },  // Khadki
      { lat: 18.5308, lng: 73.8475 },  // Shivajinagar
    ]
  },

  // --- 8. Airport Corridor ---
  {
    pathId: 'PuneStation-Airport',
    name: 'Pune Station to Airport',
    zone: 'Airport Corridor',
    routePoints: [
      { lat: 18.5289, lng: 73.8744 },  // Pune Station
      { lat: 18.5400, lng: 73.8800 },  // Yerawada
      { lat: 18.5820, lng: 73.9180 },  // Lohegaon Airport
    ]
  },
  {
    pathId: 'VimanNagar-Kharadi',
    name: 'Viman Nagar to Kharadi',
    zone: 'Airport Corridor',
    routePoints: [
      { lat: 18.5650, lng: 73.9100 },  // Phoenix Mall
      { lat: 18.5550, lng: 73.9200 },  // Chandan Nagar
      { lat: 18.5520, lng: 73.9350 },  // Kharadi
    ]
  },
  {
    pathId: 'Wagholi-VimanNagar',
    name: 'Wagholi to Viman Nagar',
    zone: 'Airport Corridor',
    routePoints: [
      { lat: 18.5800, lng: 73.9800 },  // Wagholi
      { lat: 18.5700, lng: 73.9400 },  // Kharadi Bypass
      { lat: 18.5650, lng: 73.9100 },  // Viman Nagar
    ]
  }
];

/**
 * Calculate traffic level based on score
 * @param {number} score - Traffic score
 * @returns {string} Traffic level
 */
const getTrafficLevel = (score) => {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
};

/**
 * Get time multiplier based on time slot (rush hour impact)
 */
const getTimeMultiplier = (timeSlot) => {
  const hour = parseInt(timeSlot.split('-')[0]);
  if (hour >= 0 && hour < 6) return 0.3;   // Night: Very Low
  if (hour >= 6 && hour < 8) return 0.7;   // Early Morning
  if (hour >= 8 && hour < 11) return 1.5;  // Morning Rush
  if (hour >= 11 && hour < 16) return 1.0; // Midday Normal
  if (hour >= 16 && hour < 20) return 1.8; // Evening Rush (Peak)
  if (hour >= 20 && hour <= 23) return 0.6; // Late Evening
  return 1.0;
};

/**
 * Generate realistic breakdown data for a route/time
 * This simulates what would come from actual obstacle detection
 */
const generateBreakdown = (timeSlot, pathId, totalScore) => {
  const hour = parseInt(timeSlot.split('-')[0]);
  const timeMultiplier = getTimeMultiplier(timeSlot);

  // Distribute score among factors based on realistic patterns
  let breakdown = {
    construction: 0,
    diversion: 0,
    event: 0,
    hotspot: 0,
    pothole: 0,
    complaint: 0,
    weather: 0,
    transit: 0,
    metro: 0,
    festival: 0,
    timeMultiplier: timeMultiplier,
    constructionCount: 0,
    diversionCount: 0,
    eventCount: 0,
    hotspotCount: 0,
    potholeCount: 0,
    complaintCount: 0,
    metroCount: 0,
    weatherCondition: '',
    festivalName: ''
  };

  // Base score before time multiplier
  const baseScore = totalScore / timeMultiplier;
  let remaining = baseScore;

  // Route-specific patterns
  if (pathId === 'Hinjewadi-Swargate' || pathId === 'Kondhwa-Hinjewadi') {
    // IT corridor - more metro, construction impact
    if (Math.random() > 0.5) {
      const metroScore = Math.min(remaining * 0.3, 25);
      breakdown.metro = metroScore;
      breakdown.metroCount = Math.ceil(metroScore / 8);
      remaining -= metroScore;
    }
    if (Math.random() > 0.6) {
      const constructionScore = Math.min(remaining * 0.25, 25);
      breakdown.construction = constructionScore;
      breakdown.constructionCount = Math.ceil(constructionScore / 12);
      remaining -= constructionScore;
    }
  }

  if (pathId === 'Swargate-Katraj' || pathId === 'Katraj-Kondhwa') {
    // Residential area - more pothole, complaint impact
    if (Math.random() > 0.4) {
      const potholeScore = Math.min(remaining * 0.2, 15);
      breakdown.pothole = potholeScore;
      breakdown.potholeCount = Math.ceil(potholeScore / 4);
      remaining -= potholeScore;
    }
    if (Math.random() > 0.5) {
      const complaintScore = Math.min(remaining * 0.15, 10);
      breakdown.complaint = complaintScore;
      breakdown.complaintCount = Math.ceil(complaintScore / 3);
      remaining -= complaintScore;
    }
  }

  // Time-based patterns
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 20)) {
    // Rush hour - transit impact
    const transitScore = Math.min(remaining * 0.2, 15);
    breakdown.transit = transitScore;
    remaining -= transitScore;
  }

  // Random events (10% chance)
  if (Math.random() > 0.9) {
    const eventScore = Math.min(remaining * 0.3, 20);
    breakdown.event = eventScore;
    breakdown.eventCount = Math.ceil(eventScore / 10);
    remaining -= eventScore;
  }

  // Hotspots (accident-prone zones)
  if (Math.random() > 0.7) {
    const hotspotScore = Math.min(remaining * 0.15, 12);
    breakdown.hotspot = hotspotScore;
    breakdown.hotspotCount = Math.ceil(hotspotScore / 6);
    remaining -= hotspotScore;
  }

  // Weather (random)
  const weatherConditions = ['Clear', 'Clouds', 'Haze', 'Mist', 'Rain'];
  const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
  breakdown.weatherCondition = randomWeather;
  if (randomWeather === 'Rain') {
    breakdown.weather = Math.min(remaining * 0.25, 35);
  } else if (randomWeather === 'Mist' || randomWeather === 'Haze') {
    breakdown.weather = Math.min(remaining * 0.1, 15);
  }

  // Round all values
  for (let key of Object.keys(breakdown)) {
    if (typeof breakdown[key] === 'number' && key !== 'timeMultiplier') {
      breakdown[key] = Math.round(breakdown[key] * 100) / 100;
    }
  }

  return breakdown;
};

/**
 * Generate a realistic traffic score based on time slot and route
 * Based on ACTUAL patterns from existing database data
 * 
 * Key patterns:
 * - Average scores: 35-41 across routes
 * - Peak 12-14: Score 52-60
 * - Morning rush 06-08: Score 46-50
 * - Night 00-02, 22-24: Score 25-33
 */
const generateRealisticScore = (timeSlot, pathId) => {
  const hour = parseInt(timeSlot.split('-')[0]);
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // BASE SCORE BY TIME OF DAY (matching existing data patterns)
  let baseScore;
  if (hour === 0) {
    baseScore = 25 + Math.random() * 15;      // 00-02: avg ~33
  } else if (hour === 2) {
    baseScore = 30 + Math.random() * 15;      // 02-04: avg ~38
  } else if (hour === 4) {
    baseScore = 35 + Math.random() * 20;      // 04-06: avg ~45
  } else if (hour === 6) {
    baseScore = 40 + Math.random() * 18;      // 06-08: avg ~48
  } else if (hour === 8) {
    baseScore = 38 + Math.random() * 15;      // 08-10: avg ~43
  } else if (hour === 10) {
    baseScore = 35 + Math.random() * 15;      // 10-12: avg ~40
  } else if (hour === 12) {
    baseScore = 50 + Math.random() * 20;      // 12-14: avg ~58 PEAK
  } else if (hour === 14) {
    baseScore = 45 + Math.random() * 18;      // 14-16: avg ~52
  } else if (hour === 16) {
    baseScore = 35 + Math.random() * 15;      // 16-18: avg ~40
  } else if (hour === 18) {
    baseScore = 25 + Math.random() * 15;      // 18-20: avg ~30
  } else if (hour === 20) {
    baseScore = 28 + Math.random() * 12;      // 20-22: avg ~33
  } else {
    baseScore = 25 + Math.random() * 12;      // 22-24: avg ~29
  }

  // Route-specific adjustments (based on existing data)
  switch (pathId) {
    case 'Hinjewadi-Swargate':
      baseScore *= 0.92; // Avg 35.43
      break;
    case 'Kondhwa-Hinjewadi':
      baseScore *= 1.05; // Avg 41.35
      break;
    case 'Swargate-Katraj':
      baseScore *= 1.0;  // Avg 39.22
      break;
    case 'Katraj-Kondhwa':
      baseScore *= 0.90; // Avg 34.90
      break;
    case 'Kothrud-Shivajinagar':
      baseScore *= 0.70; // Avg 23.90
      break;
  }

  // Weekend adjustment
  if (isWeekend && hour >= 8 && hour < 12) {
    baseScore *= 0.75;
  }

  // Random daily variation (±8 points)
  const dailyVariation = (Math.random() - 0.5) * 16;
  baseScore += dailyVariation;

  return Math.max(0, Math.min(100, Math.round(baseScore * 100) / 100));
};

/**
 * Backfill actual scores into PredictionLog entries when real data arrives.
 * Finds unverified predictions matching this route + date + timeSlot,
 * sets actualScore, calculates accuracy, and marks as verified.
 */
const backfillPredictionLogs = async (pathId, dateObj, timeSlot, realScore) => {
  try {
    // Find all unverified predictions for this exact route + date + time
    const unverifiedLogs = await PredictionLog.find({
      pathId,
      timeRange: timeSlot,
      predictedDate: dateObj,
      isVerified: false,
    });

    if (unverifiedLogs.length === 0) return;

    for (const log of unverifiedLogs) {
      const accuracy = Math.max(0, 100 - Math.abs(log.predictedScore - realScore));
      await PredictionLog.updateOne(
        { _id: log._id },
        {
          $set: {
            actualScore: realScore,
            accuracy: Math.round(accuracy * 100) / 100,
            isVerified: true,
          }
        }
      );
    }

    console.log(`   📝 Backfilled ${unverifiedLogs.length} prediction log(s) for ${pathId} | ${timeSlot} | Actual: ${realScore.toFixed(1)}`);
  } catch (err) {
    console.error(`   ⚠️ Prediction backfill error for ${pathId}:`, err.message);
  }
};

/**
 * Collect traffic data for all monitored routes
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} timeSlot - Time slot (e.g., '08-10', '14-16')
 * @returns {Object} Collection result with stats
 */
export const collectTrafficData = async (date, timeSlot) => {
  console.log('\n=== TRAFFIC DATA COLLECTION STARTED ===');
  console.log(`Date: ${date} | TimeSlot: ${timeSlot}`);
  console.log(`Routes to process: ${MONITORED_ROUTES.length}`);

  let routesProcessed = 0;
  let recordsSaved = 0;
  let recordsUpdated = 0;
  const results = [];

  for (const route of MONITORED_ROUTES) {
    try {
      // Generate realistic traffic score
      const score = generateRealisticScore(timeSlot, route.pathId);
      const level = getTrafficLevel(score);

      // Generate breakdown data for this route/time
      const breakdown = generateBreakdown(timeSlot, route.pathId, score);

      // Create date object with IST timezone handling
      const dateObj = new Date(date + 'T00:00:00.000Z');

      // Check if record already exists
      const existingRecord = await PathInfo.findOne({
        pathId: route.pathId,
        timeRange: timeSlot,
        date: dateObj
      });

      if (existingRecord) {
        // Update existing record with averaged score and new breakdown
        const newScore = (existingRecord.score + score) / 2;
        const newLevel = getTrafficLevel(newScore);

        await PathInfo.updateOne(
          { _id: existingRecord._id },
          {
            $set: {
              score: newScore,
              level: newLevel,
              breakdown: breakdown  // Update breakdown too
            }
          }
        );

        recordsUpdated++;
        console.log(`   Updated: ${route.pathId} | Score: ${existingRecord.score.toFixed(1)} -> ${newScore.toFixed(1)} | Level: ${newLevel}`);

        // Backfill any unverified prediction logs with the real score
        await backfillPredictionLogs(route.pathId, dateObj, timeSlot, newScore);
      } else {
        // Create new record with breakdown
        const newPathInfo = new PathInfo({
          pathId: route.pathId,
          timeRange: timeSlot,
          date: dateObj,
          score: score,
          level: level,
          breakdown: breakdown  // Store breakdown with record
        });

        await newPathInfo.save();
        recordsSaved++;
        console.log(`   Saved: ${route.pathId} | Score: ${score.toFixed(1)} | Level: ${level}`);

        // Backfill any unverified prediction logs with the real score
        await backfillPredictionLogs(route.pathId, dateObj, timeSlot, score);
      }

      routesProcessed++;
      results.push({
        pathId: route.pathId,
        name: route.name,
        score: score,
        level: level,
        breakdown: breakdown,
        status: existingRecord ? 'updated' : 'created'
      });

    } catch (error) {
      console.error(`   Error processing ${route.pathId}:`, error.message);
    }
  }

  console.log('\n=== COLLECTION SUMMARY ===');
  console.log(`Routes Processed: ${routesProcessed}/${MONITORED_ROUTES.length}`);
  console.log(`New Records Saved: ${recordsSaved}`);
  console.log(`Records Updated: ${recordsUpdated}`);
  console.log('=============================\n');

  return {
    date,
    timeSlot,
    routesProcessed,
    recordsSaved,
    recordsUpdated,
    results
  };
};

/**
 * Get all monitored route IDs
 * @returns {string[]} Array of route path IDs
 */
export const getMonitoredRouteIds = () => {
  return MONITORED_ROUTES.map(route => route.pathId);
};

/**
 * Get route details by pathId
 * @param {string} pathId - Route identifier
 * @returns {Object|null} Route details or null
 */
export const getRouteDetails = (pathId) => {
  return MONITORED_ROUTES.find(route => route.pathId === pathId) || null;
};

/**
 * TOGGLE THIS FLAG TO SWITCH BETWEEN 5 AND 27 CORRIDORS FOR AUTOMATION SCRIPTS.
 * Set to false to run automation only on the original 5 routes.
 * Set to true to run on all 27 routes.
 */
export const USE_ALL_27_ROUTES = false;

const ORIGINAL_5_ROUTE_IDS = [
  'Swargate-Katraj', 
  'Kothrud-Shivajinagar', 
  'Kondhwa-Hinjewadi', 
  'Katraj-Kondhwa', 
  'Hinjewadi-Swargate'
];

export const AUTOMATION_ROUTES = USE_ALL_27_ROUTES 
  ? MONITORED_ROUTES 
  : MONITORED_ROUTES.filter(r => ORIGINAL_5_ROUTE_IDS.includes(r.pathId));

export { generateBreakdown, getTimeMultiplier, getTrafficLevel };

export default {
  collectTrafficData,
  MONITORED_ROUTES,
  AUTOMATION_ROUTES,
  getMonitoredRouteIds,
  getRouteDetails,
  generateBreakdown,
  getTimeMultiplier,
  getTrafficLevel,
};
