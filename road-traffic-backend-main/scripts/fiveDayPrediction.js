import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../mongoose/connection.js';
import { AUTOMATION_ROUTES, getTrafficLevel } from '../services/dataCollector.service.js';
import { calculateTrafficScore } from '../services/trafficScoring.js';
import Predicted from '../models/predicted.model.js';

const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
];

// getTrafficLevel is imported from dataCollector.service.js:
// ≤15 → 'very low' | ≤35 → 'low' | ≤60 → 'medium' | ≤85 → 'high' | >85 → 'very high'

const runFiveDayPrediction = async () => {
  console.log('🚀 Starting 5-Day Traffic Prediction Generator...');
  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB');

    // Generate dates for today + next 4 days
    const targetDates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
      d.setUTCDate(d.getUTCDate() + i);
      targetDates.push(d);
    }

    console.log(`🛣️ Processing ${AUTOMATION_ROUTES.length} routes across 5 days...`);

    for (const route of AUTOMATION_ROUTES) {
      console.log(`\n--- Predicting Route: ${route.pathId} ---`);
      
      const sourceCoords = route.routePoints[0];
      const destCoords = route.routePoints[route.routePoints.length - 1];

      for (const dateObj of targetDates) {
        // Date formatting for the service
        const dateStr = dateObj.toISOString();

        for (const timeSlot of TIME_SLOTS) {
          try {
            // skipGoogle = true because we can't reliably get Google traffic for 5 days out.
            // Also it would consume thousands of API calls.
            const scoreData = await calculateTrafficScore(
              route.pathId, 
              dateStr, 
              timeSlot, 
              route.routePoints, 
              sourceCoords, 
              destCoords,
              true // skipGoogle
            );

            const level = getTrafficLevel(scoreData.finalScore);

            // Upsert into Predicted cache
            await Predicted.findOneAndUpdate(
              {
                pathId: route.pathId,
                predictedDate: dateObj,
                timeRange: timeSlot,
              },
              {
                score: scoreData.finalScore,
                level: level,
                breakdown: scoreData.breakdown,
                predictedAt: new Date(),
                // If the document is newly created, actualScore stays null (from schema default)
                // If updating, we don't overwrite actualScore if it somehow exists
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            console.log(`✅ Cached ${route.pathId} | ${dateStr.split('T')[0]} | ${timeSlot} -> ${scoreData.finalScore.toFixed(1)} (${level})`);
          } catch (err) {
            console.error(`❌ Error predicting ${route.pathId} at ${timeSlot} on ${dateStr}:`, err.message);
          }
        }
      }
    }

    console.log('\n🎉 5-Day Prediction Generation completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error in 5-Day Prediction Generator:', error);
    process.exit(1);
  }
};

runFiveDayPrediction();
