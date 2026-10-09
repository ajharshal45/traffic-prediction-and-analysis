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
  breakdown: mongoose.Schema.Types.Mixed
}, { strict: false });

const PathInfo = mongoose.model('PathInfo', PathInfoSchema);

const run = async () => {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!\n');

  // Today midnight UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const todayDocs = await PathInfo.find({
    date: { $gte: today, $lt: tomorrow }
  }).sort({ pathId: 1, timeRange: 1 }).lean();

  console.log(`=== TODAY (${today.toISOString().split('T')[0]}) ===`);
  console.log(`Total documents found: ${todayDocs.length}\n`);

  if (todayDocs.length === 0) {
    console.log('No docs today. Checking last 3 days...\n');
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const recent = await PathInfo.find({ date: { $gte: threeDaysAgo } })
      .sort({ date: -1 }).limit(15).lean();

    for (const d of recent) {
      const dateStr = new Date(d.date).toISOString().split('T')[0];
      const gScore  = d.googleScore != null ? d.googleScore.toFixed(2) + '%' : 'NULL';
      const normal  = d.durationNormal  ? Math.round(d.durationNormal  / 60) + 'min' : 'NULL';
      const traffic = d.durationTraffic ? Math.round(d.durationTraffic / 60) + 'min' : 'NULL';
      console.log(`  ${d.pathId.padEnd(26)} | ${d.timeRange} | ${dateStr} | score=${String((d.score||0).toFixed(1)).padEnd(5)} | google=${gScore.padEnd(8)} | normal=${normal.padEnd(6)} | traffic=${traffic} | breakdown=${d.breakdown ? 'YES' : 'NO'}`);
    }
  } else {
    const withGoogle = todayDocs.filter(d => d.googleScore != null).length;
    const withBreak  = todayDocs.filter(d => d.breakdown).length;
    console.log(`With real googleScore : ${withGoogle}/${todayDocs.length}`);
    console.log(`With breakdown data  : ${withBreak}/${todayDocs.length}\n`);

    for (const d of todayDocs) {
      const gScore  = d.googleScore != null ? d.googleScore.toFixed(2) + '%' : 'NULL';
      const normal  = d.durationNormal  ? Math.round(d.durationNormal  / 60) + 'min' : 'NULL';
      const traffic = d.durationTraffic ? Math.round(d.durationTraffic / 60) + 'min' : 'NULL';
      console.log(`  ${d.pathId.padEnd(26)} | ${d.timeRange} | score=${String((d.score||0).toFixed(1)).padEnd(5)} | google=${gScore.padEnd(8)} | normal=${normal.padEnd(6)} | traffic=${traffic} | breakdown=${d.breakdown ? 'YES' : 'NO'}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
