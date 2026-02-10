import { Construction } from "../models/construction.model.js";
import { Diversion } from "../models/diversion.model.js";
import { Event } from "../models/event.model.js";
import { BMSEvent } from "../models/bms_event.model.js"; // ✅ ADDED: New BMS Collection
import { MetroStation } from "../models/metroStation.model.js"; // ✅ ADDED: Metro Stations
import { getFestivalForDate } from "./festival.controller.js"; // ✅ ADDED: Festival Logic
import { hotspotLocation } from "../models/nearbyHotspot.model.js";
import { Complaint } from "../models/complaint.model.js";
import { Image } from "../models/image.model.js";
import PathInfo from '../models/pathinfo.model.js';
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
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const getWeatherData = async () => {
  const now = Date.now();
  if (weatherCache.data && (now - weatherCache.timestamp) < CACHE_DURATION) {
    return weatherCache.data;
  }

  try {
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    const PUNE_LAT = 18.5204;
    const PUNE_LNG = 73.8567;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${PUNE_LAT}&lon=${PUNE_LNG}&appid=${API_KEY}&units=metric`;

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
    console.error("Weather API error:", error.message);
    return null;
  }
};

const getWeatherScore = async () => {
  const weather = await getWeatherData();
  if (!weather) return { score: 0, details: null };

  const score = WEATHER_IMPACT[weather.condition] || 0;
  return { score, details: weather };
};

// --- MAIN PREDICTION CONTROLLER ---
export const predictTraffic = async (req, res) => {
  const { pathId, date, timeSlot, routePoints } = req.body;

  if (!date || !timeSlot || !routePoints || !pathId) {
    return res.status(400).json({ error: "date, timeSlot, pathId, and routePoints are required" });
  }

  const pointBatchSize = 7;
  let yourHistoryScore = 0;
  let yourObstacleScore = 0;

  // Initialize individual score accumulators
  let constructionScore = 0;
  let diversionScore = 0;
  let eventScore = 0; // Combined User + BMS Events
  let hotspotScore = 0;
  let metroStationScore = 0; // ✅ Metro Station Impact
  let metroStationCount = 0; // ✅ Count found stations
  let festivalScore = 0;     // ✅ Festival Impact
  let potholeScore = 0;
  let complaintScore = 0;

  // Unique Tracking Sets
  let scoredConstructionIds = new Set();
  let scoredDiversionIds = new Set();
  let scoredEventIds = new Set();
  let scoredHotspotIds = new Set();
  let scoredMetroStationIds = new Set(); // ✅ Track scored stations
  let scoredPotholeIds = new Set();
  let scoredComplaintIds = new Set();

  let constructionCount = 0;
  let diversionCount = 0;
  let eventCount = 0;
  let hotspotCount = 0;
  let potholeCount = 0;
  let complaintCount = 0;

  try {
    // 1. Get Historical Score
    const historicalRecords = await PathInfo.find({ pathId, timeRange: timeSlot });
    if (historicalRecords.length > 0) {
      const totalScore = historicalRecords.reduce((sum, record) => sum + Number(record.score), 0);
      yourHistoryScore = totalScore / historicalRecords.length;
    }

    // 2. Get Obstacle Data
    // For small routes, use all points. For larger routes, sample every Nth point
    const filteredPoints = routePoints.length <= pointBatchSize
      ? routePoints
      : routePoints.filter((_, index) => index % pointBatchSize === 0);
    console.log(`📊 DEBUG: Using ${filteredPoints.length} of ${routePoints.length} route points`);

    const constructions = await Construction.find({});
    const diversions = await Diversion.find({});

    // ✅ FETCH BOTH EVENT TYPES
    const userEvents = await Event.find({});
    const bmsEvents = await BMSEvent.find({}); // Fetch scraped BMS events

    // ✅ FETCH METRO STATIONS
    const metroStations = await MetroStation.find({});
    console.log(`📊 DEBUG: Found ${bmsEvents.length} BMS events, ${userEvents.length} user events, ${metroStations.length} metro stations`);

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

      // --- ✅ BMS EVENTS (Dynamic Popularity Weight) ---
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

              // 🔥 Apply Popularity Multiplier
              // Formula: Base Weight (30) + Popularity Bonus (0-50 points)
              // If popularity is 90 ("Filling Fast"), Bonus is 45. Total = 75 points!
              const popularityBonus = (bmsEvent.popularityScore / 100) * 50;
              const finalEventScore = W_EVENT + popularityBonus;

              console.log(`   🎉 Found BMS Event: "${bmsEvent.name}" | Pop: ${bmsEvent.popularityScore} | Added: +${finalEventScore.toFixed(0)}`);

              eventScore += finalEventScore;
              eventCount++;
              break;
            }
          }
        }
      }

      // --- ✅ METRO STATION CROWD IMPACT ---
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

          console.log(`   🚇 Found Metro Station: "${station.name}" (${station.type}) | Crowd: ${station.crowdFactor} | TimeMult: ${timeMult} | Added: +${finalScore.toFixed(0)}`);
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

    // --- ✅ FESTIVAL IMPACT (Multi-Day) ---
    // Uses Calendarific API + Duration Logic
    const festival = await getFestivalForDate(date);
    if (festival) {
      festivalScore = festival.impact;
      console.log(`   🪔 Holiday: "${festival.festivalName}" (${festival.duration} days) | Impact: +${festivalScore}`);
    }

    // 3. Get Weather Score
    let weatherScoreValue = 0;
    let weatherDetails = null;
    const weatherResult = await getWeatherScore();
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

    // --- LOGGING ---
    console.log("------------------------------------------------");
    console.log(`🔍 TRAFFIC SCORE BREAKDOWN for Path: ${pathId}`);
    console.log(`📅 Date: ${date} | TimeSlot: ${timeSlot}`);
    console.log("------------------------------------------------");
    console.log(`🏗️  Construction: ${constructionCount} found | Score: +${constructionScore}`);
    console.log(`🚧 Diversion:    ${diversionCount} found | Score: +${diversionScore}`);
    console.log(`🎉 Event (All):  ${eventCount} found | Score: +${eventScore.toFixed(0)}`);
    console.log(`🪔 Festival:     ${festival ? festival.festivalName : 'None'} | Score: +${festivalScore}`);
    console.log(`🚇 Metro Stn:    ${metroStationCount} found | Score: +${metroStationScore.toFixed(0)}`);
    console.log(`🔥 Hotspot:      ${hotspotCount} found | Score: +${hotspotScore}`);
    console.log(`🕳️  Pothole:      ${potholeCount} found | Score: +${potholeScore.toFixed(0)}`);
    console.log(`📢 Complaint:    ${complaintCount} found | Score: +${complaintScore.toFixed(0)}`);
    console.log(`☁️  Weather:      ${weatherDetails?.condition || 'N/A'} (${weatherDetails?.temp || 0}°C) | Score: +${weatherScoreValue}`);
    console.log(`🚌 Transit/Bus:  ${transitDetails?.upcomingDepartures || 0} departures, ${transitDetails?.nearbyStopsOrigin || 0}+${transitDetails?.nearbyStopsDest || 0} stops | Score: +${transitScore}`);
    console.log("------------------------------------------------");
    console.log(`📊 TOTAL OBSTACLE SCORE: ${yourObstacleScore.toFixed(2)}`);
    console.log(`📜 HISTORICAL SCORE:     ${yourHistoryScore.toFixed(2)}`);
    console.log("------------------------------------------------");

    // 6. Return Scores
    res.json({
      yourHistoryScore,
      yourObstacleScore,
      weatherScore: weatherScoreValue,
      weather: weatherDetails, // { condition, description, temp, icon }
      transitScore,
      transit: transitDetails, // { busRoutes, upcomingDepartures, nearbyStops... }
      constructionCount,
      diversionCount,
      eventCount,
      metroStationCount, // ✅ Added to response
      hotspotCount,
      festival, // ✅ Added Festival details object
      potholeCount,
      complaintCount,
    });

  } catch (error) {
    console.error("Error predicting traffic:", error);
    res.status(500).json({ error: "Server error during traffic prediction." });
  }
};