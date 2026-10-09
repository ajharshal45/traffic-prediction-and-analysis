import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const segmentColl = db.collection('routesegmentlogs');
  const pathInfoColl = db.collection('pathinfos');

  const segmentDates = await segmentColl.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 },
        routes: { $addToSet: '$pathId' }
      }
    },
    { $sort: { _id: -1 } }
  ]).toArray();

  const pathInfoDates = await pathInfoColl.aggregate([
    {
      $match: {
        date: { $gte: new Date('2026-09-24T00:00:00.000Z') }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 },
        withGoogle: { $sum: { $cond: [{ $ne: ['$googleScore', null] }, 1, 0] } }
      }
    },
    { $sort: { _id: -1 } }
  ]).toArray();

  console.log('\n========================================================================');
  console.log('📊 DATABASE AUDIT: POINT-TO-POINT SEGMENTS (RouteSegmentLog)');
  console.log('========================================================================');
  segmentDates.forEach(d => {
    const isFull = d.count === 60 ? '✅ FULL (60/60)' : `⚠️ ${d.count}/60`;
    console.log(`Date: ${d._id} | Logs: ${d.count} (${isFull}) | All 5 Routes: ${d.routes.length === 5 ? 'YES (5/5)' : 'NO'}`);
  });

  console.log('\n========================================================================');
  console.log('📈 DATABASE AUDIT: WHOLE-ROUTE TRAFFIC (PathInfo)');
  console.log('========================================================================');
  pathInfoDates.forEach(d => {
    const isFull = d.count >= 60 ? '✅ FULL' : `⚠️ ${d.count}`;
    console.log(`Date: ${d._id} | Total Documents: ${d.count} (${isFull}) | With Google Delay: ${d.withGoogle}`);
  });
  console.log('========================================================================\n');

  process.exit(0);
};

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
