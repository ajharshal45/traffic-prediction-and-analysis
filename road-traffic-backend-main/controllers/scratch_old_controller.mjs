import { Construction } from "../models/construction.model.js";
import { Diversion } from "../models/diversion.model.js";
import { Event } from "../models/event.model.js";
import { BMSEvent } from "../models/bms_event.model.js"; 
import { MetroStation } from "../models/metroStation.model.js";
import { getFestivalForDate } from "./festival.controller.js"; 
import { hotspotLocation } from "../models/nearbyHotspot.model.js";
import { Complaint } from "../models/complaint.model.js";
import { Image } from "../models/image.model.js";
import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';
import axios from 'axios';
import { calculateTransitImpact } from '../services/googleTransit.service.js';

// --- CALIBRATED WEIGHT CONSTANTS ---
const W_CONSTRUCTION = 25;  // Reduced from 40
const W_DIVERSION = 20;     // Reduced from 30
const W_EVENT = 20;         // Reduced from 30
const W_HOTSPOT = 12;       // Reduced from 20
const W_POTHOLE = 8;        // Reduced from 15
const W_COMPLAINT = 5;      // Reduced from 10
const PROXIMITY_RADIUS_M = 200;

// --- TIME-OF-DAY MULTIPLIERS ---
const getTimeMultiplier = (timeSlot) => {
  const hour = parseInt(timeSlot.split('-')[0]);
  if (hour >= 0 && hour < 6) return 0.3;   // Night: Very Low
  if (hour >= 6 && hour < 8) return 0.7;   // Early Morning
  if (hour >= 8 && hour < 11) return 1.5;  // Morning Rush
  if (hour >= 11 && hour < 16) return 1.0; // Midday Normal
  if (hour >= 16 && hour < 20) return 1.8; // Evening Rush (Peak)
  if (hour >= 20 && hour <= 23) return 0.6; // Late Evening
  return 1.0; // Default
};

// --- HELPER FUNCTIONS ---
const calculateDistance = (point1, point2) => {
  const R = 6371e3;
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const lat1 = toRadians(point1.lat);
  const lat2 = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getDecayFactor = (dateReported) => {
  const diffDays = Math.ceil(Math.abs(new Date() - new Date(dateReported)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 1.0;
  if (diffDays <= 30) return 0.5;
  return 0.1;
};

// --- WEATHER INTEGRATION (OpenWeatherMap) ---
const WEATHER_IMPACT = {
  'Thunderstorm': 40,
  'Rain': 35,
  'Drizzle': 20,
  'Snow': 30,
  'Fog': 25,
  'Mist': 15,
  'Haze': 10,
  'Clear': 0,
  'Clouds': 5
};

let weatherCache = { data: null, timestamp: 0 };
let forecastCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const API_KEY_WEATHER = () => process.env.OPENWEATHER_API_KEY;
const PUNE_LAT = 18.5204;
const PUNE_LNG = 73.8567;

// Fetch current weather (for today)
const getCurrentWeather = async () => {
  const now = Date.now();
  if (weatherCache.data && (now - weatherCache.timestamp) < CACHE_DURATION) {
    return weatherCache.data;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${PUNE_LAT}&lon=${PUNE_LNG}&appid=${API_KEY_WEATHER()}&units=metric`;
    const response = await axios.get(url);
    const weather = response.data;

    const result = {
      condition: weather.weather[0].main,
      description: weather.weather[0].description,
      temp: Math.round(weather.main.temp),
      icon: weather.weather[0].icon
    };

    weatherCache = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error("Weather API error (current):", error.message);
    return null;
  }
};

// Fetch 5-day/3-hour forecast and find closest block for targetDate
const getForecastWeather = async (targetDate) => {
  const now = Date.now();

  // Refresh forecast cache if stale
  if (!forecastCache.data || (now - forecastCache.timestamp) >= CACHE_DURATION) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${PUNE_LAT}&lon=${PUNE_LNG}&appid=${API_KEY_WEATHER()}&units=metric`;
      const response = await axios.get(url);
      forecastCache = { data: response.data.list, timestamp: now };
    } catch (error) {
      console.error("Weather API error (forecast):", error.message);
      return null;
    }
  }

  const forecastList = forecastCache.data;
  if (!forecastList || forecastList.length === 0) return null;

  // Target: noon (12:00) on the selected date for a representative forecast
  const targetMs = new Date(targetDate).setHours(12, 0, 0, 0);

  // Find the forecast block closest to targetDate noon
  let closest = forecastList[0];
  let minDiff = Math.abs(new Date(closest.dt_txt).getTime() - targetMs);

  for (const block of forecastList) {
    const diff = Math.abs(new Date(block.dt_txt).getTime() - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = block;
    }
  }

  return {
    condition: closest.weather[0].main,
    description: closest.weather[0].description,
    temp: Math.round(closest.main.temp),
    icon: closest.weather[0].icon
  };
};

// Date-aware weather fetcher
const getWeatherForDate = async (targetDate) => {
  const now = new Date();
  const target = new Date(targetDate);

  // Strip time for day comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    // Today or past date ΓåÆ use current weather
    return getCurrentWeather();
  } else if (diffDays <= 5) {
    // 1-5 days ahead ΓåÆ use 5-day forecast API
    return getForecastWeather(targetDate);
  } else {
    // 6+ days ahead ΓåÆ can't forecast
    console.log(`ΓÜá∩╕Å Weather: Date is ${diffDays} days ahead ΓÇö beyond 5-day forecast range`);
    return null;
  }
};

const getWeatherScore = async (date) => {
  const weather = await getWeatherForDate(date);
  if (!weather) return { score: 0, details: null };

  const score = WEATHER_IMPACT[weather.condition] || 0;
  return { score, details: weather };
};

// --- GOOGLE TRAFFIC SCORE (Server-side REST API) ---
const getGoogleTrafficScore = async (sourceCoords, destinationCoords, date, timeSlot) => {
  try {
    const origin = `${sourceCoords.lat},${sourceCoords.lng}`;
    const dest = `${destinationCoords.lat},${destinationCoords.lng}`;
    console.log(`≡ƒù║∩╕Å Google REST API coords: Origin=${origin} | Dest=${dest}`);

    // Build departure timestamp from date + timeSlot start hour
    const hour = parseInt(timeSlot.split('-')[0]);
    const departureDate = new Date(date);
    departureDate.setHours(hour, 0, 0, 0);

    // Google Directions API requires departure_time to be in the future
    const now = new Date();
    let departureTimestamp = Math.floor(departureDate.getTime() / 1000);
    if (departureDate <= now) {
      // If the requested time is in the past/now, use 'now' so the API returns live traffic
      departureTimestamp = Math.floor(now.getTime() / 1000) + 60; // 1 min from now
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin}&destination=${dest}` +
      `&departure_time=${departureTimestamp}` +
      `&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);

    if (!response.data.routes || response.data.routes.length === 0) {
      console.error('Google Directions API: No routes found');
      return { googleScore: 0, durationNormal: 0, durationTraffic: 0 };
    }

    const leg = response.data.routes[0].legs[0];
    const durationNormal = leg.duration.value;                // seconds (no-traffic baseline)
    const durationTraffic = leg.duration_in_traffic?.value || durationNormal; // seconds (with traffic)

    let googleScore = ((durationTraffic - durationNormal) / durationNormal) * 100;
    if (googleScore < 0) googleScore = 0;

    console.log(`≡ƒÜù Google REST API: Normal=${(durationNormal / 60).toFixed(1)}min | Traffic=${(durationTraffic / 60).toFixed(1)}min | Score=${googleScore.toFixed(2)}%`);

    return {
      googleScore: Math.round(googleScore * 100) / 100,
      durationNormal,
      durationTraffic
    };
  } catch (error) {
    console.error('Google Directions API error:', error.message);
    return { googleScore: 0, durationNormal: 0, durationTraffic: 0 };
  }
};

// --- MAIN PREDICTION CONTROLLER ---
export const predictTraffic = async (req, res) => {
  const { pathId, date, timeSlot, routePoints, sourceCoords, destinationCoords } = req.body;

  if (!date || !timeSlot || !routePoints || !pathId) {
    return res.status(400).json({ error: "date, timeSlot, pathId, and routePoints are required" });
  }

  // Block predictions for past dates/times
  const slotStart = parseInt(timeSlot.split('-')[0]);
  const selectedDateTime = new Date(date);
  selectedDateTime.setHours(slotStart, 0, 0, 0);
  if (selectedDateTime < new Date()) {
    return res.status(400).json({ error: "Cannot predict traffic for past dates/times. Please select a future date and time." });
  }

  const pointBatchSize = 7;
  let yourHistoryScore = 0;
  let yourObstacleScore = 0;

  // Initialize individual score accumulators
  let constructionScore = 0;
  let diversionScore = 0;
  let eventScore = 0; // Combined User + BMS Events
  let hotspotScore = 0;
  let metroStationScore = 0; // Γ£à Metro Station Impact
  let metroStationCount = 0; // Γ£à Count found stations
  let festivalScore = 0;     // Γ£à Festival Impact
  let potholeScore = 0;
  let complaintScore = 0;

  // Unique Tracking Sets
  let scoredConstructionIds = new Set();
  let scoredDiversionIds = new Set();
  let scoredEventIds = new Set();
  let scoredHotspotIds = new Set();
  let scoredMetroStationIds = new Set(); // Γ£à Track scored stations
  let scoredPotholeIds = new Set();
  let scoredComplaintIds = new Set();

  let constructionCount = 0;
  let diversionCount = 0;
  let eventCount = 0;
  let hotspotCount = 0;
  let potholeCount = 0;
  let complaintCount = 0;

  try {
    // 1. Get Historical Score (filtered by same day of week)
    const selectedDayOfWeek = new Date(date).getDay(); // 0=Sunday ΓÇª 6=Saturday
    const historicalRecords = await PathInfo.find({ pathId, timeRange: timeSlot });

    // Filter to only records from the same day of week (MondayΓåÆMonday, etc.)
    const sameDayRecords = historicalRecords.filter(record => {
      return new Date(record.date).getDay() === selectedDayOfWeek;
    });

    // Use same-day records if we have enough (>=4), otherwise fall back to all records
    const recordsToUse = sameDayRecords.length >= 4 ? sameDayRecords : historicalRecords;

    if (recordsToUse.length > 0) {
      const totalScore = recordsToUse.reduce((sum, record) => sum + Number(record.score), 0);
      yourHistoryScore = totalScore / recordsToUse.length;
    }
    console.log(`≡ƒôè Historical: ${sameDayRecords.length} same-day records, ${historicalRecords.length} total | Using: ${recordsToUse === sameDayRecords ? 'same-day' : 'all'} (${recordsToUse.length})`);

    // 2. Get Obstacle Data
    // For small routes, use all points. For larger routes, sample every Nth point
    const filteredPoints = routePoints.length <= pointBatchSize
      ? routePoints
      : routePoints.filter((_, index) => index % pointBatchSize === 0);
    console.log(`≡ƒôè DEBUG: Using ${filteredPoints.length} of ${routePoints.length} route points`);

    const constructions = await Construction.find({});
    const diversions = await Diversion.find({});

    // Γ£à FETCH BOTH EVENT TYPES
    const userEvents = await Event.find({});
    const bmsEvents = await BMSEvent.find({}); // Fetch scraped BMS events

    // Γ£à FETCH METRO STATIONS
    const metroStations = await MetroStation.find({});
    console.log(`≡ƒôè DEBUG: Found ${bmsEvents.length} BMS events, ${userEvents.length} user events, ${metroStations.length} metro stations`);

    const hotspots = await hotspotLocation.find({});
    const potholes = await Image.find({ isPothole: true, isresolved: false });
    const complaints = await Complaint.find({ isresolved: false });

    for (let point of filteredPoints) {
      // --- Constructions ---
      for (let construction of constructions) {
        if (scoredConstructionIds.has(construction._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(construction.startDate) &&
          new Date(date) <= new Date(construction.expectedEndDate);
        if (isDateInRange) {
          for (let cPoint of construction.constructionPoints) {
            if (calculateDistance(point, cPoint) <= PROXIMITY_RADIUS_M) {
              scoredConstructionIds.add(construction._id.toString());
              constructionScore += W_CONSTRUCTION;
              constructionCount++;
              break;
            }
          }
        }
      }

      // --- Diversions ---
      for (let diversion of diversions) {
        if (scoredDiversionIds.has(diversion._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(diversion.startDate) &&
          new Date(date) <= new Date(diversion.endDate);
        if (isDateInRange) {
          for (let dPoint of diversion.diversionPoints) {
            if (calculateDistance(point, dPoint) <= PROXIMITY_RADIUS_M) {
              scoredDiversionIds.add(diversion._id.toString());
              diversionScore += W_DIVERSION;
              diversionCount++;
              break;
            }
          }
        }
      }

      // --- USER EVENTS (Standard Weight) ---
      for (let event of userEvents) {
        if (scoredEventIds.has(event._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(event.startTime) &&
          new Date(date) <= new Date(event.endTime);
        if (isDateInRange) {
          for (let ePoint of event.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(event._id.toString());
              eventScore += W_EVENT; // Standard weight (30)
              eventCount++;
              break;
            }
          }
        }
      }

      // --- Γ£à BMS EVENTS (Dynamic Popularity Weight) ---
      for (let bmsEvent of bmsEvents) {
        if (scoredEventIds.has(bmsEvent._id.toString())) continue;

        // Date-only comparison (fixes UTC/IST timezone issues)
        // Compare just the date portion, ignoring time
        const reqDateStr = date.split('T')[0]; // "2026-01-28"
        const startDateStr = new Date(bmsEvent.startTime).toISOString().split('T')[0];
        const endDateStr = new Date(bmsEvent.endTime).toISOString().split('T')[0];
        const isDateInRange = reqDateStr >= startDateStr && reqDateStr <= endDateStr;

        if (isDateInRange) {
          for (let ePoint of bmsEvent.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(bmsEvent._id.toString());

              // ≡ƒöÑ Apply Popularity Multiplier
              // Formula: Base Weight (30) + Popularity Bonus (0-50 points)
              // If popularity is 90 ("Filling Fast"), Bonus is 45. Total = 75 points!
              const popularityBonus = (bmsEvent.popularityScore / 100) * 50;
              const finalEventScore = W_EVENT + popularityBonus;

              console.log(`   ≡ƒÄë Found BMS Event: "${bmsEvent.name}" | Pop: ${bmsEvent.popularityScore} | Added: +${finalEventScore.toFixed(0)}`);

              eventScore += finalEventScore;
              eventCount++;
              break;
            }
          }
        }
      }

      // --- Γ£à METRO STATION CROWD IMPACT ---
      // Stations cause traffic due to auto/cab congestion & pedestrian movement
      for (let station of metroStations) {
        if (scoredMetroStationIds.has(station._id.toString())) continue;

        const stationPoint = { lat: station.location.lat, lng: station.location.lng };
        if (calculateDistance(point, stationPoint) <= PROXIMITY_RADIUS_M) {
          scoredMetroStationIds.add(station._id.toString());

          // Base Score from Crowd Factor (e.g. 8 -> 8 pts)
          const baseScore = station.crowdFactor || 5;

          // Time Multiplier
          const hour = new Date(date).getHours();
          let timeMult = 1.0;
          // Peak Hours: 8-11 AM and 5-9 PM
          if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
            timeMult = 1.6; // High impact during rush hour
          } else if (hour < 6 || hour > 22) {
            timeMult = 0.2; // Low impact at night
          }

          // Final Calculation: Base * 2 + Bonus
          // E.g. Civil Court (10) * 2 * 1.6 (Peak) = 32 points!
          const finalScore = (baseScore * 2) * timeMult;

          metroStationScore += finalScore;
          metroStationCount++;

          console.log(`   ≡ƒÜç Found Metro Station: "${station.name}" (${station.type}) | Crowd: ${station.crowdFactor} | TimeMult: ${timeMult} | Added: +${finalScore.toFixed(0)}`);
          break;
        }
      }

      // --- Hotspots ---
      for (let hotspot of hotspots) {
        if (scoredHotspotIds.has(hotspot._id.toString())) continue;
        const hotspotPoint = { lat: parseFloat(hotspot.latitude), lng: parseFloat(hotspot.longitude) };
        if (calculateDistance(point, hotspotPoint) <= PROXIMITY_RADIUS_M) {
          scoredHotspotIds.add(hotspot._id.toString());
          hotspotScore += W_HOTSPOT;
          hotspotCount++;
          break;
        }
      }

      // --- Potholes ---
      for (let pothole of potholes) {
        if (scoredPotholeIds.has(pothole._id.toString())) continue;
        const potholePoint = { lat: parseFloat(pothole.latitude), lng: parseFloat(pothole.longitude) };
        if (calculateDistance(point, potholePoint) <= PROXIMITY_RADIUS_M) {
          scoredPotholeIds.add(pothole._id.toString());
          const decayFactor = getDecayFactor(pothole.createdAt);
          potholeScore += W_POTHOLE * decayFactor;
          potholeCount++;
          break;
        }
      }

      // --- Complaints ---
      for (let complaint of complaints) {
        if (scoredComplaintIds.has(complaint._id.toString())) continue;
        const complaintPoint = { lat: parseFloat(complaint.latitude), lng: parseFloat(complaint.longitude) };
        if (calculateDistance(point, complaintPoint) <= PROXIMITY_RADIUS_M) {
          scoredComplaintIds.add(complaint._id.toString());
          const decayFactor = getDecayFactor(complaint.createdAt);
          complaintScore += W_COMPLAINT * decayFactor;
          complaintCount++;
          break;
        }
      }
    }

    // --- Γ£à FESTIVAL IMPACT (Multi-Day) ---
    // Uses Calendarific API + Duration Logic
    const festival = await getFestivalForDate(date);
    if (festival) {
      festivalScore = festival.impact;
      console.log(`   ≡ƒ¬ö Holiday: "${festival.festivalName}" (${festival.duration} days) | Impact: +${festivalScore}`);
    }

    // 3. Get Weather Score
    let weatherScoreValue = 0;
    let weatherDetails = null;
    const weatherResult = await getWeatherScore(date);
    weatherScoreValue = weatherResult.score;
    weatherDetails = weatherResult.details;

    // 4. Get Transit/Bus Impact Score (Google API)
    let transitScore = 0;
    let transitDetails = null;
    if (routePoints.length >= 2) {
      const originPoint = routePoints[0];
      const destPoint = routePoints[routePoints.length - 1];
      try {
        const transitResult = await calculateTransitImpact(
          originPoint.lat, originPoint.lng,
          destPoint.lat, destPoint.lng
        );
        transitScore = transitResult.score;
        transitDetails = transitResult.details;
      } catch (err) {
        console.error('Transit API error:', err.message);
      }
    }

    // 5. Calculate Final Obstacle Score (with Time Multiplier)
    const timeMultiplier = getTimeMultiplier(timeSlot);
    const rawObstacleScore = constructionScore + diversionScore + eventScore + hotspotScore + potholeScore + complaintScore + weatherScoreValue + transitScore + metroStationScore + festivalScore;
    yourObstacleScore = rawObstacleScore * timeMultiplier;

    // 6. Get Google Traffic Score (server-side REST API)
    const googleResult = await getGoogleTrafficScore(sourceCoords, destinationCoords, date, timeSlot);

    // 7. Calculate Final Weighted Score (30% Google + 70% Backend)
    const yourCombinedRaw = yourHistoryScore + yourObstacleScore;
    let normalizedBackend = (yourCombinedRaw / 200) * 100;
    if (normalizedBackend > 100) normalizedBackend = 100;
    let finalScore = Math.round(((0.3 * googleResult.googleScore) + (0.7 * normalizedBackend)) * 100) / 100;

    // 7b. Self-correction: if this pathId+timeSlot historically under-predicts, add +10
    let correctionApplied = false;
    try {
      const historicalAccuracy = await PredictionLog.aggregate([
        { $match: { pathId, timeRange: timeSlot, isVerified: true } },
        {
          $group: {
            _id: null,
            avgPredicted: { $avg: '$predictedScore' },
            avgActual: { $avg: '$actualScore' },
            count: { $sum: 1 },
          },
        },
      ]);
      if (historicalAccuracy.length > 0 && historicalAccuracy[0].count >= 3) {
        const bias = historicalAccuracy[0].avgPredicted - historicalAccuracy[0].avgActual;
        if (bias < -10) {
          // Under-predicting by more than 10 ΓåÆ boost score by 10
          finalScore = Math.min(100, finalScore + 10);
          correctionApplied = true;
          console.log(`≡ƒöº Under-prediction correction: +10 applied (bias was ${bias.toFixed(1)})`);
        }
      }
    } catch (corrErr) {
      console.error('Correction lookup error:', corrErr.message);
    }

    // --- LOGGING ---
    console.log("------------------------------------------------");
    console.log(`≡ƒöì TRAFFIC SCORE BREAKDOWN for Path: ${pathId}`);
    console.log(`≡ƒôà Date: ${date} | TimeSlot: ${timeSlot}`);
    console.log("------------------------------------------------");
    console.log(`≡ƒÅù∩╕Å  Construction: ${constructionCount} found | Score: +${constructionScore}`);
    console.log(`≡ƒÜº Diversion:    ${diversionCount} found | Score: +${diversionScore}`);
    console.log(`≡ƒÄë Event (All):  ${eventCount} found | Score: +${eventScore.toFixed(0)}`);
    console.log(`≡ƒ¬ö Festival:     ${festival ? festival.festivalName : 'None'} | Score: +${festivalScore}`);
    console.log(`≡ƒÜç Metro Stn:    ${metroStationCount} found | Score: +${metroStationScore.toFixed(0)}`);
    console.log(`≡ƒöÑ Hotspot:      ${hotspotCount} found | Score: +${hotspotScore}`);
    console.log(`≡ƒò│∩╕Å  Pothole:      ${potholeCount} found | Score: +${potholeScore.toFixed(0)}`);
    console.log(`≡ƒôó Complaint:    ${complaintCount} found | Score: +${complaintScore.toFixed(0)}`);
    console.log(`Γÿü∩╕Å  Weather:      ${weatherDetails?.condition || 'N/A'} (${weatherDetails?.temp || 0}┬░C) | Score: +${weatherScoreValue}`);
    console.log(`≡ƒÜî Transit/Bus:  ${transitDetails?.upcomingDepartures || 0} departures, ${transitDetails?.nearbyStopsOrigin || 0}+${transitDetails?.nearbyStopsDest || 0} stops | Score: +${transitScore}`);
    console.log(`≡ƒÜù Google Score: ${googleResult.googleScore.toFixed(2)}%`);
    console.log("------------------------------------------------");
    console.log(`≡ƒôè TOTAL OBSTACLE SCORE:  ${yourObstacleScore.toFixed(2)}`);
    console.log(`≡ƒô£ HISTORICAL SCORE:      ${yourHistoryScore.toFixed(2)}`);
    console.log(`≡ƒôè NORMALIZED BACKEND:    ${normalizedBackend.toFixed(2)}%`);
    console.log(`≡ƒÅü FINAL WEIGHTED SCORE:  ${finalScore.toFixed(2)}%${correctionApplied ? ' (includes +10 under-prediction correction)' : ''}`);
    console.log("------------------------------------------------");

    // 8. Save Prediction Log (fire-and-forget, don't block response)
    try {
      await PredictionLog.create({
        pathId,
        timeRange: timeSlot,
        predictedDate: new Date(date),
        predictedAt: new Date(),
        predictedScore: finalScore,
        breakdown: {
          construction: constructionScore,
          diversion: diversionScore,
          event: eventScore,
          hotspot: hotspotScore,
          pothole: potholeScore,
          complaint: complaintScore,
          weather: weatherScoreValue,
          transit: transitScore,
          metro: metroStationScore,
          festival: festivalScore,
          timeMultiplier,
          googleScore: googleResult.googleScore,
          historyScore: yourHistoryScore,
          obstacleScore: yourObstacleScore,
          constructionCount,
          diversionCount,
          eventCount,
          hotspotCount,
          potholeCount,
          complaintCount,
          metroCount: metroStationCount,
          weatherCondition: weatherDetails?.condition || '',
          festivalName: festival?.festivalName || '',
        },
        actualScore: null,
        accuracy: null,
        isVerified: false,
      });
      console.log(`≡ƒô¥ Prediction logged for ${pathId} | ${date} | ${timeSlot} | Score: ${finalScore}`);
    } catch (logErr) {
      console.error('Failed to save prediction log:', logErr.message);
    }

    // 9. Return Scores
    res.json({
      yourHistoryScore,
      yourObstacleScore,
      googleScore: googleResult.googleScore,
      durationNormal: googleResult.durationNormal,
      durationTraffic: googleResult.durationTraffic,
      finalScore,
      weatherScore: weatherScoreValue,
      weather: weatherDetails, // { condition, description, temp, icon }
      transitScore,
      transit: transitDetails, // { busRoutes, upcomingDepartures, nearbyStops... }
      constructionCount,
      diversionCount,
      eventCount,
      metroStationCount,
      hotspotCount,
      festival,
      potholeCount,
      complaintCount,
    });

  } catch (error) {
    console.error("Error predicting traffic:", error);
    res.status(500).json({ error: "Server error during traffic prediction." });
  }
};

// --- SMART TIME SUGGESTIONS (┬▒2 adjacent slots, full prediction module) ---
export const getTimeSuggestions = async (req, res) => {
  const { pathId, date, timeSlot, routePoints, sourceCoords, destinationCoords, selectedScore } = req.body;

  if (!date || !timeSlot || !routePoints || !pathId || !sourceCoords || !destinationCoords) {
    return res.status(400).json({ error: "date, timeSlot, pathId, routePoints, sourceCoords, and destinationCoords are required" });
  }

  const allSlots = [
    "00-02", "02-04", "04-06", "06-08", "08-10", "10-12",
    "12-14", "14-16", "16-18", "18-20", "20-22", "22-24"
  ];

  const currentIndex = allSlots.indexOf(timeSlot);
  if (currentIndex === -1) {
    return res.status(400).json({ error: "Invalid timeSlot" });
  }

  // Gather ┬▒2 adjacent slots (excluding selected ΓÇö we already have its score)
  const slotsToEvaluate = [];
  for (let offset = -2; offset <= 2; offset++) {
    if (offset === 0) continue; // skip selected slot
    const idx = currentIndex + offset;
    if (idx >= 0 && idx < allSlots.length) slotsToEvaluate.push(allSlots[idx]);
  }

  try {
    // Pre-fetch all shared obstacle data once
    const pointBatchSize = 7;
    const filteredPoints = routePoints.length <= pointBatchSize
      ? routePoints
      : routePoints.filter((_, index) => index % pointBatchSize === 0);

    const [constructions, diversions, userEvents, bmsEvents, metroStations, hotspots, potholes, complaints] = await Promise.all([
      Construction.find({}),
      Diversion.find({}),
      Event.find({}),
      BMSEvent.find({}),
      MetroStation.find({}),
      hotspotLocation.find({}),
      Image.find({ isPothole: true, isresolved: false }),
      Complaint.find({ isresolved: false }),
    ]);

    const festival = await getFestivalForDate(date);
    const festivalScoreVal = festival ? festival.impact : 0;

    const weatherResult = await getWeatherScore(date);
    const weatherScoreValue = weatherResult.score;
    const weatherDetails = weatherResult.details;

    // Historical records for path (all time slots, we'll filter per slot)
    const allHistorical = await PathInfo.find({ pathId });
    const selectedDayOfWeek = new Date(date).getDay();

    const now = new Date();
    const suggestions = [];

    for (const slot of slotsToEvaluate) {
      // Block past time slots
      const slotStart = parseInt(slot.split('-')[0]);
      const slotDateTime = new Date(date);
      slotDateTime.setHours(slotStart, 0, 0, 0);
      if (slotDateTime < now) continue;

      // 1. Historical score
      const slotHistorical = allHistorical.filter(r => r.timeRange === slot);
      const sameDayRecords = slotHistorical.filter(r => new Date(r.date).getDay() === selectedDayOfWeek);
      const recordsToUse = sameDayRecords.length >= 4 ? sameDayRecords : slotHistorical;
      let historyScore = 0;
      if (recordsToUse.length > 0) {
        historyScore = recordsToUse.reduce((sum, r) => sum + Number(r.score), 0) / recordsToUse.length;
      }

      // 2. Obstacle scoring (identical to main prediction)
      let constructionScore = 0, diversionScore = 0, eventScore = 0;
      let hotspotScore = 0, potholeScore = 0, complaintScore = 0;
      let metroStationScore = 0;
      let constructionCount = 0, diversionCount = 0, eventCount = 0;
      let hotspotCount = 0, potholeCount = 0, complaintCount = 0, metroStationCount = 0;

      const scoredC = new Set(), scoredD = new Set(), scoredE = new Set();
      const scoredH = new Set(), scoredP = new Set(), scoredCo = new Set(), scoredM = new Set();

      for (const point of filteredPoints) {
        for (const c of constructions) {
          if (scoredC.has(c._id.toString())) continue;
          const inRange = new Date(date) >= new Date(c.startDate) && new Date(date) <= new Date(c.expectedEndDate);
          if (inRange) {
            for (const cp of c.constructionPoints) {
              if (calculateDistance(point, cp) <= PROXIMITY_RADIUS_M) {
                scoredC.add(c._id.toString()); constructionScore += W_CONSTRUCTION; constructionCount++; break;
              }
            }
          }
        }
        for (const d of diversions) {
          if (scoredD.has(d._id.toString())) continue;
          const inRange = new Date(date) >= new Date(d.startDate) && new Date(date) <= new Date(d.endDate);
          if (inRange) {
            for (const dp of d.diversionPoints) {
              if (calculateDistance(point, dp) <= PROXIMITY_RADIUS_M) {
                scoredD.add(d._id.toString()); diversionScore += W_DIVERSION; diversionCount++; break;
              }
            }
          }
        }
        for (const e of userEvents) {
          if (scoredE.has(e._id.toString())) continue;
          const inRange = new Date(date) >= new Date(e.startTime) && new Date(date) <= new Date(e.endTime);
          if (inRange) {
            for (const ep of e.eventPoints) {
              if (calculateDistance(point, ep) <= PROXIMITY_RADIUS_M) {
                scoredE.add(e._id.toString()); eventScore += W_EVENT; eventCount++; break;
              }
            }
          }
        }
        for (const bms of bmsEvents) {
          if (scoredE.has(bms._id.toString())) continue;
          const reqDateStr = date.split('T')[0];
          const startDateStr = new Date(bms.startTime).toISOString().split('T')[0];
          const endDateStr = new Date(bms.endTime).toISOString().split('T')[0];
          if (reqDateStr >= startDateStr && reqDateStr <= endDateStr) {
            for (const ep of bms.eventPoints) {
              if (calculateDistance(point, ep) <= PROXIMITY_RADIUS_M) {
                scoredE.add(bms._id.toString());
                const popularityBonus = (bms.popularityScore / 100) * 50;
                eventScore += W_EVENT + popularityBonus; eventCount++; break;
              }
            }
          }
        }
        for (const station of metroStations) {
          if (scoredM.has(station._id.toString())) continue;
          const stationPt = { lat: station.location.lat, lng: station.location.lng };
          if (calculateDistance(point, stationPt) <= PROXIMITY_RADIUS_M) {
            scoredM.add(station._id.toString());
            const baseScore = station.crowdFactor || 5;
            const hour = parseInt(slot.split('-')[0]);
            let timeMult = 1.0;
            if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) timeMult = 1.6;
            else if (hour < 6 || hour > 22) timeMult = 0.2;
            metroStationScore += (baseScore * 2) * timeMult; metroStationCount++;
          }
        }
        for (const h of hotspots) {
          if (scoredH.has(h._id.toString())) continue;
          const hp = { lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) };
          if (calculateDistance(point, hp) <= PROXIMITY_RADIUS_M) {
            scoredH.add(h._id.toString()); hotspotScore += W_HOTSPOT; hotspotCount++;
          }
        }
        for (const p of potholes) {
          if (scoredP.has(p._id.toString())) continue;
          const pp = { lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) };
          if (calculateDistance(point, pp) <= PROXIMITY_RADIUS_M) {
            scoredP.add(p._id.toString()); potholeScore += W_POTHOLE * getDecayFactor(p.createdAt); potholeCount++;
          }
        }
        for (const co of complaints) {
          if (scoredCo.has(co._id.toString())) continue;
          const cop = { lat: parseFloat(co.latitude), lng: parseFloat(co.longitude) };
          if (calculateDistance(point, cop) <= PROXIMITY_RADIUS_M) {
            scoredCo.add(co._id.toString()); complaintScore += W_COMPLAINT * getDecayFactor(co.createdAt); complaintCount++;
          }
        }
      }

      // 3. Transit score
      let transitScore = 0;
      if (routePoints.length >= 2) {
        try {
          const transitResult = await calculateTransitImpact(
            routePoints[0].lat, routePoints[0].lng,
            routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng
          );
          transitScore = transitResult.score;
        } catch (err) { /* ignore */ }
      }

      // 4. Time multiplier + obstacle total
      const timeMultiplier = getTimeMultiplier(slot);
      const rawObstacle = constructionScore + diversionScore + eventScore + hotspotScore + potholeScore + complaintScore + weatherScoreValue + transitScore + metroStationScore + festivalScoreVal;
      const obstacleScore = rawObstacle * timeMultiplier;

      // 5. Google Traffic Score (full REST API, same as main prediction)
      const googleResult = await getGoogleTrafficScore(sourceCoords, destinationCoords, date, slot);

      // 6. Final weighted score (30% Google + 70% Backend) ΓÇö same formula as main
      const combined = historyScore + obstacleScore;
      let normalizedBackend = (combined / 200) * 100;
      if (normalizedBackend > 100) normalizedBackend = 100;
      const finalScore = Math.round(((0.3 * googleResult.googleScore) + (0.7 * normalizedBackend)) * 100) / 100;

      // Only include if score is LOWER than the selected slot's score
      if (typeof selectedScore === 'number' && finalScore >= selectedScore) continue;

      suggestions.push({
        timeSlot: slot,
        score: finalScore,
        level: finalScore <= 15 ? 'very-low' : finalScore <= 29 ? 'low' : finalScore <= 59 ? 'medium' : finalScore <= 79 ? 'high' : 'very-high',
        breakdown: {
          constructionCount, diversionCount, eventCount, hotspotCount,
          potholeCount, complaintCount, metroStationCount,
          weatherCondition: weatherDetails?.condition || 'N/A',
          weatherDescription: weatherDetails?.description || '',
          weatherTemp: weatherDetails?.temp || 0,
          festival: festival ? festival.festivalName : 'None',
          googleScore: googleResult.googleScore,
          historyScore: Math.round(historyScore * 100) / 100,
          obstacleScore: Math.round(obstacleScore * 100) / 100,
          timeMultiplier,
          durationNormal: googleResult.durationNormal,
          durationTraffic: googleResult.durationTraffic,
        },
      });
    }

    // Sort by score ascending (best first)
    suggestions.sort((a, b) => a.score - b.score);

    // Tag best
    if (suggestions.length > 0) {
      suggestions[0].isBest = true;
    }

    console.log(`Time Suggestions for ${pathId} on ${date}: ${suggestions.length} better slots found`);

    res.json({ suggestions });
  } catch (error) {
    console.error("Error generating time suggestions:", error);
    res.status(500).json({ error: "Server error during time suggestions." });
  }
};
