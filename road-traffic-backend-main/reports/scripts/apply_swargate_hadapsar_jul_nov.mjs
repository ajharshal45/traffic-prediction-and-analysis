import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

const MONTH_CONFIG = {
  '2026-07': {
    sites: 1,
    diversions: 2,
    roadPerDoc: 3.22,
    metroPerDoc: 0.0,
    festivals: ['Ashadhi Ekadashi / Palkhi Procession Rush (Jul 9–11)', 'Guru Purnima (Jul 29)'],
    dayMap: {
      9: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 9–11)',
      10: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 9–11)',
      11: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 9–11)',
      29: 'Guru Purnima (Jul 29)'
    }
  },
  '2026-11': {
    sites: 1,
    diversions: 0,
    roadPerDoc: 2.57,
    metroPerDoc: 0.74,
    festivals: [
      'Dhanteras (Nov 6)',
      'Laxmi Pujan / Diwali (Nov 8)',
      'Bali Pratipada (Nov 10)',
      'Bhaubeej (Nov 11)',
      'Guru Nanak Jayanti (Nov 24)'
    ],
    dayMap: {
      6: 'Dhanteras (Nov 6)',
      8: 'Laxmi Pujan / Diwali (Nov 8)',
      10: 'Bali Pratipada (Nov 10)',
      11: 'Bhaubeej (Nov 11)',
      24: 'Guru Nanak Jayanti (Nov 24)'
    }
  }
};

async function applySwargateHadapsar() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching records for Swargate-Hadapsar (2026-07 and 2026-11)...');
  const records = await PathInfo.find({
    pathId: 'Swargate-Hadapsar',
    date: {
      $gte: new Date('2026-07-01T00:00:00.000Z'),
      $lte: new Date('2026-11-30T23:59:59.999Z')
    }
  });

  const bulkOps = [];

  for (const doc of records) {
    const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
    const mKey = rawDate.toISOString().slice(0, 7);
    const cfg = MONTH_CONFIG[mKey];
    if (!cfg) continue;

    const dayNum = parseInt(rawDate.toISOString().slice(8, 10), 10);
    const dayFestival = cfg.dayMap[dayNum] || '';
    const festScore = dayFestival ? 25 : 0;
    const divScore = cfg.diversions === 0 ? 0 : 15;

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            'breakdown.construction': cfg.roadPerDoc,
            'breakdown.constructionCount': cfg.sites,
            'breakdown.metro': cfg.metroPerDoc,
            'breakdown.metroCount': cfg.metroPerDoc > 0 ? 1 : 0,
            'breakdown.diversionCount': cfg.diversions,
            'breakdown.diversion': divScore,
            'breakdown.festivalName': dayFestival,
            'breakdown.festival': festScore
          }
        }
      }
    });
  }

  console.log(`[3/4] Executing ${bulkOps.length} updates in Atlas...`);
  if (bulkOps.length > 0) {
    const res = await PathInfo.bulkWrite(bulkOps);
    console.log(`Modified ${res.modifiedCount} records.`);
  }

  console.log('[4/4] Finished Atlas update.');
  await mongoose.disconnect();
}

applySwargateHadapsar().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
