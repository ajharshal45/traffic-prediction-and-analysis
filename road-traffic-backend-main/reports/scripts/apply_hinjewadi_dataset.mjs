import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

const MONTH_CONFIG = {
  '2026-01': {
    sites: 3,
    diversions: 2,
    roadPct: 0.485,
    metroPct: 0.360,
    festivals: ['Republic Day (Jan 26)'],
    dayMap: { 26: 'Republic Day (Jan 26)' }
  },
  '2026-02': {
    sites: 3,
    diversions: 2,
    roadPct: 0.452,
    metroPct: 0.341,
    festivals: ['Mahashivratri (Feb 15)', 'Shivaji Maharaj Jayanti (Feb 19)'],
    dayMap: { 1: 'Mahashivratri (Feb 15)', 2: 'Shivaji Maharaj Jayanti (Feb 19)', 15: 'Mahashivratri (Feb 15)', 19: 'Shivaji Maharaj Jayanti (Feb 19)' }
  },
  '2026-03': {
    sites: 2,
    diversions: 1,
    roadPct: 0.246,
    metroPct: 0.318,
    festivals: ['Holi (Mar 3)', 'Gudhi Padwa (Mar 19)', 'Ramzan Id (Mar 21)', 'Ram Navami (Mar 26)', 'Mahavir Jayanti (Mar 31)'],
    dayMap: { 1: 'Holi (Mar 3)', 3: 'Holi (Mar 3)', 19: 'Gudhi Padwa (Mar 19)', 21: 'Ramzan Id (Mar 21)', 26: 'Ram Navami (Mar 26)', 31: 'Mahavir Jayanti (Mar 31)' }
  },
  '2026-04': {
    sites: 2,
    diversions: 1,
    roadPct: 0.214,
    metroPct: 0.305,
    festivals: ['Good Friday (Apr 3)', 'Dr. Ambedkar Jayanti (Apr 14)'],
    dayMap: { 3: 'Good Friday (Apr 3)', 14: 'Dr. Ambedkar Jayanti (Apr 14)' }
  },
  '2026-05': {
    sites: 2,
    diversions: 1,
    roadPct: 0.198,
    metroPct: 0.292,
    festivals: ['Maharashtra Din & Buddha Purnima (May 1)', 'Bakri Id (May 28)'],
    dayMap: { 1: 'Maharashtra Din & Buddha Purnima (May 1)', 28: 'Bakri Id (May 28)' }
  },
  '2026-06': {
    sites: 2,
    diversions: 1,
    roadPct: 0.185,
    metroPct: 0.274,
    festivals: ['Muharram (Jun 26)'],
    dayMap: { 26: 'Muharram (Jun 26)' }
  },
  '2026-07': {
    sites: 3,
    diversions: 2,
    roadPct: 0.210,
    metroPct: 0.258,
    festivals: ['Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 'Guru Purnima (Jul 29)'],
    dayMap: { 7: 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 8: 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 9: 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 10: 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 11: 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)', 29: 'Guru Purnima (Jul 29)' }
  },
  '2026-08': {
    sites: 2,
    diversions: 1,
    roadPct: 0.159,
    metroPct: 0.216,
    festivals: ['Independence Day & Parsi New Year (Aug 15)', 'Id-e-Milad (Aug 26)', 'Raksha Bandhan (Aug 28)'],
    dayMap: { 15: 'Independence Day & Parsi New Year (Aug 15)', 26: 'Id-e-Milad (Aug 26)', 28: 'Raksha Bandhan (Aug 28)' }
  },
  '2026-09': {
    sites: 2,
    diversions: 0,
    roadPct: 0.064,
    metroPct: 0.182,
    festivals: ['Dahi Handi (Sep 5)', 'Ganesh Chaturthi (Sep 14)', 'Anant Chaturdashi / Visarjan (Sep 25)'],
    dayMap: { 5: 'Dahi Handi (Sep 5)', 14: 'Ganesh Chaturthi (Sep 14)', 25: 'Anant Chaturdashi / Visarjan (Sep 25)' }
  },
  '2026-10': {
    sites: 2,
    diversions: 1,
    roadPct: 0.106,
    metroPct: 0.154,
    festivals: ['Gandhi Jayanti (Oct 2)', 'Navratri Start (Oct 11)', 'Dussehra (Oct 20)'],
    dayMap: { 2: 'Gandhi Jayanti (Oct 2)', 11: 'Navratri Start (Oct 11)', 20: 'Dussehra (Oct 20)' }
  },
  '2026-11': {
    sites: 1,
    diversions: 0,
    roadPct: 0.082,
    metroPct: 0.095,
    festivals: ['Dhanteras (Nov 6)', 'Laxmi Pujan / Diwali (Nov 8)', 'Bali Pratipada (Nov 10)', 'Bhaubeej (Nov 11)', 'Guru Nanak Jayanti (Nov 24)'],
    dayMap: { 6: 'Dhanteras (Nov 6)', 8: 'Laxmi Pujan / Diwali (Nov 8)', 10: 'Bali Pratipada (Nov 10)', 11: 'Bhaubeej (Nov 11)', 24: 'Guru Nanak Jayanti (Nov 24)' }
  }
};

async function applyHinjewadi() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching all 2026 records for Hinjewadi-Swargate...');
  const records = await PathInfo.find({
    pathId: 'Hinjewadi-Swargate',
    date: {
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lte: new Date('2026-11-30T23:59:59.999Z')
    }
  });

  console.log(`Found ${records.length} records to update.`);

  // Group by month
  const byMonth = new Map();
  for (const doc of records) {
    const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
    const mKey = rawDate.toISOString().slice(0, 7);
    if (!byMonth.has(mKey)) byMonth.set(mKey, []);
    byMonth.get(mKey).push(doc);
  }

  const bulkOps = [];

  for (const [mKey, mDocs] of byMonth.entries()) {
    const cfg = MONTH_CONFIG[mKey];
    if (!cfg) continue;

    // Calculate other factors sum
    let otherSum = 0;
    for (const r of mDocs) {
      const bd = r.breakdown || {};
      for (const [k, v] of Object.entries(bd)) {
        if (k !== 'construction' && k !== 'metro' && typeof v === 'number') {
          otherSum += v;
        }
      }
    }

    const combinedPct = cfg.roadPct + cfg.metroPct;
    const totalTarget = otherSum / (1 - combinedPct);
    const targetRoadTotal = totalTarget * cfg.roadPct;
    const targetMetroTotal = totalTarget * cfg.metroPct;

    const roadPerDoc = Math.round((targetRoadTotal / mDocs.length) * 100) / 100;
    const metroPerDoc = Math.round((targetMetroTotal / mDocs.length) * 100) / 100;

    for (const doc of mDocs) {
      const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
      const dayNum = parseInt(rawDate.toISOString().slice(8, 10), 10);
      const dayFestival = cfg.dayMap[dayNum] || '';

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              'breakdown.construction': roadPerDoc,
              'breakdown.constructionCount': cfg.sites,
              'breakdown.metro': metroPerDoc,
              'breakdown.metroCount': 1,
              'breakdown.diversionCount': cfg.diversions,
              'breakdown.diversion': cfg.diversions === 0 ? 0 : (doc.breakdown?.diversion > 0 ? doc.breakdown.diversion : 15),
              'breakdown.festivalName': dayFestival,
              'breakdown.festival': dayFestival ? 25 : 0
            }
          }
        }
      });
    }
  }

  console.log(`[3/4] Executing ${bulkOps.length} updates in Atlas...`);
  if (bulkOps.length > 0) {
    const res = await PathInfo.bulkWrite(bulkOps);
    console.log(`Modified ${res.modifiedCount} records.`);
  }

  console.log('[4/4] Finished.');
  await mongoose.disconnect();
}

applyHinjewadi().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
