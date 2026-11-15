import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

const MONTH_CONFIG = {
  '2026-01': {
    sites: 2,
    diversions: 1,
    roadPct: 0.185,
    metroPct: 0.000,
    festivals: ['Republic Day (Jan 26)'],
    dayMap: { 26: 'Republic Day (Jan 26)' }
  },
  '2026-02': {
    sites: 2,
    diversions: 1,
    roadPct: 0.172,
    metroPct: 0.000,
    festivals: ['Mahashivratri (Feb 15)', 'Shivaji Maharaj Jayanti (Feb 19)'],
    dayMap: { 15: 'Mahashivratri (Feb 15)', 19: 'Shivaji Maharaj Jayanti (Feb 19)' }
  },
  '2026-03': {
    sites: 2,
    diversions: 1,
    roadPct: 0.160,
    metroPct: 0.000,
    festivals: ['Dhulivandan / Holi (Mar 3)', 'Gudhi Padwa (Mar 19)', 'Ramzan Id (Mar 21)', 'Ram Navami (Mar 26)', 'Mahavir Jayanti (Mar 31)'],
    dayMap: { 3: 'Dhulivandan / Holi (Mar 3)', 19: 'Gudhi Padwa (Mar 19)', 21: 'Ramzan Id (Mar 21)', 26: 'Ram Navami (Mar 26)', 31: 'Mahavir Jayanti (Mar 31)' }
  },
  '2026-04': {
    sites: 2,
    diversions: 2,
    roadPct: 0.154,
    metroPct: 0.000,
    festivals: ['Good Friday (Apr 3)', 'Dr. Ambedkar Jayanti (Apr 14)'],
    dayMap: { 3: 'Good Friday (Apr 3)', 14: 'Dr. Ambedkar Jayanti (Apr 14)' }
  },
  '2026-05': {
    sites: 2,
    diversions: 2,
    roadPct: 0.148,
    metroPct: 0.000,
    festivals: ['Maharashtra Din & Buddha Purnima (May 1)', 'Bakri Id (May 28)'],
    dayMap: { 1: 'Maharashtra Din & Buddha Purnima (May 1)', 28: 'Bakri Id (May 28)' }
  },
  '2026-06': {
    sites: 2,
    diversions: 2,
    roadPct: 0.125,
    metroPct: 0.000,
    festivals: ['Muharram (Jun 26)'],
    dayMap: { 26: 'Muharram (Jun 26)' }
  },
  '2026-07': {
    sites: 2,
    diversions: 2,
    roadPct: 0.138,
    metroPct: 0.000,
    festivals: ['Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)', 'Guru Purnima (Jul 29)'],
    dayMap: {
      7: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)',
      8: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)',
      9: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)',
      10: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)',
      11: 'Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)',
      29: 'Guru Purnima (Jul 29)'
    }
  },
  '2026-08': {
    sites: 2,
    diversions: 1,
    roadPct: 0.110,
    metroPct: 0.000,
    festivals: ['Independence Day & Parsi New Year (Aug 15)', 'Id-e-Milad (Aug 26)', 'Raksha Bandhan (Aug 28)'],
    dayMap: { 15: 'Independence Day & Parsi New Year (Aug 15)', 26: 'Id-e-Milad (Aug 26)', 28: 'Raksha Bandhan (Aug 28)' }
  },
  '2026-09': {
    sites: 1,
    diversions: 0,
    roadPct: 0.052,
    metroPct: 0.000,
    festivals: ['Dahi Handi (Sep 5)', 'Ganesh Chaturthi (Sep 14)', 'Anant Chaturdashi / Visarjan (Sep 25)'],
    dayMap: { 5: 'Dahi Handi (Sep 5)', 14: 'Ganesh Chaturthi (Sep 14)', 25: 'Anant Chaturdashi / Visarjan (Sep 25)' }
  },
  '2026-10': {
    sites: 2,
    diversions: 1,
    roadPct: 0.096,
    metroPct: 0.000,
    festivals: ['Gandhi Jayanti (Oct 2)', 'Navratri Start (Oct 11)', 'Dussehra / Dasara (Oct 20)'],
    dayMap: { 2: 'Gandhi Jayanti (Oct 2)', 11: 'Navratri Start (Oct 11)', 20: 'Dussehra / Dasara (Oct 20)' }
  },
  '2026-11': {
    sites: 1,
    diversions: 0,
    roadPct: 0.068,
    metroPct: 0.000,
    festivals: ['Dhanteras (Nov 6)', 'Laxmi Pujan / Diwali (Nov 8)', 'Bali Pratipada (Nov 10)', 'Bhaubeej (Nov 11)', 'Guru Nanak Jayanti (Nov 24)'],
    dayMap: { 6: 'Dhanteras (Nov 6)', 8: 'Laxmi Pujan / Diwali (Nov 8)', 10: 'Bali Pratipada (Nov 10)', 11: 'Bhaubeej (Nov 11)', 24: 'Guru Nanak Jayanti (Nov 24)' }
  }
};

async function applyKondhwaHinjewadi() {
  console.log('[1/4] Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  console.log('[2/4] Fetching all 2026 records for Kondhwa-Hinjewadi...');
  const records = await PathInfo.find({
    pathId: 'Kondhwa-Hinjewadi',
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

    // Calculate other factors sum including deterministic festival & diversion points
    let otherSum = 0;
    const docMeta = [];

    for (const doc of mDocs) {
      const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
      const dayNum = parseInt(rawDate.toISOString().slice(8, 10), 10);
      const dayFestival = cfg.dayMap[dayNum] || '';
      const festScore = dayFestival ? 25 : 0;
      const divScore = cfg.diversions === 0 ? 0 : 15;

      const bd = doc.breakdown || {};
      let docOther = 0;
      for (const [k, v] of Object.entries(bd)) {
        if (k !== 'construction' && k !== 'metro' && k !== 'festival' && k !== 'diversion' && typeof v === 'number') {
          docOther += v;
        }
      }
      docOther += festScore + divScore;
      otherSum += docOther;

      docMeta.push({ doc, dayFestival, festScore, divScore });
    }

    const totalTarget = otherSum / (1 - cfg.roadPct);
    const targetRoadTotal = totalTarget * cfg.roadPct;
    const roadPerDoc = Math.round((targetRoadTotal / mDocs.length) * 100) / 100;

    console.log(`${mKey}: ${mDocs.length} docs, otherSum = ${Math.round(otherSum)}, roadPerDoc = ${roadPerDoc}`);

    for (const item of docMeta) {
      bulkOps.push({
        updateOne: {
          filter: { _id: item.doc._id },
          update: {
            $set: {
              'breakdown.construction': roadPerDoc,
              'breakdown.constructionCount': cfg.sites,
              'breakdown.metro': 0,
              'breakdown.metroCount': 0,
              'breakdown.diversionCount': cfg.diversions,
              'breakdown.diversion': item.divScore,
              'breakdown.festivalName': item.dayFestival,
              'breakdown.festival': item.festScore
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

applyKondhwaHinjewadi().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
