import axios from 'axios';

/**
 * Outscraper Google Maps Traffic API Service
 * 
 * API Endpoint: GET https://api.app.outscraper.com/maps/traffic
 * Auth: X-API-KEY header
 * Docs: https://app.outscraper.com/api-docs
 */

const OUTSCRAPER_BASE_URL = 'https://api.app.outscraper.com';

/**
 * Get the API key from environment
 */
const getApiKey = () => {
    const key = process.env.OUTSCRAPER_API_KEY;
    if (!key) {
        throw new Error('OUTSCRAPER_API_KEY is not set in environment variables');
    }
    return key;
};

/**
 * Fetch traffic data for a route from Outscraper API.
 * 
 * @param {string} origin - Origin coordinates "lat,lng" (e.g., "18.5912,73.7176")
 * @param {string} destination - Destination coordinates "lat,lng"
 * @param {string} dateFrom - Start datetime in UTC ISO format (e.g., "2026-02-12T00:00:00Z")
 * @param {string} dateTo - End datetime in UTC ISO format (e.g., "2026-02-12T02:00:00Z")
 * @param {number} interval - Interval in minutes (default: 120 for 2-hour slots)
 * @returns {Object} API response with traffic data
 */
export const fetchRouteTraffic = async (origin, destination, dateFrom, dateTo, interval = 120) => {
    const apiKey = getApiKey();

    try {
        console.log(`   🌐 Outscraper API call: ${origin} → ${destination}`);
        console.log(`      Date range: ${dateFrom} to ${dateTo} | Interval: ${interval}min`);

        const response = await axios.get(`${OUTSCRAPER_BASE_URL}/maps/traffic`, {
            headers: {
                'X-API-KEY': apiKey,
            },
            params: {
                origin: origin,
                destination: destination,
                date_from: dateFrom,
                date_to: dateTo,
                interval: interval,
            },
            timeout: 120000, // 2 minute timeout (API may take time for historical data)
        });

        if (response.data && response.data.status === 'Success' && response.data.data) {
            console.log(`   ✅ Got ${response.data.data.length} data points from Outscraper`);
            return response.data;
        }

        // If the response indicates a pending/processing task, handle polling
        if (response.data && response.data.status === 'Pending') {
            console.log(`   ⏳ Task is pending, polling for results...`);
            return await pollForResults(response.data.id, apiKey);
        }

        console.warn(`   ⚠️ Unexpected API response status: ${response.data?.status}`);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`   ❌ Outscraper API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            if (error.response.status === 402) {
                console.error('   💳 Credits exhausted! Falling back to simulated data.');
            }
        } else {
            console.error(`   ❌ Outscraper API request failed: ${error.message}`);
        }
        throw error;
    }
};

/**
 * Poll for async task results
 * @param {string} taskId - The task ID from initial request
 * @param {string} apiKey - API key
 * @returns {Object} Completed task result
 */
const pollForResults = async (taskId, apiKey, maxRetries = 30, delayMs = 10000) => {
    for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, delayMs));

        try {
            const response = await axios.get(`${OUTSCRAPER_BASE_URL}/requests/${taskId}`, {
                headers: { 'X-API-KEY': apiKey },
                timeout: 30000,
            });

            if (response.data && response.data.status === 'Success') {
                console.log(`   ✅ Task ${taskId} completed! Got ${response.data.data?.length || 0} data points`);
                return response.data;
            }

            if (response.data && response.data.status === 'Error') {
                throw new Error(`Task ${taskId} failed: ${JSON.stringify(response.data)}`);
            }

            console.log(`   ⏳ Poll ${i + 1}/${maxRetries}: Task still ${response.data?.status}...`);
        } catch (error) {
            console.error(`   ⚠️ Poll error: ${error.message}`);
            if (i === maxRetries - 1) throw error;
        }
    }
    throw new Error(`Task ${taskId} timed out after ${maxRetries} polls`);
};

/**
 * Convert Outscraper traffic data to a 0-100 congestion score.
 * 
 * Formula: ((currentDuration - minDuration) / (maxDuration - minDuration)) * 100
 * 
 * - Score 0 = free-flowing (current == min)
 * - Score 100 = worst congestion (current == max)
 * 
 * @param {Object} dataPoint - Single Outscraper data point
 * @returns {number} Traffic score 0-100
 */
export const convertToTrafficScore = (dataPoint) => {
    const duration = dataPoint['duration(minutes)'];
    const durationMin = dataPoint['duration_min(minutes)'];
    const durationMax = dataPoint['duration_max(minutes)'];

    // Validate inputs
    if (duration == null || durationMin == null || durationMax == null) {
        console.warn('   ⚠️ Missing duration data, returning default score 40');
        return 40;
    }

    // Avoid division by zero
    if (durationMax === durationMin) {
        return duration > durationMin ? 50 : 10;
    }

    // Calculate congestion ratio
    const score = ((duration - durationMin) / (durationMax - durationMin)) * 100;

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
};

/**
 * Map an Outscraper timestamp to a 2-hour time slot string
 * @param {string} datetimeUtc - UTC datetime string (e.g., "02/12/2026 03:30:00")
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Time slot (e.g., "08-10")
 */
export const mapToTimeSlot = (datetimeUtc, timestamp) => {
    // Convert to IST (UTC+5:30)
    let date;
    if (timestamp) {
        date = new Date(timestamp * 1000);
    } else if (datetimeUtc) {
        // Parse the Outscraper format "MM/DD/YYYY HH:mm:ss"
        const parts = datetimeUtc.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1];
        date = new Date(`${dateParts[2]}-${dateParts[0]}-${dateParts[1]}T${timeParts}Z`);
    } else {
        throw new Error('No datetime or timestamp provided');
    }

    // Convert to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const hour = istDate.getUTCHours();

    // Map to 2-hour slot
    const slotStart = Math.floor(hour / 2) * 2;
    const slotEnd = slotStart + 2;
    return `${String(slotStart).padStart(2, '0')}-${String(slotEnd).padStart(2, '0')}`;
};

/**
 * Extract date (IST) from Outscraper data point
 * @param {Object} dataPoint - Outscraper data point
 * @returns {Date} Date object (midnight UTC representing the IST date)
 */
export const extractDate = (dataPoint) => {
    let date;
    if (dataPoint.timestamp) {
        date = new Date(dataPoint.timestamp * 1000);
    } else if (dataPoint.datetime_utc) {
        const parts = dataPoint.datetime_utc.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1];
        date = new Date(`${dateParts[2]}-${dateParts[0]}-${dateParts[1]}T${timeParts}Z`);
    } else {
        throw new Error('No datetime or timestamp in data point');
    }

    // Convert to IST and get date string
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const dateStr = istDate.toISOString().split('T')[0];

    return new Date(dateStr + 'T00:00:00.000Z');
};

export default {
    fetchRouteTraffic,
    convertToTrafficScore,
    mapToTimeSlot,
    extractDate,
};
