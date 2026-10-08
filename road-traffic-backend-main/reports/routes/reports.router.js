import express from 'express';
import defaultReportStore from '../store/reportStore.js';
import { compareReports } from '../services/reportMath.js';

const router = express.Router();

/**
 * GET /api/reports/routes
 * List all routes that have stored period reports
 */
router.get('/routes', async (req, res) => {
  try {
    const routes = await defaultReportStore.listRoutes();
    return res.json({ success: true, routes });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/list?route=X&type=day|month|year
 * List all available period keys and summaries for a route and type
 */
router.get('/list', async (req, res) => {
  try {
    const { route, type } = req.query;
    if (!route || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: "route" and "type" (day|month|year)'
      });
    }

    const reports = await defaultReportStore.listReports(route, type);
    return res.json({ success: true, reports });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/one?route=X&type=day|month|year&key=YYYY-MM-DD
 * Get single complete stored period report
 */
router.get('/one', async (req, res) => {
  try {
    const { route, type, key } = req.query;
    if (!route || !type || !key) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: "route", "type", and "key"'
      });
    }

    const report = await defaultReportStore.getReport(route, type, key);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: `Report not found for route "${route}", type "${type}", key "${key}"`
      });
    }

    return res.json({ success: true, report });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/compare?route=X&type=day|month|year&a=KEY_A&b=KEY_B
 * Compare two stored period reports
 */
router.get('/compare', async (req, res) => {
  try {
    const { route, type, a, b } = req.query;
    if (!route || !type || !a || !b) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: "route", "type", "a", and "b"'
      });
    }

    const reportA = await defaultReportStore.getReport(route, type, a);
    if (!reportA) {
      return res.status(404).json({
        success: false,
        error: `Report A not found for key "${a}"`
      });
    }

    const reportB = await defaultReportStore.getReport(route, type, b);
    if (!reportB) {
      return res.status(404).json({
        success: false,
        error: `Report B not found for key "${b}"`
      });
    }

    const comparison = compareReports(reportA, reportB);
    return res.json({
      success: true,
      comparison,
      reportA,
      reportB
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
