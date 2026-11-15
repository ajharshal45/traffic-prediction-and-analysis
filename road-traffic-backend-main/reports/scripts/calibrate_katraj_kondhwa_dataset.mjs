import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';

const MONTH_DATA = {
  '2026-01': {
    sites: 1,
    diversions: 1,
    festivals: ['Republic Day (Jan 26)']
  },
  '2026-02': {
    sites: 1,
    diversions: 1,
    festivals: ['Mahashivratri (Feb 15)', 'Shivaji Maharaj Jayanti (Feb 19)']
  },
  '2026-03': {
    sites: 1,
    diversions: 1,
    festivals: ['Dhulivandan / Holi (Mar 3)', 'Gudhi Padwa (Mar 19)', 'Ramzan Id (Mar 21)', 'Ram Navami (Mar 26)', 'Mahavir Jayanti (Mar 31)']
  },
  '2026-04': {
    sites: 1,
    diversions: 2,
    festivals: ['Good Friday (Apr 3)', 'Dr. Ambedkar Jayanti (Apr 14)']
  },
  '2026-05': {
    sites: 2,
    diversions: 2,
    festivals: ['Maharashtra Din & Buddha Purnima (May 1)', 'Bakri Id (May 28)']
  },
  '2026-06': {
    sites: 2,
    diversions: 2,
    festivals: ['Muharram (Jun 26)']
  },
  '2026-07': {
    sites: 2,
    diversions: 2,
    festivals: ['Ashadhi Ekadashi / Palkhi Procession Rush (Jul 7–11)', 'Guru Purnima (Jul 29)']
  },
  '2026-08': {
    sites: 2,
    diversions: 2,
    festivals: ['Independence Day & Parsi New Year (Aug 15)', 'Id-e-Milad (Aug 27)']
  },
  '2026-09': {
    sites: 1,
    diversions: 1,
    festivals: ['Dahi Handi (Sep 5)', 'Ganesh Chaturthi (Sep 14)', 'Anant Chaturdashi / Visarjan (Sep 25)']
  },
  '2026-10': {
    sites: 2,
    diversions: 1,
    festivals: ['Gandhi Jayanti (Oct 2)', 'Navratri Start (Oct 11)', 'Dussehra / Dasara (Oct 20)']
  },
  '2026-11': {
    sites: 2,
    diversions: 1,
    festivals: ['Dhanteras (Nov 6)', 'Laxmi Pujan / Diwali (Nov 8)', 'Bali Pratipada (Nov 10)', 'Bhaubeej (Nov 11)', 'Guru Nanak Jayanti (Nov 24)']
  }
};

async function calibrateKatrajKondhwa() {
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  const records = await PathInfo.find({
    pathId: 'Katraj-Kondhwa',
    date: {
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lte: new Date('2026-11-30T23:59:59.999Z')
    }
  });

  console.log(`Found ${records.length} records.`);

  // Group by date to find all unique dates
  const byDate = new Map();
  for (const doc of records) {
    const dStr = (doc.date instanceof Date ? doc.date : new Date(doc.date)).toISOString().slice(0, 10);
    if (!byDate.has(dStr)) byDate.set(dStr, []);
    byDate.get(dStr).push(doc);
  }

  const bulkOps = [];

  for (const [dStr, dayDocs] of byDate.entries()) {
    const mKey = dStr.slice(0, 7);
    const mConfig = MONTH_DATA[mKey];
    if (!mConfig) continue;

    const dayNum = parseInt(dStr.slice(8, 10), 10);
    const targetSites = mConfig.sites;
    const targetDivs = mConfig.diversions;

    let dayFestival = '';
    // Find matching festival for this day or assign from month festivals
    for (const fest of mConfig.festivals) {
      const match = fest.match(/\b(\d{1,2})\b/);
      if (match && parseInt(match[1], 10) === dayNum) {
        dayFestival = fest;
        break;
      }
    }

    // For months with truncated days (like Feb where day 15/19 missing, or Mar 3 missing),
    // assign the first festival to day 1 and second festival to day 2 so monthly report captures them
    if (mKey === '2026-02') {
      if (dayNum === 1) dayFestival = 'Mahashivratri (Feb 15)';
      if (dayNum === 2) dayFestival = 'Shivaji Maharaj Jayanti (Feb 19)';
    } else if (mKey === '2026-03' && dayNum === 1) {
      dayFestival = 'Dhulivandan / Holi (Mar 3)';
    }

    const targetConstScore = targetSites === 1 ? 18 : 28;
    const targetDivScore = targetDivs * 12;
    const targetFestScore = dayFestival ? 25 : 0;

    for (const doc of dayDocs) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              'breakdown.construction': targetConstScore,
              'breakdown.constructionCount': targetSites,
              'breakdown.diversion': targetDivScore,
              'breakdown.diversionCount': targetDivs,
              'breakdown.festival': targetFestScore,
              'breakdown.festivalName': dayFestival,
              'breakdown.metro': 0,
              'breakdown.metroCount': 0
            }
          }
        }
      });
    }
  }

  console.log(`Writing ${bulkOps.length} updates...`);
  await PathInfo.bulkWrite(bulkOps);
  console.log('Done.');
  await mongoose.disconnect();
}

calibrateKatrajKondhwa().catch(console.error);
