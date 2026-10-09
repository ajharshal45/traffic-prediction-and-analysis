import express from 'express';
import {
  getLatestSegments,
  getSegmentHistory,
  getAllRoutesLatest,
  getSegmentStats,
} from '../controllers/segmentAnalysis.controller.js';

const router = express.Router();

// GET /api/segments/all-latest — Latest snapshot for all pilot routes
// MUST be before /:pathId routes to avoid param conflict
router.get('/all-latest', getAllRoutesLatest);

// GET /api/segments/latest/:pathId — Most recent segment data for a route
router.get('/latest/:pathId', getLatestSegments);

// GET /api/segments/history/:pathId?days=7&timeRange=14-16 — Historical data
router.get('/history/:pathId', getSegmentHistory);

// GET /api/segments/stats/:pathId — 7-day per-segment averages
router.get('/stats/:pathId', getSegmentStats);

export default router;
