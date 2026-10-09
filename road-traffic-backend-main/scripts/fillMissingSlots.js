/**
 * fillMissingSlots.js
 *
 * One-time backfill script — fills gaps in PathInfo for the past N days.
 *
 * For PAST slots:  runs calculateTrafficScore with skipGoogle=true
 *                  (Google Directions API cannot return historical traffic)
 *                  → uses obstacles + weather + transit + historical baseline
 *
 * For the CURRENT slot: runs with skipGoogle=false to get real live Google data.
 *
 * Skips any slot that already has a PathInfo document — never overwrites.
 */

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../mongoose/connection.js';
import PathInfo from '../models/pathinfo.model.js';
import { AUTOMATION_ROUTES } from '../services/dataCollector.service.js';
import { calculateTrafficScore } from '../services/trafficScoring.js';

// ── Config ────────────────────────────────────────────────────────────────────
const DAYS_BACK   = 7;   // how many past days to check for gaps
const ALL_SLOTS   = ['00-02','02-04','04-06','06-08','08-10','10-12',
                     '12-14','14-16','16-18','18-20','20-22','22-24'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return IST midnight UTC for a given IST date offset (0 = today, -1 = yesterday, …) */
const getISTMidnightUTC = (dayOffset = 0) => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow  = new Date(Date.now() + IST_OFFSET_MS);
  const istDate = new Date(istNow);
  istDate.setUTCDate(istDate.getUTCDate() + dayOffset);
  const dateStr = istDate.toISOString().split('T')[0];
  return new Date(dateStr + 'T00:00:00.000Z');
};

/** Current IST time slot string, e.g. "14-16" */
const getCurrentISTSlot = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow  = new Date(Date.now() + IST_OFFSET_MS);
  const hour    = istNow.getUTCHours();
  const start   = Math.floor(hour / 2) * 2;
  const pad     = h => h.toString().padStart(2, '0');
  return `${pad(start)}-${pad(start + 2)}`;
};

/** Is a given (IST date, slot) in the past relative to now? */
const isSlotInPast = (istMidnightUTC, slot) => {
  const slotHour  = parseInt(slot.split('-')[0]);
  const slotStart = new Date(istMidnightUTC.getTime() + slotHour * 3600 * 1000);
  return slotStart < new Date();
};

/** Traffic level string from score */
const getLevel = score =>
  score <= 15 ? 'very low' :
  score <= 35 ? 'low'      :
  score <= 60 ? 'medium'   :
  score <= 85 ? 'high'     : 'very high';

// ── Main ──────────────────────────────────────────────────────────────────────
const run = async () => {
  console.log('\n════════════════════════════════════════════════════');
  console.log('🔧 MISSING SLOT BACKFILL STARTED');
  console.log(`   Checking last ${DAYS_BACK} days × ${ALL_SLOTS.length} slots × ${AUTOMATION_ROUTES.length} routes`);
  console.log('════════════════════════════════════════════════════\n');

  await connectDB();

  const currentSlot = getCurrentISTSlot();
  const nowIST      = new Date(Date.now() + 5.5 * 3600 * 1000);
  console.log(`Current IST time : ${nowIST.toISOString().replace('T',' ').slice(0,16)} IST`);
  console.log(`Current slot     : ${currentSlot}\n`);

  let filled = 0, skipped = 0, failed = 0;

  // Iterate days (today = offset 0, yesterday = -1, …)
  for (let dayOffset = 0; dayOffset >= -(DAYS_BACK - 1); dayOffset--) {
    const istMidnight = getISTMidnightUTC(dayOffset);
    const dateStr     = istMidnight.toISOString().split('T')[0];

    // Fetch all existing PathInfo docs for this day in one query
    const existing = await PathInfo.find({ date: istMidnight }).lean();
    const existingKey = new Set(existing.map(d => `${d.pathId}::${d.timeRange}`));

    // Find missing slots
    const missingSlots = [];
    for (const slot of ALL_SLOTS) {
      const anyRouteMissing = AUTOMATION_ROUTES.some(
        r => !existingKey.has(`${r.pathId}::${slot}`)
      );
      if (anyRouteMissing && isSlotInPast(istMidnight, slot)) {
        missingSlots.push(slot);
      }
    }

    if (missingSlots.length === 0) {
      console.log(`✅ ${dateStr} — all slots present, nothing to fill`);
      continue;
    }

    console.log(`📅 ${dateStr} — missing slots: ${missingSlots.join(', ')}`);

    for (const slot of missingSlots) {
      const isCurrentSlot = (dayOffset === 0 && slot === currentSlot);
      // skipGoogle=false only for the current real-time slot; true for all past
      const skipGoogle = !isCurrentSlot;

      for (const route of AUTOMATION_ROUTES) {
        const key = `${route.pathId}::${slot}`;
        if (existingKey.has(key)) { skipped++; continue; }

        try {
          const src  = route.routePoints[0];
          const dest = route.routePoints[route.routePoints.length - 1];
          const dateISO = istMidnight.toISOString();

          const scoreData = await calculateTrafficScore(
            route.pathId, dateISO, slot,
            route.routePoints, src, dest,
            skipGoogle
          );

          const level       = getLevel(scoreData.finalScore);
          const collectedAt = new Date();

          await PathInfo.create({
            pathId:          route.pathId,
            timeRange:       slot,
            date:            istMidnight,
            score:           scoreData.finalScore,
            level,
            googleScore:     skipGoogle ? null : (scoreData.googleScore ?? null),
            durationNormal:  skipGoogle ? null : (scoreData.durationNormal ?? null),
            durationTraffic: skipGoogle ? null : (scoreData.durationTraffic ?? null),
            breakdown:       scoreData.breakdown,
            collectedAt,
          });

          console.log(`   ✅ ${dateStr} | ${slot} | ${route.pathId.padEnd(24)} | score=${scoreData.finalScore.toFixed(1)} | ${skipGoogle ? 'no-Google (past)' : 'REAL Google'}`);
          filled++;
        } catch (err) {
          console.error(`   ❌ ${dateStr} | ${slot} | ${route.pathId}: ${err.message}`);
          failed++;
        }
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════');
  console.log(`✅ DONE  |  Filled: ${filled}  |  Skipped (existed): ${skipped}  |  Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
};

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
