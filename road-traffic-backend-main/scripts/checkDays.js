import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const PathInfoSchema = new mongoose.Schema({}, { strict: false });
const PathInfo = mongoose.model('PathInfo', PathInfoSchema);

const ALL_SLOTS = ['00-02','02-04','04-06','06-08','08-10','10-12','12-14','14-16','16-18','18-20','20-22','22-24'];
const ROUTES = ['Hinjewadi-Swargate','Katraj-Kondhwa','Kondhwa-Hinjewadi','Kothrud-Shivajinagar','Swargate-Katraj'];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Last 5 days from Sep 24 to Sep 29
  const from = new Date('2026-09-24T00:00:00.000Z');
  const docs = await PathInfo.find({ date: { $gte: from } }).lean();

  // Group by date → slot → routes
  const byDate = {};
  for (const d of docs) {
    const dateStr = new Date(d.date).toISOString().split('T')[0];
    if (!byDate[dateStr]) byDate[dateStr] = {};
    if (!byDate[dateStr][d.timeRange]) byDate[dateStr][d.timeRange] = [];
    byDate[dateStr][d.timeRange].push(d);
  }

  const dates = Object.keys(byDate).sort().reverse();

  console.log('=== LAST 5 DAYS — COLLECTION STATUS ===\n');
  for (const date of dates) {
    const slots = byDate[date];
    const totalDocs = Object.values(slots).flat().length;
    const withGoogle = Object.values(slots).flat().filter(d => d.googleScore != null).length;
    console.log(`\n📅 ${date} — ${totalDocs} docs | ${withGoogle} with real Google score`);
    console.log('   Slot   | Routes | Google% | Avg Score | Collected At (IST)');
    console.log('   -------|--------|---------|-----------|-------------------');

    for (const slot of ALL_SLOTS) {
      const slotDocs = slots[slot] || [];
      if (slotDocs.length === 0) {
        console.log(`   ${slot} |   ❌   | -       | -         | NOT COLLECTED`);
        continue;
      }
      const avgScore = (slotDocs.reduce((s,d) => s + (d.score||0), 0) / slotDocs.length).toFixed(1);
      const hasGoogle = slotDocs.filter(d => d.googleScore != null).length;
      const avgGoogle = hasGoogle > 0
        ? (slotDocs.filter(d=>d.googleScore!=null).reduce((s,d)=>s+d.googleScore,0)/hasGoogle).toFixed(1)+'%'
        : 'NULL';
      // Get collectedAt from first doc that has it
      const withTime = slotDocs.find(d => d.collectedAt || d.updatedAt);
      let collectedStr = '-';
      if (withTime) {
        const t = new Date((withTime.collectedAt || withTime.updatedAt).getTime() + 5.5*3600000);
        collectedStr = t.toISOString().replace('T',' ').slice(0,16) + ' IST';
      }
      const routeCount = slotDocs.length;
      console.log(`   ${slot} |  ${routeCount}/5  | ${String(avgGoogle).padEnd(7)} | ${String(avgScore).padEnd(9)} | ${collectedStr}`);
    }
  }

  await mongoose.disconnect();
};
run().catch(console.error);
