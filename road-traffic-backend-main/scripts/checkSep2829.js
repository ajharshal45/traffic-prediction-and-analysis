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
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  // Let's check records for 2026-09-28 and 2026-09-29 specifically
  const start = new Date('2026-09-28T00:00:00.000Z');
  const docs = await PathInfo.find({ date: { $gte: start } }).sort({ date: 1, timeRange: 1, pathId: 1 }).lean();

  console.log(`Found ${docs.length} documents from 2026-09-28 onwards:\n`);
  for (const d of docs) {
    const dateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : 'null';
    console.log(
      `Date: ${dateStr} | Slot: ${d.timeRange} | Route: ${d.pathId.padEnd(24)} | Score: ${String(d.score?.toFixed(1)).padEnd(5)} | Google: ${d.googleScore != null ? (d.googleScore.toFixed(1) + '%').padEnd(6) : 'NULL '} | Normal: ${d.durationNormal ? Math.round(d.durationNormal/60) + 'm' : 'NULL'} | Traffic: ${d.durationTraffic ? Math.round(d.durationTraffic/60) + 'm' : 'NULL'} | collectedAt: ${d.collectedAt ? d.collectedAt.toISOString() : 'NULL'} | updatedAt: ${d.updatedAt ? d.updatedAt.toISOString() : 'NULL'}`
    );
  }

  // Also check PredictionLog
  const PredictionLogSchema = new mongoose.Schema({}, { strict: false });
  const PredictionLog = mongoose.model('PredictionLog', PredictionLogSchema);
  const recentLogs = await PredictionLog.find({ updatedAt: { $gte: start } }).sort({ updatedAt: -1 }).limit(10).lean();
  console.log(`\nRecently updated PredictionLogs (count: ${recentLogs.length})`);

  await mongoose.disconnect();
};

run().catch(e => {
  console.error(e);
  process.exit(1);
});
