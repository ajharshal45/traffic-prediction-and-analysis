/**
 * backfillTillNov5.js
 *
 * Backfills missing point-to-point segment tracking (RouteSegmentLog)
 * AND whole-route traffic data (PathInfo) across all 5 monitored routes
 * up to today: November 5, 2026.
 *
 * Key Realistic Factor:
 *  - HEAVY PUNE METRO UNDERGROUND / ELEVATED CONSTRUCTION on Swargate - Katraj (Satara Road Corridor):
 *    * Underground tunneling, shaft digging, and heavy barricading from Swargate to Market Yard & Bibwewadi.
 *    * Elevated pillar construction & excavation continuing towards Dhankawadi Chowk & Padmavati / Dolphin Chowk.
 *    * Road narrowing from 6-lane carriageway down to bottlenecked 2-lane strips, causing severe vehicle queues.
 *    * Peak hours encounter heavy congestion (hotspot multiplier 1.85x - 2.2x), with explicit cause descriptions:
 *      "Swargate-Katraj Metro underground tunnel & shaft excavation - heavy lane narrowing & barricading"
 *      "Padmavati to Katraj Ghat Metro elevated pier construction & BRTS lane squeeze"
 */

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../mongoose/connection.js';
import RouteSegmentLog from '../models/routeSegmentLog.model.js';
import PathInfo from '../models/pathinfo.model.js';
import { AUTOMATION_ROUTES } from '../services/dataCollector.service.js';

const SEGMENT_ROUTES = [
  {
    pathId: 'Swargate-Katraj',
    name: 'Swargate → Katraj',
    corridor: 'Satara Road Corridor (Metro Construction Zone)',
    waypoints: [
      { lat: 18.50183, lng: 73.86359, label: 'Swargate Bus Stand' },
      { lat: 18.49664, lng: 73.85809, label: 'Lakshminarayan Cinema' },
      { lat: 18.48519, lng: 73.85929, label: 'Bibwewadi / Market Yard' },
      { lat: 18.47179, lng: 73.86344, label: 'Dhankawadi Chowk' },
      { lat: 18.46242, lng: 73.86527, label: 'Padmavati / Dolphin Chowk' },
      { lat: 18.45760, lng: 73.86475, label: 'Katraj Ghat Entry' },
      { lat: 18.44980, lng: 73.86790, label: 'Katraj Circle' },
    ],
    baseSegments: [
      { dist: 1208, normal: 300 },
      { dist: 1340, normal: 260 },
      { dist: 1570, normal: 250 },
      { dist: 1417, normal: 240 },
      { dist: 743,  normal: 130 },
      { dist: 1125, normal: 230 }
    ]
  },
  {
    pathId: 'Katraj-Kondhwa',
    name: 'Katraj → Kondhwa',
    corridor: 'Katraj-Kondhwa Bypass',
    waypoints: [
      { lat: 18.44980, lng: 73.86790, label: 'Katraj Circle' },
      { lat: 18.44963, lng: 73.87143, label: 'Rajas Society' },
      { lat: 18.45080, lng: 73.87955, label: 'Tilekar Nagar' },
      { lat: 18.45388, lng: 73.88665, label: 'Khadki Chowk (Kondhwa Rd)' },
      { lat: 18.45248, lng: 73.89099, label: 'Kondhwa Budruk' },
      { lat: 18.46314, lng: 73.88947, label: 'Kondhwa Khurd' },
      { lat: 18.46948, lng: 73.88895, label: 'Kondhwa Main / Jyoti Chowk' },
    ],
    baseSegments: [
      { dist: 1064, normal: 240 },
      { dist: 874,  normal: 180 },
      { dist: 847,  normal: 150 },
      { dist: 504,  normal: 90  },
      { dist: 1223, normal: 240 },
      { dist: 716,  normal: 140 }
    ]
  },
  {
    pathId: 'Hinjewadi-Swargate',
    name: 'Hinjewadi → Swargate',
    corridor: 'IT Express Highway & Senapati Bapat Road',
    waypoints: [
      { lat: 18.59046, lng: 73.72719, label: 'Hinjewadi Phase 1 Circle' },
      { lat: 18.59407, lng: 73.73056, label: 'Wakad Bridge / Highway Crossing' },
      { lat: 18.59227, lng: 73.75955, label: 'Baner Road Junction' },
      { lat: 18.59203, lng: 73.78478, label: 'Aundh Ravet BRT Chowk' },
      { lat: 18.56915, lng: 73.81124, label: 'Pune University Circle' },
      { lat: 18.53177, lng: 73.84387, label: 'Deccan Gymkhana' },
      { lat: 18.51855, lng: 73.85628, label: 'Tilak Road Corner' },
      { lat: 18.50225, lng: 73.86337, label: 'Swargate Terminal' },
    ],
    baseSegments: [
      { dist: 1850, normal: 290 },
      { dist: 3100, normal: 420 },
      { dist: 2800, normal: 380 },
      { dist: 3600, normal: 480 },
      { dist: 4200, normal: 540 },
      { dist: 2100, normal: 320 },
      { dist: 1950, normal: 290 }
    ]
  },
  {
    pathId: 'Kondhwa-Hinjewadi',
    name: 'Kondhwa → Hinjewadi',
    corridor: 'Katraj Bypass & Western Express Ring',
    waypoints: [
      { lat: 18.46948, lng: 73.88898, label: 'Kondhwa Khurd Gate' },
      { lat: 18.44969, lng: 73.87453, label: 'Tilekar Nagar Bypass' },
      { lat: 18.45476, lng: 73.83628, label: 'Vadgaon Flyover' },
      { lat: 18.49343, lng: 73.78834, label: 'Warje Bridge (NH48)' },
      { lat: 18.51417, lng: 73.76946, label: 'Chandani Chowk Flyover' },
      { lat: 18.55022, lng: 73.77250, label: 'Bavdhan - Pashan Link' },
      { lat: 18.59122, lng: 73.73897, label: 'Wakad Bypass Bridge' },
      { lat: 18.59046, lng: 73.72719, label: 'Hinjewadi IT Park Entry' },
    ],
    baseSegments: [
      { dist: 2400, normal: 360 },
      { dist: 4600, normal: 520 },
      { dist: 5800, normal: 600 },
      { dist: 3400, normal: 420 },
      { dist: 4100, normal: 480 },
      { dist: 4800, normal: 540 },
      { dist: 2200, normal: 310 }
    ]
  },
  {
    pathId: 'Kothrud-Shivajinagar',
    name: 'Kothrud → Shivajinagar',
    corridor: 'Karve Road & FC Road Arterial',
    waypoints: [
      { lat: 18.50737, lng: 73.80765, label: 'Kothrud Stand / Gujarat Colony' },
      { lat: 18.50947, lng: 73.81195, label: 'Vanaz Metro Station' },
      { lat: 18.50990, lng: 73.82125, label: 'Paud Road Junction' },
      { lat: 18.51016, lng: 73.83402, label: 'Karve Statue Chowk' },
      { lat: 18.51739, lng: 73.84248, label: 'Deccan Corner' },
      { lat: 18.52347, lng: 73.84661, label: 'Fergusson College Road' },
      { lat: 18.52918, lng: 73.84988, label: 'Shivajinagar Court / Simla Office' },
    ],
    baseSegments: [
      { dist: 780,  normal: 130 },
      { dist: 1100, normal: 180 },
      { dist: 1450, normal: 220 },
      { dist: 1350, normal: 210 },
      { dist: 920,  normal: 160 },
      { dist: 1050, normal: 170 }
    ]
  },
];

const ALL_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
];

// Rush hour multipliers
const getSlotMultiplier = (slot) => {
  switch (slot) {
    case '00-02':
    case '02-04':
    case '04-06': return 1.0;  // night clear flow
    case '06-08': return 1.25; // early morning traffic building up
    case '08-10': return 1.75; // morning peak rush
    case '10-12': return 1.50; // late morning active hours
    case '12-14': return 1.30; // afternoon lunch hours
    case '14-16': return 1.35; // early afternoon
    case '16-18': return 1.70; // school & early commute rush
    case '18-20': return 1.95; // peak evening rush hour
    case '20-22': return 1.45; // post-dinner cool down
    case '22-24': return 1.15; // late night
    default: return 1.2;
  }
};

const getLevel = (score) => {
  if (score <= 10) return 'low';
  if (score <= 25) return 'medium';
  if (score <= 50) return 'high';
  return 'very high';
};

const getTrafficLevel = (score) => {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
};

const analyzeCause = (pathId, fromLabel, toLabel, dateStr, score) => {
  if (pathId === 'Swargate-Katraj') {
    // Katraj-Swargate has HEAVY METRO CONSTRUCTION
    if (fromLabel.includes('Swargate') || toLabel.includes('Lakshminarayan') || fromLabel.includes('Market Yard') || toLabel.includes('Market Yard')) {
      return {
        cause: 'Heavy Metro Underground Work: Shaft excavation & heavy barricading along Satara Road',
        category: 'construction'
      };
    }
    if (fromLabel.includes('Dhankawadi') || toLabel.includes('Padmavati') || fromLabel.includes('Padmavati')) {
      return {
        cause: 'Heavy Metro Elevated Pier Construction: Road narrowing to single lane & BRTS squeeze',
        category: 'construction'
      };
    }
    if (toLabel.includes('Katraj Ghat') || toLabel.includes('Katraj Circle')) {
      return {
        cause: 'Metro underground ramp staging area & Katraj Circle vehicle queue',
        category: 'construction'
      };
    }
    return {
      cause: 'Metro corridor construction congestion & heavy vehicle movement',
      category: 'construction'
    };
  }

  if (score <= 10) return { cause: 'Normal Free Flow', category: 'regular' };

  if (pathId === 'Katraj-Kondhwa') {
    if (fromLabel.includes('Rajas') || toLabel.includes('Tilekar') || fromLabel.includes('Khadki')) {
      return { cause: 'PMC Katraj-Kondhwa road widening excavation & heavy vehicle bottleneck', category: 'construction' };
    }
    return { cause: 'Narrow carriageway & commercial market loading/unloading', category: 'market_junction' };
  }

  if (pathId === 'Hinjewadi-Swargate') {
    if (fromLabel.includes('Hinjewadi') || toLabel.includes('Wakad')) {
      return { cause: 'Metro Line 3 pier construction barricades & IT shift rush', category: 'construction' };
    }
    if (fromLabel.includes('University') || toLabel.includes('Deccan')) {
      return { cause: 'Pune University multi-level flyover integration work', category: 'construction' };
    }
    return { cause: 'High vehicle volume merging onto Aundh-Baner arterial', category: 'bottleneck' };
  }

  if (pathId === 'Kondhwa-Hinjewadi') {
    if (fromLabel.includes('Chandani') || toLabel.includes('Warje')) {
      return { cause: 'NH48 bypass heavy container movement & slope crawl', category: 'bottleneck' };
    }
    if (fromLabel.includes('Wakad') || toLabel.includes('Hinjewadi')) {
      return { cause: 'Hinjewadi flyover bottleneck & IT company cab queues', category: 'bottleneck' };
    }
    return { cause: 'Bypass merging lane slowdown', category: 'bottleneck' };
  }

  if (pathId === 'Kothrud-Shivajinagar') {
    if (fromLabel.includes('Vanaz') || toLabel.includes('Paud') || fromLabel.includes('Karve')) {
      return { cause: 'Karve Road commercial strip parking & pedestrian intersection delay', category: 'market_junction' };
    }
    return { cause: 'Deccan to Shivajinagar bridge approach vehicle buildup', category: 'bottleneck' };
  }

  return { cause: 'High vehicle volume at traffic junction', category: 'bottleneck' };
};

const run = async () => {
  console.log('\n========================================================================');
  console.log('🚀 BACKFILLING MISSING DATA TILL TODAY (OCT 24 to NOV 05, 2026)');
  console.log('   Includes HEAVY METRO CONSTRUCTION IMPACT on Swargate-Katraj corridor');
  console.log('========================================================================\n');

  await connectDB();

  // Generate date list from Oct 24, 2026 to Nov 05, 2026
  const dates = [];
  // Oct 24 to Oct 31
  for (let d = 24; d <= 31; d++) {
    dates.push(`2026-10-${d.toString().padStart(2, '0')}`);
  }
  // Nov 01 to Nov 05
  for (let d = 1; d <= 5; d++) {
    dates.push(`2026-11-${d.toString().padStart(2, '0')}`);
  }

  console.log(`Dates to process (${dates.length} days): ${dates.join(', ')}\n`);

  let totalSegmentsSaved = 0;
  let totalSegmentsSkipped = 0;
  let totalPathInfoSaved = 0;
  let totalPathInfoSkipped = 0;

  for (const dateStr of dates) {
    const istMidnightUTC = new Date(dateStr + 'T00:00:00.000Z');
    console.log(`📅 Processing Date: ${dateStr}...`);

    for (const route of SEGMENT_ROUTES) {
      for (const slot of ALL_SLOTS) {
        // --- STEP 1: ROUTE SEGMENT LOG ---
        let segmentDoc = await RouteSegmentLog.findOne({
          pathId: route.pathId,
          date: istMidnightUTC,
          timeRange: slot
        });

        const slotMult = getSlotMultiplier(slot);

        // If existing is present but on Swargate-Katraj we want to make sure it properly reflects the heavy metro construction
        const isSwargateKatraj = route.pathId === 'Swargate-Katraj';
        const needsUpdate = !segmentDoc || !segmentDoc.segments || segmentDoc.segments.length === 0 || (isSwargateKatraj && !segmentDoc.segments[0].cause.includes('Heavy Metro'));

        if (needsUpdate) {
          const segments = [];

          for (let i = 0; i < route.baseSegments.length; i++) {
            const from = route.waypoints[i];
            const to = route.waypoints[i + 1];
            const base = route.baseSegments[i];

            // Specific hotspot multipliers
            let hotspotMult = 1.0;

            // HEAVY METRO CONSTRUCTION IMPACT ON SWARGATE-KATRAJ
            if (route.pathId === 'Swargate-Katraj') {
              if (i === 0 || i === 1 || i === 2) {
                // Swargate, Lakshminarayan, Market Yard underground construction
                hotspotMult = 1.85;
              } else if (i === 3 || i === 4) {
                // Dhankawadi, Padmavati elevated pier work
                hotspotMult = 1.70;
              } else {
                // Katraj ghat & circle
                hotspotMult = 1.45;
              }
            } else if (route.pathId === 'Katraj-Kondhwa' && (i === 1 || i === 2)) {
              hotspotMult = 1.40;
            } else if (route.pathId === 'Hinjewadi-Swargate' && (i === 0 || i === 4)) {
              hotspotMult = 1.45;
            } else if (route.pathId === 'Kothrud-Shivajinagar' && (i === 3 || i === 4)) {
              hotspotMult = 1.35;
            }

            // Small daily variation (+-5%)
            const dayVar = 0.95 + (Math.sin((i + 1) * dateStr.charCodeAt(dateStr.length - 1)) * 0.05);

            const durationNormal = base.normal;
            const durationTraffic = Math.round(durationNormal * Math.max(1.0, (slotMult * hotspotMult * dayVar)));
            const congestionScore = Math.max(0, Math.round(((durationTraffic - durationNormal) / durationNormal) * 1000) / 10);
            const level = getLevel(congestionScore);
            const delaySeconds = Math.max(0, durationTraffic - durationNormal);

            const { cause, category } = analyzeCause(route.pathId, from.label, to.label, dateStr, congestionScore);

            segments.push({
              segmentIndex: i,
              fromLabel: from.label,
              toLabel: to.label,
              fromLat: from.lat,
              fromLng: from.lng,
              toLat: to.lat,
              toLng: to.lng,
              distanceM: base.dist,
              durationNormal,
              durationTraffic,
              congestionScore,
              level,
              cause,
              causeCategory: category,
              delaySeconds
            });
          }

          const totalDurationNormal = segments.reduce((sum, s) => sum + s.durationNormal, 0);
          const totalDurationTraffic = segments.reduce((sum, s) => sum + s.durationTraffic, 0);
          const overallCongestionScore = Math.max(
            0,
            Math.round(((totalDurationTraffic - totalDurationNormal) / totalDurationNormal) * 1000) / 10
          );

          const slotStartHour = parseInt(slot.split('-')[0], 10);
          const collectedAt = new Date(istMidnightUTC.getTime() + (slotStartHour * 3600 * 1000));

          segmentDoc = await RouteSegmentLog.findOneAndUpdate(
            {
              pathId: route.pathId,
              date: istMidnightUTC,
              timeRange: slot
            },
            {
              $set: {
                collectedAt,
                totalDurationNormal,
                totalDurationTraffic,
                overallCongestionScore,
                segments
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          totalSegmentsSaved++;
        } else {
          totalSegmentsSkipped++;
        }

        // --- STEP 2: PATH INFO (WHOLE-ROUTE COMPOSITE) ---
        const existingPathInfo = await PathInfo.findOne({
          pathId: route.pathId,
          date: istMidnightUTC,
          timeRange: slot
        });

        const needsPathInfoUpdate = !existingPathInfo || (isSwargateKatraj && existingPathInfo.breakdown?.metro < 40);

        if (needsPathInfoUpdate) {
          let durationNormal = segmentDoc.totalDurationNormal;
          let durationTraffic = segmentDoc.totalDurationTraffic;
          let googleScore = segmentDoc.overallCongestionScore;

          // Composite traffic score
          let finalScore;
          if (route.pathId === 'Swargate-Katraj') {
            // High score due to heavy metro construction
            finalScore = Math.min(100, Math.max(35, Math.round(googleScore * 0.85 + (slotMult * 16))));
          } else {
            finalScore = Math.min(100, Math.max(10, Math.round(googleScore * 0.75 + (slotMult * 12))));
          }

          const level = getTrafficLevel(finalScore);
          const slotStartHour = parseInt(slot.split('-')[0], 10);
          const collectedAt = new Date(istMidnightUTC.getTime() + (slotStartHour * 3600 * 1000));

          const breakdown = {
            construction: route.pathId === 'Swargate-Katraj' ? Math.round(finalScore * 0.60) : Math.round(finalScore * 0.35),
            diversion: route.pathId === 'Swargate-Katraj' ? Math.round(finalScore * 0.20) : Math.round(finalScore * 0.15),
            event: 0,
            hotspot: Math.round(finalScore * 0.15),
            pothole: Math.round(finalScore * 0.05),
            complaint: 5,
            weather: 5,
            transit: 10,
            metro: route.pathId === 'Swargate-Katraj' ? Math.round(finalScore * 0.55) : Math.round(finalScore * 0.20),
            festival: 0,
            timeMultiplier: slotMult,
            constructionCount: route.pathId === 'Swargate-Katraj' ? 5 : 2,
            diversionCount: route.pathId === 'Swargate-Katraj' ? 3 : 1,
            eventCount: 0,
            hotspotCount: 3,
            potholeCount: 4,
            complaintCount: 2
          };

          await PathInfo.findOneAndUpdate(
            {
              pathId: route.pathId,
              date: istMidnightUTC,
              timeRange: slot
            },
            {
              $set: {
                score: finalScore,
                level,
                googleScore,
                durationNormal,
                durationTraffic,
                breakdown,
                collectedAt
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          totalPathInfoSaved++;
        } else {
          totalPathInfoSkipped++;
        }
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`✅ COMPLETE!`);
  console.log(`   RouteSegmentLog: ${totalSegmentsSaved} saved/updated, ${totalSegmentsSkipped} already existed`);
  console.log(`   PathInfo:        ${totalPathInfoSaved} saved/updated, ${totalPathInfoSkipped} already existed`);
  console.log('========================================================================\n');
  process.exit(0);
};

run().catch(e => {
  console.error('Fatal error in backfillTillNov5:', e);
  process.exit(1);
});
