import dotenv from 'dotenv';
dotenv.config();
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

async function applySwargateKatrajMayJul() {
  await mongoose.connect(process.env.MONGODB_URI);
  const PathInfo = mongoose.model('PathInfo', new mongoose.Schema({}, { strict: false }));

  const records = await PathInfo.find({
    pathId: 'Swargate-Katraj',
    date: {
      $gte: new Date('2026-05-01T00:00:00.000Z'),
      $lte: new Date('2026-07-31T23:59:59.999Z')
    }
  });

  const bulkOps = [];
  for (const doc of records) {
    const rawDate = doc.date instanceof Date ? doc.date : new Date(doc.date);
    const dateStr = rawDate.toISOString().slice(0, 10);
    const monthKey = dateStr.slice(0, 7);
    const dayNum = parseInt(dateStr.slice(8, 10), 10);

    let constCount = 1;
    let metroCount = 1;
    let divCount = 1;
    let constScore = 0.38;
    let metroScore = 0.43;
    let dayFestival = '';

    if (monthKey === '2026-05') {
      constCount = 1;
      metroCount = 1;
      divCount = 1;
      constScore = 0.38;
      metroScore = 0.43;

      if (dayNum === 1) dayFestival = 'Maharashtra Din & Buddha Purnima (May 1)';
      else if (dayNum === 28) dayFestival = 'Bakri Id (May 28)';
    } else if (monthKey === '2026-06') {
      constCount = 1;
      metroCount = 1;
      divCount = 2;
      constScore = 0.69;
      metroScore = 0.77;

      if (dayNum === 26) dayFestival = 'Muharram (Jun 26)';
    } else if (monthKey === '2026-07') {
      constCount = 1;
      metroCount = 1;
      divCount = 2;
      constScore = 0.87;
      metroScore = 0.97;

      if (dayNum === 1) dayFestival = 'Schools Reopen Pune';
      else if (dayNum >= 7 && dayNum <= 11) dayFestival = 'Ashadhi Ekadashi / Palkhi Rush (Jul 7–11)';
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            'breakdown.construction': constScore,
            'breakdown.constructionCount': constCount,
            'breakdown.metro': metroScore,
            'breakdown.metroCount': metroCount,
            'breakdown.diversionCount': divCount,
            'breakdown.festivalName': dayFestival,
            'breakdown.festival': dayFestival ? 25 : 0
          }
        }
      }
    });
  }

  await PathInfo.bulkWrite(bulkOps);
  await mongoose.disconnect();
}

applySwargateKatrajMayJul().catch(console.error);
