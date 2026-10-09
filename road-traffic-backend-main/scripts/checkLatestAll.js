import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const PathInfoSchema = new mongoose.Schema({
  pathId: String, timeRange: String, date: Date,
  score: Number, level: String,
  googleScore: Number, durationNormal: Number, durationTraffic: Number,
  breakdown: mongoose.Schema.Types.Mixed,
  collectedAt: Date,
  createdAt: Date,
  updatedAt: Date
}, { strict: false, timestamps: true });

const PathInfo = mongoose.model('PathInfo', PathInfoSchema);

const run = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!\n');

  // 1. Total count
  const total = await PathInfo.countDocuments();
  console.log('Total PathInfo documents:', total);

  // 2. Documents with real googleScore
  const googleCount = await PathInfo.countDocuments({ googleScore: { $ne: null } });
  console.log('Documents with real googleScore:', googleCount);

  // 3. Documents with collectedAt
  const collectedAtCount = await PathInfo.countDocuments({ collectedAt: { $ne: null } });
  console.log('Documents with collectedAt timestamp:', collectedAtCount);

  // 4. Latest 20 documents by ObjectId (_id contains timestamp)
  console.log('\n--- 20 Most Recently Created Documents (by ObjectId) ---');
  const latestById = await PathInfo.find().sort({ _id: -1 }).limit(20).lean();
  for (const doc of latestById) {
    const createdFromId = doc._id.getTimestamp();
    console.log(
      `ID: ${doc._id} (${createdFromId.toISOString()}) | Route: ${doc.pathId} | Slot: ${doc.timeRange} | Date: ${doc.date?.toISOString().split('T')[0]} | Score: ${doc.score} | Google: ${doc.googleScore ?? 'NULL'} | collectedAt: ${doc.collectedAt?.toISOString() ?? 'NULL'} | updatedAt: ${doc.updatedAt?.toISOString() ?? 'NULL'}`
    );
  }

  // 5. Distinct dates in the last 10 days
  console.log('\n--- Distinct dates in DB (last 15 records sorted by date desc) ---');
  const latestDates = await PathInfo.aggregate([
    { $group: { _id: "$date", count: { $sum: 1 }, googleCount: { $sum: { $cond: [{ $ne: ["$googleScore", null] }, 1, 0] } } } },
    { $sort: { _id: -1 } },
    { $limit: 15 }
  ]);
  for (const d of latestDates) {
    console.log(`Date: ${d._id ? new Date(d._id).toISOString().split('T')[0] : 'null'} | Total Docs: ${d.count} | Docs with googleScore: ${d.googleCount}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
