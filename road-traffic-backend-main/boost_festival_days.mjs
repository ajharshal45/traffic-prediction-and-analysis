import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Janmashtami 2026: Sep 4 | Dahi Handi 2026: Sep 5
const FESTIVAL_DATES = [
  { date: '2026-09-04', name: 'Janmashtami',  impact: 20, peakBoost: 30 },
  { date: '2026-09-05', name: 'Dahi Handi',   impact: 20, peakBoost: 35 },
];

// Peak traffic slots during festivals (processions in morning + evening)
const FESTIVAL_PEAK_SLOTS = ['06-08', '08-10', '10-12', '16-18', '18-20', '20-22'];
const FESTIVAL_MOD_SLOTS  = ['12-14', '14-16', '22-24'];

function getLevel(score) {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');
  const db = mongoose.connection.db;
  const piCol = db.collection('pathinfos');
  const plCol = db.collection('predictionlogs');

  let piUpdated = 0, plUpdated = 0;

  for (const festival of FESTIVAL_DATES) {
    const dateStart = new Date(festival.date + 'T00:00:00.000Z');
    const dateEnd   = new Date(festival.date + 'T23:59:59.999Z');

    console.log(`Processing ${festival.name} (${festival.date})...`);

    // --- Update PathInfo ---
    const piRecords = await piCol.find({ date: { $gte: dateStart, $lte: dateEnd } }).toArray();
    console.log(`  Found ${piRecords.length} PathInfo records`);

    const piOps = [];
    for (const r of piRecords) {
      let boost = festival.impact;
      if (FESTIVAL_PEAK_SLOTS.includes(r.timeRange)) boost = festival.peakBoost;
      else if (FESTIVAL_MOD_SLOTS.includes(r.timeRange)) boost = festival.impact;
      else boost = 5; // night slots still slightly elevated

      const oldScore = parseFloat(r.score) || 0;
      const newScore = Math.min(100, Math.round((oldScore + boost) * 100) / 100);

      piOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              score: newScore,
              level: getLevel(newScore),
              'breakdown.festival':     festival.impact,
              'breakdown.festivalName': festival.name,
              'breakdown.festivalCount': 1,
              'breakdown.reason':       `Traffic elevated due to ${festival.name} celebrations in Pune`,
            }
          }
        }
      });
    }

    if (piOps.length > 0) {
      await piCol.bulkWrite(piOps, { ordered: false });
      piUpdated += piOps.length;
      console.log(`  PathInfo updated: ${piOps.length} records ✅`);
    }

    // --- Update PredictionLog ---
    const plRecords = await plCol.find({
      predictedDate: { $gte: dateStart, $lte: dateEnd },
      isVerified: true
    }).toArray();
    console.log(`  Found ${plRecords.length} PredictionLog records`);

    const plOps = [];
    for (const r of plRecords) {
      let boost = festival.impact;
      if (FESTIVAL_PEAK_SLOTS.includes(r.timeRange)) boost = festival.peakBoost;
      else if (FESTIVAL_MOD_SLOTS.includes(r.timeRange)) boost = festival.impact;
      else boost = 5;

      const oldActual = parseFloat(r.actualScore) || 0;
      const newActual = Math.min(100, Math.round((oldActual + boost) * 100) / 100);

      // Recalculate predicted with slight offset
      let newPredicted = newActual - 15 + (Math.random() * 6 - 3);
      if (newPredicted < 15) newPredicted = 2;
      newPredicted = Math.round(newPredicted * 100) / 100;

      const newAccuracy = Math.round(Math.max(0, 100 - Math.abs(newPredicted - newActual)) * 100) / 100;

      plOps.push({
        updateOne: {
          filter: { _id: r._id },
          update: {
            $set: {
              actualScore:    newActual,
              predictedScore: newPredicted,
              accuracy:       newAccuracy,
              'breakdown.festival':      festival.impact,
              'breakdown.festivalName':  festival.name,
              'breakdown.festivalCount': 1,
              'breakdown.reason':        `Traffic elevated due to ${festival.name} celebrations in Pune`,
            }
          }
        }
      });
    }

    if (plOps.length > 0) {
      await plCol.bulkWrite(plOps, { ordered: false });
      plUpdated += plOps.length;
      console.log(`  PredictionLog updated: ${plOps.length} records ✅`);
    }

    console.log('');
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total PathInfo updated:      ${piUpdated}`);
  console.log(`Total PredictionLog updated: ${plUpdated}`);

  // Verify - show avg scores for those days
  for (const festival of FESTIVAL_DATES) {
    const dateStart = new Date(festival.date + 'T00:00:00.000Z');
    const dateEnd   = new Date(festival.date + 'T23:59:59.999Z');
    const agg = await piCol.aggregate([
      { $match: { date: { $gte: dateStart, $lte: dateEnd } } },
      { $group: { _id: null, avgScore: { $avg: '$score' }, count: { $sum: 1 } } }
    ]).toArray();
    if (agg[0]) {
      console.log(`${festival.name} avg traffic score: ${Math.round(agg[0].avgScore * 10)/10} (${agg[0].count} records)`);
    }
  }

  process.exit(0);
}
run().catch(console.error);
