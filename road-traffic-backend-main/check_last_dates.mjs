import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const lastPI = await db.collection('pathinfos')
    .find({}, { projection: { date: 1, pathId: 1 } })
    .sort({ date: -1 })
    .limit(1)
    .toArray();

  const lastPL = await db.collection('predictionlogs')
    .find({}, { projection: { predictedDate: 1, pathId: 1 } })
    .sort({ predictedDate: -1 })
    .limit(1)
    .toArray();

  // Also get last date per route for PathInfo
  const perRoutePI = await db.collection('pathinfos').aggregate([
    { $group: { _id: '$pathId', lastDate: { $max: '$date' } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  const perRoutePL = await db.collection('predictionlogs').aggregate([
    { $group: { _id: '$pathId', lastDate: { $max: '$predictedDate' } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  console.log('\n=== PathInfo: Last Date Overall ===');
  console.log(lastPI[0]?.date?.toISOString().split('T')[0], '-', lastPI[0]?.pathId);

  console.log('\n=== PathInfo: Last Date Per Route ===');
  perRoutePI.forEach(r => console.log(`  ${r._id}: ${r.lastDate?.toISOString().split('T')[0]}`));

  console.log('\n=== PredictionLog: Last Date Overall ===');
  console.log(lastPL[0]?.predictedDate?.toISOString().split('T')[0], '-', lastPL[0]?.pathId);

  console.log('\n=== PredictionLog: Last Date Per Route ===');
  perRoutePL.forEach(r => console.log(`  ${r._id}: ${r.lastDate?.toISOString().split('T')[0]}`));

  process.exit(0);
}
run().catch(console.error);
