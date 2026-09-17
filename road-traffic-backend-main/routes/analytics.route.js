import express from 'express';
import {
  getTrafficTrends,
  getHeatmapData,
  getTimeSlotsForDate,
  getRootCauseBreakdown,
  getRecommendations,
  getRouteComparison,
  getAvailableRoutes,
  getAdvancedInsights
} from '../controllers/analytics.controller.js';

const router = express.Router();

// Get list of available routes
router.get('/routes', getAvailableRoutes);

// Traffic trends over time
// GET /api/analytics/trends?route=Hinjewadi-Swargate&days=7
router.get('/trends', getTrafficTrends);

// Heatmap data (time slots vs days)
// GET /api/analytics/heatmap?route=Hinjewadi-Swargate&days=7
router.get('/heatmap', getHeatmapData);

// Get all time slots for a specific date (NEW)
// GET /api/analytics/timeslots?route=Hinjewadi-Swargate&date=2026-01-25
router.get('/timeslots', getTimeSlotsForDate);

// Root cause breakdown for specific date/time (fetches stored breakdown)
// GET /api/analytics/breakdown?route=Hinjewadi-Swargate&date=2026-01-25&timeSlot=18-20
router.get('/breakdown', getRootCauseBreakdown);

// AI recommendations for traffic improvement
// GET /api/analytics/recommendations?route=Hinjewadi-Swargate&date=2026-01-25
router.get('/recommendations', getRecommendations);

// Compare all routes (which is worst today)
// GET /api/analytics/comparison
router.get('/comparison', getRouteComparison);

// Advanced data science insights
// GET /api/analytics/insights?days=30
router.get('/insights', getAdvancedInsights);

export default router;
