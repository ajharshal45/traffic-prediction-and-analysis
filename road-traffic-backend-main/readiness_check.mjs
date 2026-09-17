import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== DATA READINESS CHECK ===\n');

  // 1. PathInfo counts per route
  const piPerRoute = await db.collection('pathinfos').aggregate([
    { $group: { _id: '$pathId', count: { $sum: 1 }, lastDate: { $max: '$date' } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('PathInfo per route:');
  piPerRoute.forEach(r => console.log(`  ${r._id}: ${r.count} records | last: ${r.lastDate?.toISOString().split('T')[0]}`));

  // 2. PredictionLog - verified vs unverified
  const plStats = await db.collection('predictionlogs').aggregate([
    { $group: {
      _id: '$isVerified',
      count: { $sum: 1 },
      avgAcc: { $avg: '$accuracy' }
    }}
  ]).toArray();
  console.log('\nPredictionLog overall:');
  plStats.forEach(s => console.log(`  isVerified=${s._id}: ${s.count} records | avg accuracy: ${s.avgAcc ? Math.round(s.avgAcc * 10)/10 : 'N/A'}%`));

  // 3. Last 7 days accuracy
  const last7 = new Date(); last7.setDate(last7.getDate() - 7);
  const acc7 = await db.collection('predictionlogs').aggregate([
    { $match: { isVerified: true, accuracy: { $ne: null }, predictedDate: { $gte: last7 } } },
    { $group: { _id: null, avg: { $avg: '$accuracy' }, count: { $sum: 1 } } }
  ]).toArray();
  console.log(`\nLast 7 days accuracy: ${acc7[0] ? Math.round(acc7[0].avg * 10)/10 : 'N/A'}% (${acc7[0]?.count} records)`);

  // 4. Today's data check (Sep 7)
  const todayStart = new Date('2026-09-07T00:00:00.000Z');
  const todayEnd   = new Date('2026-09-07T23:59:59.999Z');
  const todayPI = await db.collection('pathinfos').countDocuments({ date: { $gte: todayStart, $lte: todayEnd } });
  const todayPL = await db.collection('predictionlogs').countDocuments({ predictedDate: { $gte: todayStart, $lte: todayEnd } });
  console.log(`\nToday (Sep 7) records:`);
  console.log(`  PathInfo:      ${todayPI} records`);
  console.log(`  PredictionLog: ${todayPL} records`);

  // 5. Check for any string scores left
  const strScores = await db.collection('pathinfos').countDocuments({ score: { $type: 'string' } });
  console.log(`\nString score corruption check: ${strScores === 0 ? '✅ None found' : `⚠️ ${strScores} records still have string scores`}`);

  console.log('\n=== READY TO DEMO ===');
  process.exit(0);
}
run().catch(console.error);
