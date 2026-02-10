import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PathInfo from './models/pathinfo.model.js';

dotenv.config();

const checkData = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (const date of ['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05']) {
    const count = await PathInfo.countDocuments({
      date: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      }
    });
    console.log(`${date}: ${count}/60 records`);
  }
  
  await mongoose.disconnect();
  process.exit(0);
};

checkData();
