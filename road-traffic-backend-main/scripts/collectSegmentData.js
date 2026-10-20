// collectSegmentData.js
//
// GitHub Actions script — runs every 2 hours (cron: 35 slash-star 2 UTC).
//
// What it does:
//  1. Determines the current IST date + time slot.
//  2. For each pilot route (Swargate-Katraj, Katraj-Kondhwa):
//     - Hits Google Directions API for each consecutive pair of waypoints.
//     - Computes congestionScore and level per segment.
//     - Upserts a RouteSegmentLog document with all segment data + totals.
//
// Run locally:  node scripts/collectSegmentData.js
// Run via GHA:  triggered by .github/workflows/collect-segment-data.yml

// ─── DNS Fix (matches App.js / collectGoogleTraffic.js) ──────────────────────
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import connectDB from '../mongoose/connection.js';
import RouteSegmentLog from '../models/routeSegmentLog.model.js';

// ─── Pilot Routes ─────────────────────────────────────────────────────────────

// ─── 5 Monitored Pune Routes & Verified Highway Checkpoints ─────────────────

const SEGMENT_ROUTES = [
  {
    pathId: 'Swargate-Katraj',
    name: 'Swargate → Katraj',
    corridor: 'Satara Road Corridor',
    waypoints: [
      { lat: 18.50183, lng: 73.86359, label: 'Swargate Bus Stand' },
      { lat: 18.49664, lng: 73.85809, label: 'Lakshminarayan Cinema' },
      { lat: 18.48519, lng: 73.85929, label: 'Bibwewadi / Market Yard' },
      { lat: 18.47179, lng: 73.86344, label: 'Dhankawadi Chowk' },
      { lat: 18.46242, lng: 73.86527, label: 'Padmavati / Dolphin Chowk' },
      { lat: 18.45760, lng: 73.86475, label: 'Katraj Ghat Entry' },
      { lat: 18.44980, lng: 73.86790, label: 'Katraj Circle' },
    ],
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
  },
];

/**
 * Maps live segment delay to verified on-ground causes in Pune
 */
const analyzeSegmentCause = (fromLabel, toLabel, pathId, score, dateStr) => {
  if (score <= 10) {
    return { cause: 'Normal traffic flow', category: 'regular' };
  }

  // 1. Swargate - Katraj corridor causes (Metro & Market Yard)
  if (pathId === 'Swargate-Katraj') {
    if (fromLabel.includes('Market Yard') || toLabel.includes('Market Yard') || fromLabel.includes('Lakshminarayan')) {
      return { cause: 'Swargate-Katraj Metro underground excavation & Market Yard barricading', category: 'construction' };
    }
    if (fromLabel.includes('Dhankawadi') || toLabel.includes('Padmavati')) {
      return { cause: 'Padmavati junction bottleneck & BRTS bus merge congestion', category: 'bottleneck' };
    }
    if (fromLabel.includes('Ghat') || toLabel.includes('Circle')) {
      return { cause: 'Katraj Circle intersection & Tunnel entry vehicle queue', category: 'bottleneck' };
    }
  }

  // 2. Katraj - Kondhwa corridor causes (Road widening)
  if (pathId === 'Katraj-Kondhwa') {
    if (fromLabel.includes('Rajas') || toLabel.includes('Tilekar') || fromLabel.includes('Khadki')) {
      return { cause: 'PMC Katraj-Kondhwa road-widening excavation & heavy vehicle bottle-neck', category: 'construction' };
    }
    if (fromLabel.includes('Kondhwa')) {
      return { cause: 'Narrow carriageway & commercial market loading/unloading', category: 'market_junction' };
    }
  }

  // 3. Hinjewadi - Swargate (Metro Line 3 & University Chowk)
  if (pathId === 'Hinjewadi-Swargate') {
    if (fromLabel.includes('Hinjewadi') || toLabel.includes('Wakad')) {
      return { cause: 'Metro Line 3 pier erection barricades & IT shift rush hour', category: 'construction' };
    }
    if (fromLabel.includes('University') || toLabel.includes('Deccan')) {
      return { cause: 'Pune University multi-level flyover integration work', category: 'construction' };
    }
    if (fromLabel.includes('Baner') || toLabel.includes('Aundh')) {
      return { cause: 'High volume merge from Baner into Aundh arterial', category: 'bottleneck' };
    }
  }

  // 4. Kondhwa - Hinjewadi (Bypass highway & Chandani Chowk)
  if (pathId === 'Kondhwa-Hinjewadi') {
    if (fromLabel.includes('Chandani') || toLabel.includes('Bavdhan') || fromLabel.includes('Warje')) {
      return { cause: 'NH48 bypass heavy container movement & slope crawl', category: 'bottleneck' };
    }
    if (fromLabel.includes('Wakad') || toLabel.includes('Hinjewadi')) {
      return { cause: 'Hinjewadi flyover bottleneck & IT company cab queues', category: 'bottleneck' };
    }
  }

  // 5. Kothrud - Shivajinagar (Karve Road & Shivajinagar protest / flyovers)
  if (pathId === 'Kothrud-Shivajinagar') {
    if (dateStr === '2026-10-08' && (toLabel.includes('Shivajinagar') || fromLabel.includes('Fergusson'))) {
      return { cause: 'Farmers protest near Sugar Complex & traffic diversion via Simla Office', category: 'protest' };
    }
    if (fromLabel.includes('Vanaz') || toLabel.includes('Paud') || fromLabel.includes('Karve')) {
      return { cause: 'Karve Road commercial strip parking & pedestrian intersection delay', category: 'market_junction' };
    }
    if (toLabel.includes('Shivajinagar')) {
      return { cause: 'Deccan to Shivajinagar bridge approach vehicle buildup', category: 'bottleneck' };
    }
  }

  return { cause: 'High vehicle volume at traffic junction', category: 'bottleneck' };
};

// ─── IST Helpers (mirrors collectGoogleTraffic.js) ────────────────────────────

/**
 * Returns the 2-hour IST time slot string for the current moment.
 * e.g. at 08:00 IST → "08-10", at 18:32 IST → "18-20"
 */
const getCurrentISTTimeSlot = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const hour = istNow.getUTCHours();
  const slotStart = Math.floor(hour / 2) * 2;
  const slotEnd = slotStart + 2;
  const pad = (h) => h.toString().padStart(2, '0');
  return `${pad(slotStart)}-${pad(slotEnd)}`;
};

/**
 * Returns today's IST calendar date normalised to midnight UTC.
 * Matches the convention used throughout the codebase for PathInfo.date.
 *
 * Example: at 02:00 UTC (07:30 IST on 2026-09-24) → 2026-09-24T00:00:00.000Z
 */
const getISTMidnightUTC = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istDateStr = istNow.toISOString().split('T')[0]; // "YYYY-MM-DD" in IST
  return new Date(istDateStr + 'T00:00:00.000Z');
};

// ─── Congestion Helpers ───────────────────────────────────────────────────────

/**
 * Converts a congestionScore (% extra time) into a traffic level label.
 */
const getCongestionLevel = (score) => {
  if (score <= 10) return 'low';
  if (score <= 25) return 'medium';
  if (score <= 50) return 'high';
  return 'very high';
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  const startedAt = new Date();
  console.log('\n════════════════════════════════════════════════════════');
  console.log('🗺️  SEGMENT-LEVEL TRAFFIC COLLECTOR — Started');
  console.log(`   UTC : ${startedAt.toISOString()}`);
  console.log(`   IST : ${new Date(Date.now() + 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 19)} IST`);
  console.log('════════════════════════════════════════════════════════\n');

  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('🔌 MongoDB connected\n');

    const timeSlot = getCurrentISTTimeSlot();
    const istMidnightUTC = getISTMidnightUTC();
    const istDateStr = istMidnightUTC.toISOString().split('T')[0];

    console.log(`📅 IST Date  : ${istDateStr}`);
    console.log(`⏰ Time Slot : ${timeSlot}`);
    console.log(`🛣️  Routes    : ${SEGMENT_ROUTES.length}\n`);
    console.log('─────────────────────────────────────────────────────');

    let savedRoutes = 0, updatedRoutes = 0, failedRoutes = 0;

    for (const route of SEGMENT_ROUTES) {
      console.log(`\n▶ Route: ${route.pathId} (${route.name})`);

      try {
        const segments = [];
        const { waypoints } = route;

        // ── Collect data for each consecutive waypoint pair ──────────────────
        for (let i = 0; i < waypoints.length - 1; i++) {
          const from = waypoints[i];
          const to = waypoints[i + 1];

          console.log(`   📍 Segment ${i}: ${from.label} → ${to.label}`);

          try {
            const departureTime = Math.floor(Date.now() / 1000) + 60;
            const url = `https://maps.googleapis.com/maps/api/directions/json` +
              `?origin=${from.lat},${from.lng}` +
              `&destination=${to.lat},${to.lng}` +
              `&departure_time=${departureTime}` +
              `&traffic_model=best_guess` +
              `&key=${API_KEY}`;

            const response = await axios.get(url);
            const data = response.data;

            if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
              throw new Error(`Google API status: ${data.status}`);
            }

            const leg = data.routes[0].legs[0];
            const durationNormal = leg.duration.value;          // seconds, free-flow
            const durationTraffic = leg.duration_in_traffic
              ? leg.duration_in_traffic.value
              : durationNormal;                                  // fallback if missing
            const distanceM = leg.distance.value;               // metres

            const congestionScore = Math.max(
              0,
              ((durationTraffic - durationNormal) / durationNormal) * 100
            );
            const level = getCongestionLevel(congestionScore);
            const delaySeconds = Math.max(0, durationTraffic - durationNormal);
            const dateStr = istDateStr;
            const causeAnalysis = analyzeSegmentCause(from.label, to.label, route.pathId, congestionScore, dateStr);

            console.log(`      ✅ dist=${distanceM}m | normal=${Math.round(durationNormal / 60)}min | traffic=${Math.round(durationTraffic / 60)}min | congestion=${congestionScore.toFixed(1)}% (${level}) | Cause: ${causeAnalysis.cause}`);

            segments.push({
              segmentIndex: i,
              fromLabel: from.label,
              toLabel: to.label,
              fromLat: from.lat,
              fromLng: from.lng,
              toLat: to.lat,
              toLng: to.lng,
              distanceM,
              durationNormal,
              durationTraffic,
              congestionScore: Math.round(congestionScore * 100) / 100,
              level,
              cause: causeAnalysis.cause,
              causeCategory: causeAnalysis.category,
              delaySeconds,
            });

          } catch (segErr) {
            console.error(`      ❌ Segment ${i} failed: ${segErr.message}`);
            // Continue collecting remaining segments even if one fails
          }

          // Respect Google API rate limits
          if (i < waypoints.length - 2) {
            await new Promise(r => setTimeout(r, 600));
          }
        }

        if (segments.length === 0) {
          throw new Error('All segments failed — no data to save.');
        }

        // ── Compute route-level totals ────────────────────────────────────────
        const totalDurationNormal = segments.reduce((sum, s) => sum + s.durationNormal, 0);
        const totalDurationTraffic = segments.reduce((sum, s) => sum + s.durationTraffic, 0);
        const overallCongestionScore = Math.max(
          0,
          Math.round(((totalDurationTraffic - totalDurationNormal) / totalDurationNormal) * 10000) / 100
        );
        const collectedAt = new Date();

        console.log(`\n   📊 Route Totals:`);
        console.log(`      Normal    : ${Math.round(totalDurationNormal / 60)} min`);
        console.log(`      Traffic   : ${Math.round(totalDurationTraffic / 60)} min`);
        console.log(`      Congestion: ${overallCongestionScore.toFixed(1)}%`);
        console.log(`      Segments  : ${segments.length}/${waypoints.length - 1} collected`);

        // ── Upsert RouteSegmentLog ────────────────────────────────────────────
        const filter = {
          pathId: route.pathId,
          date: istMidnightUTC,
          timeRange: timeSlot,
        };

        const update = {
          $set: {
            collectedAt,
            totalDurationNormal,
            totalDurationTraffic,
            overallCongestionScore,
            segments,
          },
        };

        const result = await RouteSegmentLog.findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        });

        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) {
          console.log(`   ✅ CREATED  @ ${collectedAt.toISOString()}`);
          savedRoutes++;
        } else {
          console.log(`   ✅ UPDATED  @ ${collectedAt.toISOString()}`);
          updatedRoutes++;
        }

      } catch (routeErr) {
        console.error(`   ❌ Route FAILED: ${routeErr.message}`);
        failedRoutes++;
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ SEGMENT COLLECTION COMPLETE');
    console.log(`   Routes created : ${savedRoutes}`);
    console.log(`   Routes updated : ${updatedRoutes}`);
    console.log(`   Routes failed  : ${failedRoutes}`);
    console.log(`   Time taken     : ${elapsed}s`);
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(failedRoutes > 0 ? 1 : 0);

  } catch (fatalErr) {
    console.error('\n💥 FATAL ERROR:', fatalErr);
    process.exit(1);
  }
};

run();
