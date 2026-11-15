import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';

async function calibrateSwargateKatraj() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching Swargate-Katraj records from 2026-08-01 to 2026-11-30...');
  const records = await PathInfo.find({
    pathId: 'Swargate-Katraj',
    date: {
      $gte: new Date('2026-08-01T00:00:00.000Z'),
      $lte: new Date('2026-11-30T23:59:59.999Z')
    }
  });

  console.log(`Found ${records.length} records to calibrate for Swargate-Katraj.`);

  const bulkOps = [];

  for (const doc of records) {
    const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
    const dateStr = rawDate.toISOString().slice(0, 10);
    const monthStr = dateStr.slice(0, 7);
    const dayOfMonth = parseInt(dateStr.slice(8, 10), 10);

    const bd = doc.breakdown || {};
    let targetConstCount = 0;
    let targetConstScore = 0;
    let targetMetroCount = 1;
    let targetMetroScore = 15;
    let targetDivCount = bd.diversionCount || 2;
    let targetDivScore = bd.diversion || 12;

    if (monthStr === '2026-08') {
      // August 2026: 3-4 sites
      // Days 1-15: 3 sites, Days 16-31: 4 sites
      if (dayOfMonth <= 15) {
        targetConstCount = 3;
        targetConstScore = 20;
        targetMetroScore = 12;
      } else {
        targetConstCount = 4;
        targetConstScore = 26;
        targetMetroScore = 15;
      }
      targetDivCount = Math.max(targetDivCount, 2);
      targetDivScore = Math.max(targetDivScore, 12);
    } else if (monthStr === '2026-09') {
      // September 2026: 5-6 sites
      // Days 1-15: 5 sites, Days 16-30: 6 sites
      if (dayOfMonth <= 15) {
        targetConstCount = 5;
        targetConstScore = 32;
        targetMetroScore = 18;
      } else {
        targetConstCount = 6;
        targetConstScore = 38;
        targetMetroScore = 20;
      }
      targetDivCount = Math.max(targetDivCount, 2);
      targetDivScore = Math.max(targetDivScore, 14);
    } else if (monthStr === '2026-10') {
      // October 2026: 5-6 sites
      if (dayOfMonth <= 15) {
        targetConstCount = 5;
        targetConstScore = 32;
        targetMetroScore = 18;
      } else {
        targetConstCount = 6;
        targetConstScore = 38;
        targetMetroScore = 20;
      }
      targetDivCount = Math.max(targetDivCount, 3);
      targetDivScore = Math.max(targetDivScore, 16);
    } else if (monthStr === '2026-11') {
      // November 2026: 5-6 sites
      if (dayOfMonth <= 7) {
        targetConstCount = 5;
        targetConstScore = 32;
        targetMetroScore = 18;
      } else {
        targetConstCount = 6;
        targetConstScore = 38;
        targetMetroScore = 20;
      }
      targetDivCount = Math.max(targetDivCount, 3);
      targetDivScore = Math.max(targetDivScore, 16);
    }

    const prevConstScore = bd.construction || 0;
    const constDiff = targetConstScore - prevConstScore;
    const timeMult = bd.timeMultiplier || 1.0;
    
    // Adjust score safely
    let newScore = doc.score;
    if (constDiff > 0) {
      newScore = Math.min(100, Math.round(doc.score + constDiff * 0.5 * timeMult));
    }
    
    // Assign proper level
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
            'breakdown.diversionCount': targetDivCount
          }
        }
      }
    });
  }

  console.log(`[3/4] Executing bulkWrite for ${bulkOps.length} updates...`);
  if (bulkOps.length > 0) {
    const res = await PathInfo.bulkWrite(bulkOps);
    console.log(`BulkWrite complete: modified ${res.modifiedCount} records.`);
  }

  console.log('[4/4] Calibration finished successfully.');
  await mongoose.disconnect();
}

calibrateSwargateKatraj().catch(err => {
  console.error('Calibration error:', err);
  process.exit(1);
});
