/**
 * collectGoogleTraffic.js
 *
 * GitHub Actions script — runs every 2 hours at the START of each IST time slot
 * (cron: "30 * /2 * * *" UTC = exactly the IST even-hour boundaries).
 *
 * What it does:
 *  1. Determines the current IST date + time slot (e.g. 08-10 when it's 08:00 IST)
 *  2. For each of the 5 monitored routes calls calculateTrafficScore() with a
 *     departure_time = slot-start + 60 seconds so Google returns REAL live traffic.
 *  3. Upserts PathInfo with:
 *       - finalScore  (composite: 70% backend + 30% Google)
 *       - level
 *       - googleScore       ← NEW: real % delay from Google Directions API
 *       - durationNormal    ← NEW: free-flow seconds
 *       - durationTraffic   ← NEW: with-traffic seconds
 *       - breakdown         ← full factor breakdown (construction, diversion,
 *                              events, metro, hotspots, potholes, complaints,
 *                              weather, transit, festival) with weights
 *  4. Backfills any outstanding PredictionLog entries for this slot (IST-day range).
 *
 * Run locally:  node scripts/collectGoogleTraffic.js
 * Run via GHA:  triggered by .github/workflows/collect-google-traffic.yml
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../mongoose/connection.js';
import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';
import { AUTOMATION_ROUTES } from '../services/dataCollector.service.js';
import { calculateTrafficScore } from '../services/trafficScoring.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the 2-hour IST time slot string for the current moment.
 * e.g. at 08:00 IST → "08-10", at 18:32 IST → "18-20"
 */
const getCurrentISTTimeSlot = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const hour = istNow.getUTCHours(); // UTC hours on the IST-shifted time
  const slotStart = Math.floor(hour / 2) * 2;
  const slotEnd = slotStart + 2;
  const pad = (h) => h.toString().padStart(2, '0');
  return `${pad(slotStart)}-${pad(slotEnd)}`;
};

/**
 * Returns today's IST calendar date normalised to midnight UTC.
 * This is how PathInfo.date is stored across the entire codebase.
 *
 * Example: at 02:00 UTC (07:30 IST on 2026-09-24) → 2026-09-24T00:00:00.000Z
 */
const getISTMidnightUTC = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  // Zero-out the time part in IST then convert back to UTC midnight of that day
  const istDateStr = istNow.toISOString().split('T')[0]; // "YYYY-MM-DD" in IST
  return new Date(istDateStr + 'T00:00:00.000Z');
};

/**
 * Backfill PredictionLog entries for a given route + IST date + time slot
 * with the real observed score, using a $gte/$lt range to avoid timezone misses.
 */
const backfillLogs = async (pathId, istMidnightUTC, timeSlot, realScore) => {
  const dayStart = new Date(istMidnightUTC);
  const dayEnd = new Date(istMidnightUTC);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const logs = await PredictionLog.find({
    pathId,
    timeRange: timeSlot,
    predictedDate: { $gte: dayStart, $lt: dayEnd },
    isVerified: false,
  });

  if (logs.length === 0) return;

  for (const log of logs) {
    const accuracy = Math.max(0, 100 - Math.abs(log.predictedScore - realScore));
    await PredictionLog.updateOne(
      { _id: log._id },
      {
        $set: {
          actualScore: realScore,
          accuracy: Math.round(accuracy * 100) / 100,
          isVerified: true,
        },
      }
    );
  }

  console.log(
    `   📝 Backfilled ${logs.length} PredictionLog(s) for ${pathId} | ${timeSlot} | actual=${realScore.toFixed(2)}`
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  const startedAt = new Date();
  console.log('\n════════════════════════════════════════════════════════');
  console.log('🚦 REAL GOOGLE TRAFFIC COLLECTOR — Started');
  console.log(`   UTC : ${startedAt.toISOString()}`);
  console.log(`   IST : ${new Date(Date.now() + 5.5 * 3600000).toISOString().replace('T', ' ').slice(0, 19)} IST`);
  console.log('════════════════════════════════════════════════════════\n');

  // Abort early if Google key is missing (fail fast in CI)
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('🔌 MongoDB connected\n');

    const timeSlot = getCurrentISTTimeSlot();
    const istMidnightUTC = getISTMidnightUTC();
    const dateISO = istMidnightUTC.toISOString(); // used by calculateTrafficScore

    console.log(`📅 IST Date  : ${dateISO.split('T')[0]}`);
    console.log(`⏰ Time Slot : ${timeSlot}`);
    console.log(`🛣️  Routes    : ${AUTOMATION_ROUTES.length}\n`);
    console.log('─────────────────────────────────────────────────────');

    let saved = 0, updated = 0, failed = 0;

    for (const route of AUTOMATION_ROUTES) {
      console.log(`\n▶ Route: ${route.pathId} (${route.name})`);

      try {
        const sourceCoords = route.routePoints[0];
        const destCoords   = route.routePoints[route.routePoints.length - 1];

        // Full pipeline: obstacles + weather + transit + REAL Google Directions
        // skipGoogle = false  →  hits Google API with departure_time = now+60s
        const scoreData = await calculateTrafficScore(
          route.pathId,
          dateISO,
          timeSlot,
          route.routePoints,
          sourceCoords,
          destCoords,
          false   // ← skipGoogle = false = REAL traffic
        );

        const {
          finalScore,
          googleScore,
          durationNormal,
          durationTraffic,
          breakdown,
        } = scoreData;

        // Traffic level from composite score
        const level =
          finalScore <= 15 ? 'very low'
          : finalScore <= 35 ? 'low'
          : finalScore <= 60 ? 'medium'
          : finalScore <= 85 ? 'high'
          : 'very high';

        console.log(`   📊 Final Score      : ${finalScore.toFixed(2)} (${level})`);
        console.log(`   🚗 Google Score     : ${googleScore.toFixed(2)}%`);
        console.log(`   ⏱️  Duration Normal  : ${Math.round(durationNormal / 60)} min`);
        console.log(`   🚦 Duration Traffic : ${Math.round(durationTraffic / 60)} min`);
        console.log('   📋 Breakdown:');
        console.log(`      Construction: ${breakdown.constructionCount} | +${breakdown.construction}`);
        console.log(`      Diversion   : ${breakdown.diversionCount}   | +${breakdown.diversion}`);
        console.log(`      Events      : ${breakdown.eventCount}       | +${breakdown.event?.toFixed(1)}`);
        console.log(`      Metro Stn   : ${breakdown.metroCount}       | +${breakdown.metro?.toFixed(1)}`);
        console.log(`      Hotspots    : ${breakdown.hotspotCount}     | +${breakdown.hotspot}`);
        console.log(`      Potholes    : ${breakdown.potholeCount}     | +${breakdown.pothole?.toFixed(1)}`);
        console.log(`      Complaints  : ${breakdown.complaintCount}   | +${breakdown.complaint?.toFixed(1)}`);
        console.log(`      Weather     : ${breakdown.weatherCondition} | +${breakdown.weather}`);
        console.log(`      Transit     : +${breakdown.transit}`);
        console.log(`      Festival    : ${breakdown.festivalName || 'None'} | +${breakdown.festival}`);
        console.log(`      Time Mult   : ×${breakdown.timeMultiplier}`);

        // ── Upsert PathInfo ──────────────────────────────────────────────────
        const filter = {
          pathId: route.pathId,
          timeRange: timeSlot,
          date: istMidnightUTC,
        };

        const update = {
          $set: {
            score: finalScore,
            level,
            googleScore,
            durationNormal,
            durationTraffic,
            breakdown,
          },
        };

        const existing = await PathInfo.findOne(filter);

        if (existing) {
          // If a record already exists for this slot (e.g. from old simulated collector),
          // blend the scores: keep the new real score but average with existing
          const blendedScore = Math.round(((existing.score + finalScore) / 2) * 100) / 100;
          const blendedLevel =
            blendedScore <= 15 ? 'very low'
            : blendedScore <= 35 ? 'low'
            : blendedScore <= 60 ? 'medium'
            : blendedScore <= 85 ? 'high'
            : 'very high';

          await PathInfo.updateOne(filter, {
            $set: {
              score: blendedScore,
              level: blendedLevel,
              googleScore,
              durationNormal,
              durationTraffic,
              breakdown,
            },
          });

          console.log(`   ✅ UPDATED  (blended ${existing.score.toFixed(2)} → ${blendedScore.toFixed(2)})`);
          updated++;

          // Backfill prediction logs with blended score
          await backfillLogs(route.pathId, istMidnightUTC, timeSlot, blendedScore);
        } else {
          await PathInfo.create({
            pathId: route.pathId,
            timeRange: timeSlot,
            date: istMidnightUTC,
            score: finalScore,
            level,
            googleScore,
            durationNormal,
            durationTraffic,
            breakdown,
          });

          console.log(`   ✅ CREATED  (score=${finalScore.toFixed(2)})`);
          saved++;

          // Backfill prediction logs with real score
          await backfillLogs(route.pathId, istMidnightUTC, timeSlot, finalScore);
        }

      } catch (routeErr) {
        console.error(`   ❌ FAILED: ${routeErr.message}`);
        failed++;
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ COLLECTION COMPLETE');
    console.log(`   Routes created : ${saved}`);
    console.log(`   Routes updated : ${updated}`);
    console.log(`   Routes failed  : ${failed}`);
    console.log(`   Time taken     : ${elapsed}s`);
    console.log('════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);

  } catch (fatalErr) {
    console.error('\n💥 FATAL ERROR:', fatalErr);
    process.exit(1);
  }
};

run();
