import express from 'express';
import {
  getPredictionLogs,
  getAccuracyStats,
  getAccuracyByRoute,
  getAccuracyTrend,
} from '../controllers/predictionLog.controller.js';

const router = express.Router();

// GET /prediction-logs — List all prediction logs (paginated)
// Query: ?page=1&limit=20&pathId=Swargate-Katraj&verified=true
router.get('/', getPredictionLogs);

// GET /prediction-logs/accuracy — Overall accuracy stats
// Query: ?pathId=Swargate-Katraj (optional)
router.get('/accuracy', getAccuracyStats);

// GET /prediction-logs/accuracy/trend — Daily accuracy trend
// Query: ?days=7&pathId=X (optional)
// MUST be before /accuracy/:pathId to avoid param conflict
router.get('/accuracy/trend', getAccuracyTrend);

// GET /prediction-logs/accuracy/:pathId — Accuracy for a specific route
router.get('/accuracy/:pathId', getAccuracyByRoute);

export default router;
