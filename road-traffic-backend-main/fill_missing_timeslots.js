/**
 * Fill Missing Time Slots Script
 * 
 * This script fills ALL missing time slots from Jan 29, 2026 (after 04-06) onwards
 * up to the current date for all monitored routes.
 * 
 * Usage: node fill_missing_timeslots.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PathInfo from './models/pathinfo.model.js';
import { collectTrafficDataForSlot } from './services/dataCollector.service.js';

dotenv.config();

const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
];

const MONITORED_ROUTES = [
  'Hinjewadi-Swargate',
  'Katraj-Kondhwa',
  'Kondhwa-Hinjewadi',
  'Kothrud-Shivajinagar',
  'Swargate-Katraj'
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Get all dates between start and end
const getDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current).toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

// Main fill function
const fillMissingTimeSlots = async () => {
  try {
    // Start from Jan 29, 2026 since data exists up to 04-06 on that day
    const startDate = '2026-01-29';
    const endDate = new Date().toISOString().split('T')[0]; // Today (Feb 3, 2026)
    
    console.log(`\n📅 Filling missing time slots from ${startDate} to ${endDate}`);
    console.log(`🛣️  Routes: ${MONITORED_ROUTES.length}`);
    console.log(`⏰ Time Slots: ${TIME_SLOTS.length} per day\n`);
    
    const dates = getDateRange(startDate, endDate);
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalChecked = 0;
    
    for (const date of dates) {
      console.log(`\n📆 Processing ${date}...`);
      let dateCreated = 0;
      let dateSkipped = 0;
      
      for (const route of MONITORED_ROUTES) {
        // For Jan 29, skip slots before 06-08 (since 00-02, 02-04, 04-06 already exist)
        const slotsToProcess = (date === '2026-01-29') 
          ? TIME_SLOTS.slice(3) // Start from '06-08'
          : TIME_SLOTS; // All slots for other dates
        
        for (const timeSlot of slotsToProcess) {
          totalChecked++;
          
          // Check if record already exists
          const existing = await PathInfo.findOne({
            pathId: route,
            timeRange: timeSlot,
            date: {
              $gte: new Date(date + 'T00:00:00.000Z'),
              $lt: new Date(date + 'T23:59:59.999Z')
            }
          });
          
          if (existing) {
            totalSkipped++;
            dateSkipped++;
            continue;
          }
          
          // Create missing record
          try {
            await collectTrafficDataForSlot(route, date, timeSlot);
            totalCreated++;
            dateCreated++;
            process.stdout.write('✓');
          } catch (err) {
            console.error(`\n❌ Failed ${route} ${date} ${timeSlot}:`, err.message);
          }
        }
      }
      
      console.log(`\n   Created: ${dateCreated} | Skipped: ${dateSkipped}`);
    }
    
    console.log('\n\n=== Fill Complete ===');
    console.log(`✅ Records created: ${totalCreated}`);
    console.log(`⏭️  Records skipped (already exist): ${totalSkipped}`);
    console.log(`📊 Total checked: ${totalChecked}`);
    console.log(`\n📅 Date range: ${startDate} to ${endDate}`);
    
  } catch (err) {
    console.error('Fill error:', err);
  }
};

// Run
const run = async () => {
  console.log('=== Starting Missing Time Slots Fill ===');
  console.log('From: Jan 29, 2026 (06-08 onwards)');
  console.log('To: Current date\n');
  
  await connectDB();
  await fillMissingTimeSlots();
  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
  process.exit(0);
};

run();
