import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PathInfo from './models/pathinfo.model.js';

dotenv.config();

const checkData = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const latest = await PathInfo.find().sort({ date: -1 }).limit(10);
  
  console.log('\n=== Latest 10 Records ===');
  latest.forEach(r => {
    console.log(`${r.pathId} | ${r.date.toISOString().split('T')[0]} | ${r.timeRange} | Score: ${r.score}`);
  });
  
  const dateRange = await PathInfo.aggregate([
    { $group: { _id: null, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } }
  ]);
  
  console.log('\n=== Date Range ===');
  console.log(`Min: ${dateRange[0].minDate.toISOString().split('T')[0]}`);
  console.log(`Max: ${dateRange[0].maxDate.toISOString().split('T')[0]}`);
  
  const feb5Count = await PathInfo.countDocuments({
    date: {
      $gte: new Date('2026-02-05T00:00:00.000Z'),
      $lt: new Date('2026-02-05T23:59:59.999Z')
    }
  });
  
  console.log(`\nFeb 5, 2026 records: ${feb5Count}/60 (5 routes × 12 slots)`);
  
  await mongoose.disconnect();
  process.exit(0);
};

checkData();
