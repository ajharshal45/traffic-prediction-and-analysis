import cron from 'node-cron';
import { collectTrafficData } from './dataCollector.service.js';

// Time slot mapping for 2-hour intervals
const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
];

/**
 * Get the current time slot based on the current hour
 * @returns {string} Current time slot (e.g., '08-10', '14-16')
 */
const getCurrentTimeSlot = () => {
  const hour = new Date().getHours();
  const slotIndex = Math.floor(hour / 2);
  return TIME_SLOTS[slotIndex];
};

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
const getTodayDate = () => {
  const now = new Date();
  // Adjust for IST (UTC+5:30)
  const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate.toISOString().split('T')[0];
};

/**
 * Start the 2-hourly traffic data collection scheduler
 * Runs at the start of every even hour: 00:00, 02:00, 04:00, etc.
 */
export const startScheduler = () => {
  console.log('================================================');
  console.log('🚀 TRAFFIC DATA SCHEDULER INITIALIZED');
  console.log('📅 Started at:', new Date().toISOString());
  console.log('⏰ Schedule: Every 2 hours (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)');
  console.log('================================================');

  // Run every 2 hours at minute 0: "0 */2 * * *"
  // This runs at 00:00, 02:00, 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
  cron.schedule('0 */2 * * *', async () => {
    const timeSlot = getCurrentTimeSlot();
    const date = getTodayDate();
    
    console.log('\n================================================');
    console.log('⏰ SCHEDULED 2-HOURLY DATA COLLECTION TRIGGERED');
    console.log(`📅 Date: ${date} | TimeSlot: ${timeSlot}`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
    console.log('================================================');

    try {
      const result = await collectTrafficData(date, timeSlot);
      console.log('✅ Scheduled collection completed successfully!');
      console.log(`📊 Routes processed: ${result.routesProcessed}`);
      console.log(`💾 Records saved: ${result.recordsSaved}`);
    } catch (error) {
      console.error('❌ Scheduled collection failed:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"  // IST timezone
  });

  console.log('✅ Scheduler ready. Next run at the start of the next even hour.');
};

/**
 * Manually trigger data collection for testing
 * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
 * @param {string} timeSlot - Time slot (optional, defaults to current)
 */
export const triggerManualCollection = async (date, timeSlot) => {
  const collectionDate = date || getTodayDate();
  const collectionTimeSlot = timeSlot || getCurrentTimeSlot();
  
  console.log(`\n🔧 MANUAL COLLECTION TRIGGERED`);
  console.log(`📅 Date: ${collectionDate} | TimeSlot: ${collectionTimeSlot}`);
  
  try {
    const result = await collectTrafficData(collectionDate, collectionTimeSlot);
    return result;
  } catch (error) {
    console.error('❌ Manual collection failed:', error.message);
    throw error;
  }
};

export default { startScheduler, triggerManualCollection };
