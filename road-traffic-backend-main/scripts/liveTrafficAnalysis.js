import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../mongoose/connection.js';
import { AUTOMATION_ROUTES, getTrafficLevel } from '../services/dataCollector.service.js';
import { calculateTrafficScore } from '../services/trafficScoring.js';
import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';
import Predicted from '../models/predicted.model.js';

// Get current IST time slot
const getCurrentISTTimeSlot = () => {
  const now = new Date();
  
  // Convert UTC to IST (+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const hour = istTime.getUTCHours(); // getUTCHours is used here because we added offset manually to UTC epoch
  
  const slotStart = Math.floor(hour / 2) * 2;
  const slotEnd = slotStart + 2;
  
  const formatSlot = (h) => h.toString().padStart(2, '0');
  return `${formatSlot(slotStart)}-${formatSlot(slotEnd)}`;
};

// getTrafficLevel is imported from dataCollector.service.js:
// ≤15 → 'very low' | ≤35 → 'low' | ≤60 → 'medium' | ≤85 → 'high' | >85 → 'very high'

const runLiveAnalysis = async () => {
  console.log('🚀 Starting Live Traffic Analysis...');
  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB');

    const timeSlot = getCurrentISTTimeSlot();
    const date = new Date().toISOString(); // Current timestamp
    
    // Normalize date to midnight UTC for the day
    const normalizedDate = new Date();
    normalizedDate.setUTCHours(0, 0, 0, 0);

    console.log(`📅 Current IST TimeSlot: ${timeSlot}`);
    console.log(`🛣️ Processing ${AUTOMATION_ROUTES.length} routes...`);

    for (const route of AUTOMATION_ROUTES) {
      console.log(`\n--- Analyzing Route: ${route.pathId} ---`);
      
      try {
        const sourceCoords = route.routePoints[0];
        const destCoords = route.routePoints[route.routePoints.length - 1];

        const scoreData = await calculateTrafficScore(
          route.pathId, 
          date, 
          timeSlot, 
          route.routePoints, 
          sourceCoords, 
          destCoords
        );

        const level = getTrafficLevel(scoreData.finalScore);

        // 1. Save ground truth to PathInfo
        await PathInfo.create({
          pathId: route.pathId,
          timeRange: timeSlot,
          date: normalizedDate,
          score: scoreData.finalScore,
          level: level,
        });
        console.log(`✅ Saved PathInfo for ${route.pathId}: Score ${scoreData.finalScore} (${level})`);

        // 2. Verify any outstanding PredictionLogs for this exact time and route
        const unverifiedLogs = await PredictionLog.find({
          pathId: route.pathId,
          timeRange: timeSlot,
          predictedDate: normalizedDate,
          isVerified: false
        });

        for (const log of unverifiedLogs) {
          log.actualScore = scoreData.finalScore;
          log.accuracy = Math.max(0, 100 - Math.abs(log.predictedScore - scoreData.finalScore));
          log.isVerified = true;
          await log.save();
          console.log(`✅ Verified PredictionLog ${log._id} -> Accuracy: ${log.accuracy.toFixed(1)}%`);
        }

        // 3. Verify Predicted cache for this time and route
        const unverifiedPredicted = await Predicted.find({
          pathId: route.pathId,
          timeRange: timeSlot,
          predictedDate: normalizedDate,
          actualScore: null
        });

        for (const pred of unverifiedPredicted) {
          pred.actualScore = scoreData.finalScore;
          await pred.save();
          console.log(`✅ Verified Predicted Cache ${pred._id} with actualScore`);
        }

      } catch (err) {
        console.error(`❌ Error processing route ${route.pathId}:`, err.message);
      }
    }

    console.log('\n🎉 Live Traffic Analysis completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error in Live Traffic Analysis:', error);
    process.exit(1);
  }
};

runLiveAnalysis();
