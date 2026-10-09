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

const SEGMENT_ROUTES = [
  {
    pathId: 'Swargate-Katraj',
    name: 'Swargate → Katraj',
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
];

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

    console.log(`📅 IST Date  : ${istMidnightUTC.toISOString().split('T')[0]}`);
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

            console.log(`      ✅ dist=${distanceM}m | normal=${Math.round(durationNormal / 60)}min | traffic=${Math.round(durationTraffic / 60)}min | congestion=${congestionScore.toFixed(1)}% (${level})`);

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
