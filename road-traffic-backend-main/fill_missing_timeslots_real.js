/**
 * Fill Missing Time Slots with REAL Breakdown Script
 * 
 * This script fills ALL missing time slots from Jan 29, 2026 (after 04-06) onwards
 * up to the current date for all monitored routes, using REAL breakdown logic.
 * 
 * Usage: node fill_missing_timeslots_real.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PathInfo from './models/pathinfo.model.js';
import { MONITORED_ROUTES } from './services/dataCollector.service.js';
import { calculateRealBreakdown } from './backfill_breakdown.js';

dotenv.config();

const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
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
    // Start from Feb 4, 2026 to fill the last missing slots
    const startDate = '2026-02-04';
    const endDate = '2026-02-05'; // Just Feb 4 and 5
    
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
        // Process all slots for all dates from Feb 2 onwards
        const slotsToProcess = TIME_SLOTS;
        
        for (const timeSlot of slotsToProcess) {
          totalChecked++;
          
          // Check if record already exists
          const existing = await PathInfo.findOne({
            pathId: route.pathId,
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
          
          // Create missing record with REAL breakdown
          try {
            const record = {
              pathId: route.pathId,
              timeRange: timeSlot,
              date: new Date(date)
            };
            const breakdown = await calculateRealBreakdown(record);
            if (!breakdown) throw new Error('Breakdown calculation failed');
            // Score is sum of all main factors
            const score = (breakdown.construction || 0) + (breakdown.diversion || 0) + (breakdown.event || 0) + (breakdown.hotspot || 0) + (breakdown.pothole || 0) + (breakdown.complaint || 0) + (breakdown.weather || 0) + (breakdown.transit || 0) + (breakdown.metro || 0) + (breakdown.festival || 0);
            const level = score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 30 ? 'low' : 'very low';
            const newRecord = new PathInfo({
              pathId: route.pathId,
              timeRange: timeSlot,
              date: new Date(date),
              score,
              level,
              breakdown
            });
            await newRecord.save();
            totalCreated++;
            dateCreated++;
            process.stdout.write('✓');
          } catch (err) {
            console.error(`\n❌ Failed ${route.pathId} ${date} ${timeSlot}:`, err.message);
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
  console.log('=== Starting Missing Time Slots Fill (REAL BREAKDOWN) ===');
  console.log('From: Feb 2, 2026');
  console.log('To: Current date\n');
  
  await connectDB();
  await fillMissingTimeSlots();
  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
  process.exit(0);
};

run();
