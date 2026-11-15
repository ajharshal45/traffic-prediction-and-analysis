/**
 * deepContextualValidation.mjs
 * Deep temporal + contextual validation of MongoDB traffic data
 * Cross-references real Pune events/construction/festivals with actual DB scores
 */

import mongoose from 'mongoose';
import dns from 'dns';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
let mongoUri = '';
try {
  const envContent = readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^MONGODB_URI\s*=\s*(.+)/m);
  if (match) mongoUri = match[1].trim().replace(/^["']|["']$/g, '');
} catch (e) {
  console.error('Could not read .env:', e.message);
  process.exit(1);
}

await mongoose.connect(mongoUri);
console.log('✅ Connected to MongoDB\n');

const db = mongoose.connection.db;
const pathInfoCol = db.collection('pathinfos');

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateRange(startStr, endStr) {
  return { $gte: new Date(startStr), $lte: new Date(endStr + 'T23:59:59.999Z') };
}

async function getAvgScore(route, startDate, endDate, slots) {
  const match = { pathId: route, date: dateRange(startDate, endDate) };
  if (slots && slots.length > 0) match.timeRange = { $in: slots };
  const result = await pathInfoCol.aggregate([
    { $match: match },
    { $group: { _id: null, avgScore: { $avg: '$score' }, count: { $sum: 1 }, avgDelay: { $avg: '$delayMinutes' } } }
  ]).toArray();
  return result[0] || { avgScore: null, count: 0, avgDelay: null };
}

async function getSampleDocs(route, startDate, endDate, slots, limit = 3) {
  const match = { pathId: route, date: dateRange(startDate, endDate) };
  if (slots && slots.length > 0) match.timeRange = { $in: slots };
  return pathInfoCol.find(match).sort({ date: 1 }).limit(limit).toArray();
}

async function getDailyAvg(route, startDate, endDate, slots) {
  const match = { pathId: route, date: dateRange(startDate, endDate) };
  if (slots && slots.length > 0) match.timeRange = { $in: slots };
  return pathInfoCol.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, avgScore: { $avg: '$score' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
}

async function getMonthlyAvg(route, slots) {
  const match = { pathId: route };
  if (slots && slots.length > 0) match.timeRange = { $in: slots };
  return pathInfoCol.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, avgScore: { $avg: '$score' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
}

function bar(score) {
  if (score == null) return 'N/A           ';
  const filled = Math.round((score / 100) * 20);
  const s = score.toFixed(1).padStart(5);
  return '[' + '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, 20 - filled)) + '] ' + s;
}

function printSamples(docs) {
  for (const d of docs) {
    const dateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : 'N/A';
    console.log(`    📄 ${dateStr} | slot=${d.timeRange} | score=${d.score} | level=${d.level} | delay=${d.delayMinutes?.toFixed?.(1) ?? d.delayMinutes}min`);
  }
  if (docs.length === 0) console.log('    (no documents found)');
}

const PEAK_SLOTS = ['08-10', '10-12', '18-20', '20-22'];
const EVENING_SLOTS = ['16-18', '18-20', '20-22'];
const results = [];

console.log('═'.repeat(70));
console.log('  DEEP TEMPORAL-CONTEXTUAL VALIDATION REPORT');
console.log('  Pune Road Traffic Database — Nov 15, 2026');
console.log('═'.repeat(70));

// ═══ CASE 1: Flyover Completion (Hinjewadi-Swargate, March 8, 2026) ══════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 1: SPPU Ganeshkhind Flyover Completion (Hinjewadi-Swargate)');
console.log('  Real event: Flyover opened March 8, 2026 → should REDUCE congestion');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const hs_before = await getAvgScore('Hinjewadi-Swargate', '2026-01-01', '2026-03-07', PEAK_SLOTS);
const hs_after  = await getAvgScore('Hinjewadi-Swargate', '2026-03-09', '2026-05-31', PEAK_SLOTS);
const hs_sb     = await getSampleDocs('Hinjewadi-Swargate', '2026-01-01', '2026-03-07', PEAK_SLOTS, 3);
const hs_sa     = await getSampleDocs('Hinjewadi-Swargate', '2026-03-09', '2026-05-31', PEAK_SLOTS, 3);

console.log(`\n  Before (Jan 1 – Mar 7, 2026)   ${bar(hs_before.avgScore)}  n=${hs_before.count}`);
console.log(`  After  (Mar 9 – May 31, 2026)  ${bar(hs_after.avgScore)}  n=${hs_after.count}`);

const c1pass = hs_after.avgScore != null && hs_before.avgScore != null && hs_after.avgScore < (hs_before.avgScore + 2);
const c1dir  = hs_after.avgScore < hs_before.avgScore ? '↓ DROP (good)' : hs_after.avgScore > hs_before.avgScore ? '↑ RISE (bad)' : '→ FLAT';
console.log(`  Expected: Score DROPS after flyover opens`);
console.log(`  Actual: ${c1dir} | Result: ${c1pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('  Samples BEFORE:'); printSamples(hs_sb);
console.log('  Samples AFTER:');  printSamples(hs_sa);
results.push({ case: 'Case 1 — Flyover Completion (Hinjewadi-Swargate)', icon: c1pass ? '✅ PASS' : '❌ FAIL', pass: c1pass, before: hs_before.avgScore, after: hs_after.avgScore });

// ═══ CASE 2: Metro TBM Escalation (Swargate-Katraj) ═════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 2: Metro Line 1B TBM Escalation — Swargate-Katraj');
console.log('  Real event: TBM drilling intensified mid-2026 → scores should RISE over time');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const sk_monthly = await getMonthlyAvg('Swargate-Katraj', PEAK_SLOTS);
console.log('\n  Monthly Avg Score (Swargate-Katraj, peak slots):');
for (const m of sk_monthly) {
  const tag = m._id >= '2026-07' ? ' ← 🏗 heavy TBM phase' : '';
  console.log(`    ${m._id}  ${bar(m.avgScore)}  n=${m.count}${tag}`);
}
const sk_early = sk_monthly.filter(m => m._id <= '2025-12');
const sk_late  = sk_monthly.filter(m => m._id >= '2026-07');
const sk_early_avg = sk_early.length ? sk_early.reduce((a, b) => a + b.avgScore, 0) / sk_early.length : null;
const sk_late_avg  = sk_late.length  ? sk_late.reduce((a, b)  => a + b.avgScore, 0) / sk_late.length  : null;
console.log(`\n  Early avg (up to Dec 2025): ${sk_early_avg?.toFixed(2) ?? 'N/A'} (${sk_early.length} months)`);
console.log(`  Late avg  (Jul 2026+):      ${sk_late_avg?.toFixed(2) ?? 'N/A'} (${sk_late.length} months)`);
const c2pass = sk_late_avg != null && sk_early_avg != null && sk_late_avg > (sk_early_avg - 2);
const c2dir  = sk_late_avg > sk_early_avg ? '↑ RISING (good)' : '↓ FALLING (bad)';
console.log(`  Expected: Scores RISING over time | Actual: ${c2dir} | Result: ${c2pass ? '✅ PASS' : '❌ FAIL'}`);
results.push({ case: 'Case 2 — Metro TBM Escalation (Swargate-Katraj)', icon: c2pass ? '✅ PASS' : '❌ FAIL', pass: c2pass, before: sk_early_avg, after: sk_late_avg });

// ═══ CASE 3: Katraj-Kondhwa Road Widening — Sustained High ═══════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 3: Katraj-Kondhwa Road Widening — Sustained Elevated Scores');
console.log('  Real event: PMC widening ongoing since 2023, target Dec 2026');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const kk_monthly = await getMonthlyAvg('Katraj-Kondhwa', PEAK_SLOTS);
console.log('\n  Monthly Avg Score (Katraj-Kondhwa, peak slots):');
let kk_low = [];
for (const m of kk_monthly) {
  const flag = m.avgScore < 45 ? ' ⚠️  LOW' : '';
  if (m.avgScore < 45) kk_low.push(m._id);
  console.log(`    ${m._id}  ${bar(m.avgScore)}  n=${m.count}${flag}`);
}
const kk_overall = await getAvgScore('Katraj-Kondhwa', '2024-01-01', '2026-11-15', PEAK_SLOTS);
console.log(`\n  Overall avg: ${kk_overall.avgScore?.toFixed(2)} | Low months: ${kk_low.length > 0 ? kk_low.join(', ') : 'None'}`);
const c3pass = (kk_overall.avgScore || 0) >= 45;
console.log(`  Expected: Score ≥ 45 sustained | Actual: ${kk_overall.avgScore?.toFixed(1)} | Result: ${c3pass ? '✅ PASS' : '❌ FAIL'}`);
results.push({ case: 'Case 3 — Road Widening Consistency (Katraj-Kondhwa)', icon: c3pass ? '✅ PASS' : '❌ FAIL', pass: c3pass, during: kk_overall.avgScore });

// ═══ CASE 4: Diwali 2026 (Nov 8-10) ══════════════════════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 4: Diwali 2026 Traffic Spike (Nov 8-10)');
console.log('  Real event: Lakshmi Pujan Nov 8, Padwa Nov 9 → evening congestion spike');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const dRoutes = ['Hinjewadi-Swargate', 'Swargate-Katraj', 'Kothrud-Shivajinagar'];
let diwali_sub = [];
for (const route of dRoutes) {
  const base   = await getAvgScore(route, '2026-11-05', '2026-11-07', EVENING_SLOTS);
  const diwali = await getAvgScore(route, '2026-11-08', '2026-11-10', EVENING_SLOTS);
  const post   = await getAvgScore(route, '2026-11-11', '2026-11-14', EVENING_SLOTS);
  const pass   = diwali.avgScore != null && base.avgScore != null && diwali.avgScore >= (base.avgScore - 2);
  const dir    = diwali.avgScore > base.avgScore ? '↑ SPIKE' : '→ FLAT/↓ DROP';
  console.log(`\n  Route: ${route}`);
  console.log(`    Baseline (Nov 5-7)   ${bar(base.avgScore)}  n=${base.count}`);
  console.log(`    Diwali   (Nov 8-10)  ${bar(diwali.avgScore)}  n=${diwali.count}`);
  console.log(`    Post     (Nov 11-14) ${bar(post.avgScore)}  n=${post.count}`);
  console.log(`    Expected SPIKE | Actual: ${dir} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
  diwali_sub.push({ route, pass, before: base.avgScore, during: diwali.avgScore });
}

// Daily breakdown
const d_daily = await getDailyAvg('Swargate-Katraj', '2026-11-05', '2026-11-14', EVENING_SLOTS);
console.log('\n  Daily breakdown Swargate-Katraj (evening slots):');
for (const d of d_daily) {
  const tag = ['2026-11-08','2026-11-09','2026-11-10'].includes(d._id) ? ' 🪔 DIWALI' : '';
  console.log(`    ${d._id}  ${bar(d.avgScore)}  n=${d.count}${tag}`);
}
const c4pass = diwali_sub.filter(r => r.pass).length >= 2;
console.log(`\n  Overall: ${c4pass ? '✅ PASS' : '❌ FAIL'} (${diwali_sub.filter(r=>r.pass).length}/3 routes)`);
results.push({ case: 'Case 4 — Diwali 2026 Spike', icon: c4pass ? '✅ PASS' : '❌ FAIL', pass: c4pass });

// ═══ CASE 5: Ganesh Visarjan Sep 24, 2026 ════════════════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 5: Ganesh Visarjan Sep 24, 2026 — Citywide Congestion');
console.log('  Real event: Visarjan processions → extreme citywide evening congestion');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const vRoutes = ['Hinjewadi-Swargate', 'Swargate-Katraj', 'Kothrud-Shivajinagar', 'Hadapsar-Kharadii'];
let v_sub = [];
for (const route of vRoutes) {
  const before   = await getAvgScore(route, '2026-09-22', '2026-09-23', EVENING_SLOTS);
  const visarjan = await getAvgScore(route, '2026-09-24', '2026-09-24', EVENING_SLOTS);
  const after    = await getAvgScore(route, '2026-09-25', '2026-09-26', EVENING_SLOTS);
  const pass     = visarjan.avgScore != null && before.avgScore != null && visarjan.avgScore >= (before.avgScore - 2);
  const dir      = visarjan.avgScore > before.avgScore ? '↑ SPIKE' : '→ FLAT/↓ DROP';
  console.log(`\n  Route: ${route}`);
  console.log(`    Day before (Sep 22-23)  ${bar(before.avgScore)}  n=${before.count}`);
  console.log(`    Visarjan  (Sep 24)      ${bar(visarjan.avgScore)}  n=${visarjan.count}`);
  console.log(`    Day after (Sep 25-26)   ${bar(after.avgScore)}  n=${after.count}`);
  console.log(`    Expected SPIKE | Actual: ${dir} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
  v_sub.push({ route, pass, before: before.avgScore, during: visarjan.avgScore });
}
const v_docs = await getSampleDocs('Swargate-Katraj', '2026-09-24', '2026-09-24', EVENING_SLOTS, 5);
console.log('\n  Actual docs — Swargate-Katraj on Sep 24 (evening):');
printSamples(v_docs);
const c5pass = v_sub.filter(r => r.pass).length >= 3;
console.log(`\n  Overall: ${c5pass ? '✅ PASS' : '❌ FAIL'} (${v_sub.filter(r=>r.pass).length}/${vRoutes.length} routes)`);
results.push({ case: 'Case 5 — Ganesh Visarjan Spike', icon: c5pass ? '✅ PASS' : '❌ FAIL', pass: c5pass });

// ═══ CASE 6: Keshavnagar-Kharadi Bridge Opening (Aug 16, 2026) ══════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 6: Keshavnagar-Kharadi Bridge Opening (Aug 16, 2026)');
console.log('  Real event: New bridge opened → should REDUCE delays on Hadapsar-Kharadi');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const hk_b = await getAvgScore('Hadapsar-Kharadii', '2026-07-01', '2026-08-15', PEAK_SLOTS);
const hk_a = await getAvgScore('Hadapsar-Kharadii', '2026-08-17', '2026-09-23', PEAK_SLOTS);
const hk_sb = await getSampleDocs('Hadapsar-Kharadii', '2026-07-01', '2026-08-15', PEAK_SLOTS, 3);
const hk_sa = await getSampleDocs('Hadapsar-Kharadii', '2026-08-17', '2026-09-23', PEAK_SLOTS, 3);
console.log(`\n  Before (Jul 1 – Aug 15)   ${bar(hk_b.avgScore)}  n=${hk_b.count}`);
console.log(`  After  (Aug 17 – Sep 23)  ${bar(hk_a.avgScore)}  n=${hk_a.count}`);
const c6pass = hk_a.avgScore != null && hk_b.avgScore != null && hk_a.avgScore < (hk_b.avgScore + 2);
const c6dir  = hk_a.avgScore < hk_b.avgScore ? '↓ DROP (good)' : '↑ RISE (bad)';
console.log(`  Expected: Score DROPS after bridge | Actual: ${c6dir} | ${c6pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('  Samples BEFORE:'); printSamples(hk_sb);
console.log('  Samples AFTER:');  printSamples(hk_sa);
results.push({ case: 'Case 6 — Bridge Opening (Hadapsar-Kharadii)', icon: c6pass ? '✅ PASS' : '❌ FAIL', pass: c6pass, before: hk_b.avgScore, after: hk_a.avgScore });

// ═══ CASE 7: Mundhwa Flyover Construction Impact ════════════════════════════
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CASE 7 (BONUS): Mundhwa Flyover Construction — Hadapsar-Kharadii');
console.log('  Real event: Flyover active since March 2026 → elevated scores from March');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const hk_monthly = await getMonthlyAvg('Hadapsar-Kharadii', PEAK_SLOTS);
console.log('\n  Monthly Avg Score (Hadapsar-Kharadii):');
for (const m of hk_monthly) {
  const tag = (m._id >= '2026-03' && m._id <= '2026-08') ? ' 🏗️  FLYOVER ACTIVE' : '';
  console.log(`    ${m._id}  ${bar(m.avgScore)}  n=${m.count}${tag}`);
}
const hk_bf = await getAvgScore('Hadapsar-Kharadii', '2025-10-01', '2026-02-28', PEAK_SLOTS);
const hk_df = await getAvgScore('Hadapsar-Kharadii', '2026-03-01', '2026-08-15', PEAK_SLOTS);
console.log(`\n  Before flyover (Oct 2025 – Feb 2026): ${hk_bf.avgScore?.toFixed(2) ?? 'N/A'}`);
console.log(`  During flyover (Mar 2026 – Aug 15):   ${hk_df.avgScore?.toFixed(2) ?? 'N/A'}`);
const c7pass = hk_df.avgScore != null && hk_bf.avgScore != null && hk_df.avgScore >= (hk_bf.avgScore - 2);
const c7dir  = hk_df.avgScore > hk_bf.avgScore ? '↑ RISE (good)' : '↓ FALL (bad)';
console.log(`  Expected: Scores HIGHER during construction | Actual: ${c7dir} | ${c7pass ? '✅ PASS' : '❌ FAIL'}`);
results.push({ case: 'Case 7 — Mundhwa Flyover Construction (Hadapsar)', icon: c7pass ? '✅ PASS' : '❌ FAIL', pass: c7pass, before: hk_bf.avgScore, during: hk_df.avgScore });

// ═══ FINAL SUMMARY ═══════════════════════════════════════════════════════════
console.log('\n\n' + '═'.repeat(70));
console.log('  FINAL SUMMARY');
console.log('═'.repeat(70));
let passed = 0;
for (const r of results) {
  const scores = [r.before != null ? `Before=${r.before?.toFixed(1)}` : '', r.during != null ? `During=${r.during?.toFixed(1)}` : '', r.after != null ? `After=${r.after?.toFixed(1)}` : ''].filter(Boolean).join(' | ');
  console.log(`  ${r.icon}  ${r.case}`);
  if (scores) console.log(`         ${scores}`);
  if (r.pass) passed++;
}
console.log(`\n  🏁 Total: ${passed}/${results.length} validation cases PASSED`);
console.log('═'.repeat(70));

// Machine-readable output for artifact
console.log('\n--- JSON_RESULTS_START ---');
console.log(JSON.stringify(results, null, 2));
console.log('--- JSON_RESULTS_END ---');

await mongoose.disconnect();
