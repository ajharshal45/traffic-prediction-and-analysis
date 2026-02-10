console.log("✅ pathinfo.route.js has been loaded by the server.");

import express from 'express';

// 1. Import functions that manage HISTORICAL data (correctly from pathinfo.controller)
import { 
    addPathInfo, 
    getCalendarData, 
    getFestivalData, 
    getLastFourWeekDayData 
} from '../controllers/pathinfo.controller.js';

// 2. Import the prediction algorithm from its new, SEPARATE controller
// This fixes the "export named 'predictTraffic' not found" error
import { predictTraffic } from '../controllers/predictTraffic.controller.js';

const router = express.Router();

router.post('/', addPathInfo); 
router.get('/getCalendarData', getCalendarData);
router.get('/getFestivalData', getFestivalData);
router.get('/getLastFourWeek', getLastFourWeekDayData);
router.post('/predictTraffic', predictTraffic);

export default router;