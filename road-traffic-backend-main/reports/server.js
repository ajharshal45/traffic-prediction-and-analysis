import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportDir = path.resolve(__dirname, '..', '..', 'report_output');
import reportsRouter from './routes/reports.router.js';

dotenv.config();

const app = express();
const PORT = process.env.REPORTS_PORT || 8090;

// Enable CORS for frontend clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS']
}));

app.use(express.json());

// Mount the reports router at /api/reports
app.use('/api/reports', reportsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Period Reports Service', port: PORT });
});


// Serve executive traffic report dashboard & artifacts
app.use('/report-static', express.static(reportDir));
app.get(['/report', '/executive-report', '/report.html'], (req, res) => {
  res.sendFile(path.join(reportDir, 'report.html'));
});
app.get('/report/excel', (req, res) => {
  res.download(path.join(reportDir, 'report.xlsx'), 'Pune_Traffic_Report_365Days.xlsx');
});
app.get('/report/daily-csv', (req, res) => {
  res.download(path.join(reportDir, 'daily.csv'), 'Pune_Traffic_Daily_Matrix.csv');
});
app.get('/report/monthly-csv', (req, res) => {
  res.download(path.join(reportDir, 'monthly.csv'), 'Pune_Traffic_Monthly_Summary.csv');
});

export { app, reportsRouter };

// If executed directly, start server
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`[Reports Server] Standalone service running on http://localhost:${PORT}`);
    console.log(`[Reports Server] Endpoints mounted at http://localhost:${PORT}/api/reports`);
  });
}
