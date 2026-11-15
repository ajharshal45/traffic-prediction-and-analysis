import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';

async function removeKothrudConstruction() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching all Kothrud-Shivajinagar records...');
  const records = await PathInfo.find({ pathId: 'Kothrud-Shivajinagar' });
  console.log(`Found ${records.length} records to update.`);

  const bulkOps = [];
  for (const doc of records) {
    const bd = doc.breakdown || {};
    const constScore = bd.construction || 0;
    const metroScore = bd.metro || 0;
    const timeMult = bd.timeMultiplier || 1.0;

    let newScore = doc.score;
    if (constScore > 0 || metroScore > 0) {
      const deduction = Math.round((constScore + metroScore) * 0.3 * timeMult);
      newScore = Math.max(18, doc.score - deduction);
    }

    let newLevel = 'low';
    if (newScore >= 80) newLevel = 'veryHigh';
    else if (newScore >= 60) newLevel = 'high';
    else if (newScore >= 30) newLevel = 'medium';

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            score: newScore,
            level: newLevel,
            'breakdown.metro': 0,
            'breakdown.metroCount': 0,
            'breakdown.construction': 0,
            'breakdown.constructionCount': 0
          }
        }
      }
    });
  }

  console.log(`[3/4] Executing bulkWrite for ${bulkOps.length} records...`);
  if (bulkOps.length > 0) {
    const res = await PathInfo.bulkWrite(bulkOps);
    console.log(`Updated ${res.modifiedCount} records for Kothrud-Shivajinagar.`);
  }

  console.log('[4/4] Finished.');
  await mongoose.disconnect();
}

removeKothrudConstruction().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
