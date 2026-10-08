import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

export { app, reportsRouter };

// If executed directly, start server
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`[Reports Server] Standalone service running on http://localhost:${PORT}`);
    console.log(`[Reports Server] Endpoints mounted at http://localhost:${PORT}/api/reports`);
  });
}
