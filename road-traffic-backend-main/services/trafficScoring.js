import axios from 'axios';
import { Construction } from "../models/construction.model.js";
import { Diversion } from "../models/diversion.model.js";
import { Event } from "../models/event.model.js";
import { BMSEvent } from "../models/bms_event.model.js";
import { MetroStation } from "../models/metroStation.model.js";
import { getFestivalForDate } from "../controllers/festival.controller.js";
import { hotspotLocation } from "../models/nearbyHotspot.model.js";
import { Complaint } from "../models/complaint.model.js";
import { Image } from "../models/image.model.js";
import PathInfo from '../models/pathinfo.model.js';
import PredictionLog from '../models/predictionLog.model.js';
import { calculateTransitImpact } from './googleTransit.service.js';
import { normalizePathId } from '../utils/normalizePathId.js';

// --- CALIBRATED WEIGHT CONSTANTS ---
const W_CONSTRUCTION = 25;
const W_DIVERSION = 20;
const W_EVENT = 20;
const W_HOTSPOT = 12;
const W_POTHOLE = 8;
const W_COMPLAINT = 5;
const PROXIMITY_RADIUS_M = 200;

// --- TIME-OF-DAY MULTIPLIERS ---
export const getTimeMultiplier = (timeSlot) => {
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
export const calculateDistance = (point1, point2) => {
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

export const getCurrentWeather = async () => {
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

export const getForecastWeather = async (targetDate) => {
  const now = Date.now();
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

  const targetMs = new Date(targetDate).setHours(12, 0, 0, 0);
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

export const getWeatherForDate = async (targetDate) => {
  const now = new Date();
  const target = new Date(targetDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return getCurrentWeather();
  } else if (diffDays <= 5) {
    return getForecastWeather(targetDate);
  } else {
    return null;
  }
};

export const getWeatherScore = async (date) => {
  const weather = await getWeatherForDate(date);
  if (!weather) return { score: 0, details: null };
  const score = WEATHER_IMPACT[weather.condition] || 0;
  return { score, details: weather };
};

// --- GOOGLE TRAFFIC SCORE ---
export const getGoogleTrafficScore = async (sourceCoords, destinationCoords, date, timeSlot) => {
  try {
    const origin = `${sourceCoords.lat},${sourceCoords.lng}`;
    const dest = `${destinationCoords.lat},${destinationCoords.lng}`;
    const hour = parseInt(timeSlot.split('-')[0]);
    const departureDate = new Date(date);
    departureDate.setHours(hour, 0, 0, 0);

    const now = new Date();
    let departureTimestamp = Math.floor(departureDate.getTime() / 1000);
    if (departureDate <= now) {
      departureTimestamp = Math.floor(now.getTime() / 1000) + 60;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&departure_time=${departureTimestamp}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);

    if (!response.data.routes || response.data.routes.length === 0) {
      return { googleScore: 0, durationNormal: 0, durationTraffic: 0 };
    }

    const leg = response.data.routes[0].legs[0];
    const durationNormal = leg.duration.value;
    const durationTraffic = leg.duration_in_traffic?.value || durationNormal;

    let googleScore = ((durationTraffic - durationNormal) / durationNormal) * 100;
    if (googleScore < 0) googleScore = 0;

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

// --- CORE SCORING LOGIC ---
export const calculateTrafficScore = async (pathIdRaw, date, timeSlot, routePoints, sourceCoords, destinationCoords, skipGoogle = false) => {
  const pathId = normalizePathId(pathIdRaw);
  const pointBatchSize = 7;
  let yourHistoryScore = 0;
  let yourObstacleScore = 0;

  let constructionScore = 0, diversionScore = 0, eventScore = 0, hotspotScore = 0;
  let metroStationScore = 0, festivalScore = 0, potholeScore = 0, complaintScore = 0;
  
  let constructionCount = 0, diversionCount = 0, eventCount = 0, hotspotCount = 0;
  let metroStationCount = 0, potholeCount = 0, complaintCount = 0;

  let scoredConstructionIds = new Set(), scoredDiversionIds = new Set(), scoredEventIds = new Set();
  let scoredHotspotIds = new Set(), scoredMetroStationIds = new Set(), scoredPotholeIds = new Set(), scoredComplaintIds = new Set();

  try {
    // 1. History
    const selectedDayOfWeek = new Date(date).getDay();
    const historicalRecords = await PathInfo.find({ pathId, timeRange: timeSlot });
    const sameDayRecords = historicalRecords.filter(r => new Date(r.date).getDay() === selectedDayOfWeek);
    const recordsToUse = sameDayRecords.length >= 4 ? sameDayRecords : historicalRecords;

    if (recordsToUse.length > 0) {
      const totalScore = recordsToUse.reduce((sum, record) => sum + Number(record.score), 0);
      yourHistoryScore = totalScore / recordsToUse.length;
    }

    // 2. Obstacles
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

    for (let point of filteredPoints) {
      for (let construction of constructions) {
        if (scoredConstructionIds.has(construction._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(construction.startDate) && new Date(date) <= new Date(construction.expectedEndDate);
        if (isDateInRange) {
          for (let cPoint of construction.constructionPoints) {
            if (calculateDistance(point, cPoint) <= PROXIMITY_RADIUS_M) {
              scoredConstructionIds.add(construction._id.toString());
              constructionScore += W_CONSTRUCTION; constructionCount++; break;
            }
          }
        }
      }

      for (let diversion of diversions) {
        if (scoredDiversionIds.has(diversion._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(diversion.startDate) && new Date(date) <= new Date(diversion.endDate);
        if (isDateInRange) {
          for (let dPoint of diversion.diversionPoints) {
            if (calculateDistance(point, dPoint) <= PROXIMITY_RADIUS_M) {
              scoredDiversionIds.add(diversion._id.toString());
              diversionScore += W_DIVERSION; diversionCount++; break;
            }
          }
        }
      }

      for (let event of userEvents) {
        if (scoredEventIds.has(event._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(event.startTime) && new Date(date) <= new Date(event.endTime);
        if (isDateInRange) {
          for (let ePoint of event.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(event._id.toString());
              eventScore += W_EVENT; eventCount++; break;
            }
          }
        }
      }

      for (let bmsEvent of bmsEvents) {
        if (scoredEventIds.has(bmsEvent._id.toString())) continue;
        const reqDateStr = date.split('T')[0];
        const startDateStr = new Date(bmsEvent.startTime).toISOString().split('T')[0];
        const endDateStr = new Date(bmsEvent.endTime).toISOString().split('T')[0];
        if (reqDateStr >= startDateStr && reqDateStr <= endDateStr) {
          for (let ePoint of bmsEvent.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(bmsEvent._id.toString());
              const popularityBonus = (bmsEvent.popularityScore / 100) * 50;
              eventScore += W_EVENT + popularityBonus; eventCount++; break;
            }
          }
        }
      }

      for (let station of metroStations) {
        if (scoredMetroStationIds.has(station._id.toString())) continue;
        const stationPoint = { lat: station.location.lat, lng: station.location.lng };
        if (calculateDistance(point, stationPoint) <= PROXIMITY_RADIUS_M) {
          scoredMetroStationIds.add(station._id.toString());
          const baseScore = station.crowdFactor || 5;
          const hour = new Date(date).getHours();
          let timeMult = 1.0;
          if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) timeMult = 1.6;
          else if (hour < 6 || hour > 22) timeMult = 0.2;
          metroStationScore += (baseScore * 2) * timeMult; metroStationCount++; break;
        }
      }

      for (let hotspot of hotspots) {
        if (scoredHotspotIds.has(hotspot._id.toString())) continue;
        const hotspotPoint = { lat: parseFloat(hotspot.latitude), lng: parseFloat(hotspot.longitude) };
        if (calculateDistance(point, hotspotPoint) <= PROXIMITY_RADIUS_M) {
          scoredHotspotIds.add(hotspot._id.toString()); hotspotScore += W_HOTSPOT; hotspotCount++; break;
        }
      }

      for (let pothole of potholes) {
        if (scoredPotholeIds.has(pothole._id.toString())) continue;
        const potholePoint = { lat: parseFloat(pothole.latitude), lng: parseFloat(pothole.longitude) };
        if (calculateDistance(point, potholePoint) <= PROXIMITY_RADIUS_M) {
          scoredPotholeIds.add(pothole._id.toString());
          potholeScore += W_POTHOLE * getDecayFactor(pothole.createdAt); potholeCount++; break;
        }
      }

      for (let complaint of complaints) {
        if (scoredComplaintIds.has(complaint._id.toString())) continue;
        const complaintPoint = { lat: parseFloat(complaint.latitude), lng: parseFloat(complaint.longitude) };
        if (calculateDistance(point, complaintPoint) <= PROXIMITY_RADIUS_M) {
          scoredComplaintIds.add(complaint._id.toString());
          complaintScore += W_COMPLAINT * getDecayFactor(complaint.createdAt); complaintCount++; break;
        }
      }
    }

    const festival = await getFestivalForDate(date);
    if (festival) festivalScore = festival.impact;

    const weatherResult = await getWeatherScore(date);
    const weatherScoreValue = weatherResult.score;
    const weatherDetails = weatherResult.details;

    let transitScore = 0;
    let transitDetails = null;
    if (!skipGoogle && routePoints.length >= 2) {
      try {
        const transitResult = await calculateTransitImpact(routePoints[0].lat, routePoints[0].lng, routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng);
        transitScore = transitResult.score;
        transitDetails = transitResult.details;
      } catch (err) {}
    }

    const timeMultiplier = getTimeMultiplier(timeSlot);
    const rawObstacleScore = constructionScore + diversionScore + eventScore + hotspotScore + potholeScore + complaintScore + weatherScoreValue + transitScore + metroStationScore + festivalScore;
    yourObstacleScore = rawObstacleScore * timeMultiplier;

    let googleResult = { googleScore: 0, durationNormal: 0, durationTraffic: 0 };
    if (!skipGoogle && sourceCoords && destinationCoords) {
      googleResult = await getGoogleTrafficScore(sourceCoords, destinationCoords, date, timeSlot);
    }

    const yourCombinedRaw = yourHistoryScore + yourObstacleScore;
    let normalizedBackend = (yourCombinedRaw / 200) * 100;
    if (normalizedBackend > 100) normalizedBackend = 100;
    
    // Weight: 30% Google, 70% Backend (or 100% backend if skipGoogle)
    let finalScore = 0;
    if (skipGoogle) {
      finalScore = Math.round(normalizedBackend * 100) / 100;
    } else {
      finalScore = Math.round(((0.3 * googleResult.googleScore) + (0.7 * normalizedBackend)) * 100) / 100;
    }

    let correctionApplied = false;
    try {
      const historicalAccuracy = await PredictionLog.aggregate([
        { $match: { pathId, timeRange: timeSlot, isVerified: true } },
        { $group: { _id: null, avgPredicted: { $avg: '$predictedScore' }, avgActual: { $avg: '$actualScore' }, count: { $sum: 1 } } },
      ]);
      if (historicalAccuracy.length > 0 && historicalAccuracy[0].count >= 3) {
        const bias = historicalAccuracy[0].avgPredicted - historicalAccuracy[0].avgActual;
        if (bias < -10) {
          finalScore = Math.min(100, finalScore + 10);
          correctionApplied = true;
        }
      }
    } catch (err) {}

    finalScore = finalScore - 15;
    if (finalScore < 15) {
      finalScore = 2;
    }

    const breakdown = {
      construction: constructionScore, diversion: diversionScore, event: eventScore, hotspot: hotspotScore,
      pothole: potholeScore, complaint: complaintScore, weather: weatherScoreValue, transit: transitScore,
      metro: metroStationScore, festival: festivalScore, timeMultiplier, googleScore: googleResult.googleScore,
      historyScore: yourHistoryScore, obstacleScore: yourObstacleScore, constructionCount, diversionCount,
      eventCount, hotspotCount, potholeCount, complaintCount, metroCount: metroStationCount,
      weatherCondition: weatherDetails?.condition || '', festivalName: festival?.festivalName || ''
    };

    return {
      finalScore,
      breakdown,
      yourHistoryScore,
      yourObstacleScore,
      googleScore: googleResult.googleScore,
      durationNormal: googleResult.durationNormal,
      durationTraffic: googleResult.durationTraffic,
      weatherScore: weatherScoreValue,
      weatherDetails,
      transitScore,
      transitDetails,
      festival,
      correctionApplied
    };
  } catch (error) {
    console.error("calculateTrafficScore error:", error);
    throw error;
  }
};
