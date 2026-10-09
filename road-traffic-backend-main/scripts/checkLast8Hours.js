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

  // Check any document updated or created in the last 8 hours
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const recentUpdates = await PathInfo.find({
    $or: [
      { updatedAt: { $gte: eightHoursAgo } },
      { collectedAt: { $gte: eightHoursAgo } },
      { createdAt: { $gte: eightHoursAgo } }
    ]
  }).sort({ updatedAt: -1 }).lean();

  console.log(`Documents updated/created in last 8 hours: ${recentUpdates.length}\n`);
  for (const d of recentUpdates) {
    console.log(
      `Route: ${d.pathId.padEnd(24)} | Date: ${d.date?.toISOString().split('T')[0]} | Slot: ${d.timeRange} | Score: ${String(d.score?.toFixed(1)).padEnd(5)} | Google: ${d.googleScore ?? 'NULL'} | updated: ${d.updatedAt?.toISOString()} | collectedAt: ${d.collectedAt?.toISOString() ?? 'NULL'}`
    );
  }

  // Also check if any document exists with date = 2026-09-29
  const sep29 = new Date('2026-09-29T00:00:00.000Z');
  const sep29Docs = await PathInfo.find({ date: sep29 }).lean();
  console.log(`\nDocuments with date == 2026-09-29: ${sep29Docs.length}`);
  for (const d of sep29Docs) {
    console.log(d.pathId, d.timeRange, d.score, d.googleScore, d.updatedAt);
  }

  await mongoose.disconnect();
};

run().catch(console.error);
