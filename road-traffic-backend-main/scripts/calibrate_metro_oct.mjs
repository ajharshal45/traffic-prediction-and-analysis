import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';

async function calibrateProportions() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching Swargate-Katraj records for Sep, Oct, Nov 2026...');
  const records = await PathInfo.find({
    pathId: 'Swargate-Katraj',
    date: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-11-30T23:59:59.999Z')
    }
  });

  console.log(`Found ${records.length} records to calibrate.`);

  const bulkOps = [];

  for (const doc of records) {
    const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
    const dateStr = rawDate.toISOString().slice(0, 10);
    const monthStr = dateStr.slice(0, 7);
    const dayOfMonth = parseInt(dateStr.slice(8, 10), 10);

    const bd = doc.breakdown || {};
    const timeMult = bd.timeMultiplier || 1.0;

    let targetConstCount = 5;
    let targetConstScore = 46;
    let targetMetroCount = 1;
    let targetMetroScore = 28;
    let targetDivCount = 3;
    let targetDivScore = 24;
    let targetHotspotScore = 4;
    let targetTransitScore = 2;

    if (monthStr === '2026-09') {
      if (dayOfMonth <= 15) {
        targetConstCount = 5;
        targetConstScore = 44;
      } else {
        targetConstCount = 6;
        targetConstScore = 50;
      }
      targetDivCount = 2;
      targetDivScore = 23;
      targetMetroScore = 27;
      targetHotspotScore = 4;
    } else if (monthStr === '2026-10') {
      // October: peak metro & diversions (5-6 sites, 3 diversions)
      if (dayOfMonth <= 15) {
        targetConstCount = 5;
        targetConstScore = 46;
      } else {
        targetConstCount = 6;
        targetConstScore = 52;
      }
      targetDivCount = 3;
      targetDivScore = 25;
      targetMetroScore = 29;
      targetHotspotScore = 4.5;
    } else if (monthStr === '2026-11') {
      if (dayOfMonth <= 7) {
        targetConstCount = 5;
        targetConstScore = 46;
      } else {
        targetConstCount = 6;
        targetConstScore = 52;
      }
      targetDivCount = 3;
      targetDivScore = 25;
      targetMetroScore = 29;
      targetHotspotScore = 4.5;
    }

    const baseObstacleSum = targetConstScore + targetMetroScore + targetDivScore + targetHotspotScore + targetTransitScore;
    let newScore = Math.min(100, Math.max(35, Math.round(baseObstacleSum * 0.6 * timeMult + 20)));

    let newLevel = 'medium';
    if (newScore < 30) newLevel = 'low';
    else if (newScore < 60) newLevel = 'medium';
    else if (newScore < 80) newLevel = 'high';
    else newLevel = 'veryHigh';

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            score: newScore,
            level: newLevel,
            'breakdown.construction': targetConstScore,
            'breakdown.constructionCount': targetConstCount,
            'breakdown.metro': targetMetroScore,
            'breakdown.metroCount': targetMetroCount,
            'breakdown.diversion': targetDivScore,
            'breakdown.diversionCount': targetDivCount,
            'breakdown.hotspot': targetHotspotScore,
            'breakdown.transit': targetTransitScore
          }
        }
      }
    });
  }

  console.log(`[3/4] Updating ${bulkOps.length} records in Atlas...`);
  if (bulkOps.length > 0) {
    const res = await PathInfo.bulkWrite(bulkOps);
    console.log(`Modified ${res.modifiedCount} records.`);
  }

  console.log('[4/4] Done.');
  await mongoose.disconnect();
}

calibrateProportions().catch(console.error);
