/**
 * Backfill Script - Add REAL breakdown data to existing PathInfo records
 * 
 * This uses the SAME LOGIC as predictTraffic.controller.js to calculate breakdown
 * by querying actual constructions, events, hotspots, metro stations etc. from DB
 * 
 * ONLY for records from December 15, 2025 onwards
 * 
 * Usage: node backfill_breakdown.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PathInfo from './models/pathinfo.model.js';
import { Construction } from './models/construction.model.js';
import { Diversion } from './models/diversion.model.js';
import { Event } from './models/event.model.js';
import { BMSEvent } from './models/bms_event.model.js';
import { MetroStation } from './models/metroStation.model.js';
import { hotspotLocation } from './models/nearbyHotspot.model.js';
import { Complaint } from './models/complaint.model.js';
import { Image } from './models/image.model.js';
import { getFestivalForDate } from './controllers/festival.controller.js';
import { MONITORED_ROUTES } from './services/dataCollector.service.js';

// Import ALL individual hotspot models (for detailed breakdown)
import { School } from './models/school.model.js';
import { Hospital } from './models/hospital.model.js';
import { Mall } from './models/mall.model.js';
import { Hotel } from './models/hotel.model.js';
import { Garden } from './models/garden.model.js';
import { BanquetHall } from './models/banquethall.model.js';
import { ParkingBuilding } from './models/parkingbuilding.model.js';

dotenv.config();

// --- WEIGHT CONSTANTS (same as predictTraffic.controller.js) ---
const W_CONSTRUCTION = 25;
const W_DIVERSION = 20;
const W_EVENT = 20;
const W_HOTSPOT = 12;
const W_POTHOLE = 8;
const W_COMPLAINT = 5;
const PROXIMITY_RADIUS_M = 200;

// --- HELPER FUNCTIONS (same as predictTraffic.controller.js) ---
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

const getDecayFactor = (dateReported, recordDate) => {
  const diffDays = Math.ceil(Math.abs(new Date(recordDate) - new Date(dateReported)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 1.0;
  if (diffDays <= 30) return 0.5;
  return 0.1;
};

const getTimeMultiplier = (timeSlot) => {
  const hour = parseInt(timeSlot.split('-')[0]);
  if (hour >= 0 && hour < 6) return 0.3;
  if (hour >= 6 && hour < 8) return 0.7;
  if (hour >= 8 && hour < 11) return 1.5;
  if (hour >= 11 && hour < 16) return 1.0;
  if (hour >= 16 && hour < 20) return 1.8;
  if (hour >= 20 && hour <= 23) return 0.6;
  return 1.0;
};

// Get route points for a pathId
const getRoutePoints = (pathId) => {
  const route = MONITORED_ROUTES.find(r => r.pathId === pathId);
  return route ? route.routePoints : [];
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

/**
 * Calculate REAL breakdown for a PathInfo record
 * Using the SAME LOGIC as predictTraffic.controller.js
 */
const calculateRealBreakdown = async (record) => {
  const { pathId, date, timeRange } = record;
  const routePoints = getRoutePoints(pathId);
  
  if (routePoints.length === 0) {
    console.log(`  No route points found for ${pathId}`);
    return null;
  }

  // Initialize counters and scores
  let constructionScore = 0, constructionCount = 0;
  let diversionScore = 0, diversionCount = 0;
  let eventScore = 0, eventCount = 0;
  let hotspotScore = 0, hotspotCount = 0;
  let metroStationScore = 0, metroStationCount = 0;
  let potholeScore = 0, potholeCount = 0;
  let complaintScore = 0, complaintCount = 0;
  let festivalScore = 0, festivalName = '';
  let weatherScore = 0, weatherCondition = '';
  let transitScore = 0;

  // Individual hotspot type counters
  let schoolScore = 0, schoolCount = 0;
  let hospitalScore = 0, hospitalCount = 0;
  let mallScore = 0, mallCount = 0;
  let hotelScore = 0, hotelCount = 0;
  let gardenScore = 0, gardenCount = 0;
  let banquetHallScore = 0, banquetHallCount = 0;
  let parkingBuildingScore = 0, parkingBuildingCount = 0;

  // Unique tracking sets
  const scoredConstructionIds = new Set();
  const scoredDiversionIds = new Set();
  const scoredEventIds = new Set();
  const scoredHotspotIds = new Set();
  const scoredMetroStationIds = new Set();
  const scoredPotholeIds = new Set();
  const scoredComplaintIds = new Set();
  const scoredSchoolIds = new Set();
  const scoredHospitalIds = new Set();
  const scoredMallIds = new Set();
  const scoredHotelIds = new Set();
  const scoredGardenIds = new Set();
  const scoredBanquetHallIds = new Set();
  const scoredParkingBuildingIds = new Set();

  try {
    // Format date for comparison
    const recordDate = new Date(date);
    const dateStr = recordDate.toISOString().split('T')[0];
    
    // Fetch all obstacle data from DB
    const constructions = await Construction.find({}).lean();
    const diversions = await Diversion.find({}).lean();
    const userEvents = await Event.find({}).lean();
    const bmsEvents = await BMSEvent.find({}).lean();
    const metroStations = await MetroStation.find({}).lean();
    const hotspots = await hotspotLocation.find({}).lean();
    const potholes = await Image.find({ isPothole: true, isresolved: false }).lean();
    const complaints = await Complaint.find({ isresolved: false }).lean();

    // Fetch individual hotspot types for detailed breakdown
    const schools = await School.find({}).lean();
    const hospitals = await Hospital.find({}).lean();
    const malls = await Mall.find({}).lean();
    const hotels = await Hotel.find({}).lean();
    const gardens = await Garden.find({}).lean();
    const banquetHalls = await BanquetHall.find({}).lean();
    const parkingBuildings = await ParkingBuilding.find({}).lean();

    // Sample route points (same as predictTraffic)
    const pointBatchSize = 7;
    const filteredPoints = routePoints.length <= pointBatchSize
      ? routePoints
      : routePoints.filter((_, index) => index % pointBatchSize === 0);

    // Iterate through route points
    for (let point of filteredPoints) {
      
      // --- CONSTRUCTIONS ---
      for (let construction of constructions) {
        if (scoredConstructionIds.has(construction._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(construction.startDate) &&
          new Date(date) <= new Date(construction.expectedEndDate);
        if (isDateInRange && construction.constructionPoints) {
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

      // --- DIVERSIONS ---
      for (let diversion of diversions) {
        if (scoredDiversionIds.has(diversion._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(diversion.startDate) &&
          new Date(date) <= new Date(diversion.endDate);
        if (isDateInRange && diversion.diversionPoints) {
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

      // --- USER EVENTS ---
      for (let event of userEvents) {
        if (scoredEventIds.has(event._id.toString())) continue;
        const isDateInRange = new Date(date) >= new Date(event.startTime) &&
          new Date(date) <= new Date(event.endTime);
        if (isDateInRange && event.eventPoints) {
          for (let ePoint of event.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(event._id.toString());
              eventScore += W_EVENT;
              eventCount++;
              break;
            }
          }
        }
      }

      // --- BMS EVENTS (with popularity bonus) ---
      for (let bmsEvent of bmsEvents) {
        if (scoredEventIds.has(bmsEvent._id.toString())) continue;
        const startDateStr = new Date(bmsEvent.startTime).toISOString().split('T')[0];
        const endDateStr = new Date(bmsEvent.endTime).toISOString().split('T')[0];
        const isDateInRange = dateStr >= startDateStr && dateStr <= endDateStr;
        
        if (isDateInRange && bmsEvent.eventPoints) {
          for (let ePoint of bmsEvent.eventPoints) {
            if (calculateDistance(point, ePoint) <= PROXIMITY_RADIUS_M) {
              scoredEventIds.add(bmsEvent._id.toString());
              const popularityBonus = ((bmsEvent.popularityScore || 0) / 100) * 50;
              eventScore += W_EVENT + popularityBonus;
              eventCount++;
              break;
            }
          }
        }
      }

      // --- METRO STATIONS ---
      for (let station of metroStations) {
        if (scoredMetroStationIds.has(station._id.toString())) continue;
        if (station.location) {
          const stationPoint = { lat: station.location.lat, lng: station.location.lng };
          if (calculateDistance(point, stationPoint) <= PROXIMITY_RADIUS_M) {
            scoredMetroStationIds.add(station._id.toString());
            const baseScore = station.crowdFactor || 5;
            const hour = parseInt(timeRange.split('-')[0]);
            let timeMult = 1.0;
            if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) {
              timeMult = 1.6;
            } else if (hour < 6 || hour > 22) {
              timeMult = 0.2;
            }
            metroStationScore += (baseScore * 2) * timeMult;
            metroStationCount++;
          }
        }
      }

      // --- HOTSPOTS ---
      for (let hotspot of hotspots) {
        if (scoredHotspotIds.has(hotspot._id.toString())) continue;
        const hotspotPoint = { lat: parseFloat(hotspot.latitude), lng: parseFloat(hotspot.longitude) };
        if (calculateDistance(point, hotspotPoint) <= PROXIMITY_RADIUS_M) {
          scoredHotspotIds.add(hotspot._id.toString());
          hotspotScore += W_HOTSPOT;
          hotspotCount++;
        }
      }

      // --- SCHOOLS (time-sensitive: active during school hours) ---
      for (let school of schools) {
        if (scoredSchoolIds.has(school._id.toString())) continue;
        const schoolPoint = { lat: parseFloat(school.latitude), lng: parseFloat(school.longitude) };
        if (calculateDistance(point, schoolPoint) <= PROXIMITY_RADIUS_M) {
          scoredSchoolIds.add(school._id.toString());
          const hour = parseInt(timeRange.split('-')[0]);
          // Higher impact during school hours (7-9 AM and 2-4 PM)
          let schoolTimeMult = 0.5;
          if ((hour >= 7 && hour <= 9) || (hour >= 14 && hour <= 16)) {
            schoolTimeMult = 2.0;
          }
          const studentsImpact = Math.min((school.numberOfStudents || 500) / 200, 3);
          const busImpact = Math.min((school.numberOfSchoolBuses || 5) / 2, 2);
          schoolScore += W_HOTSPOT * schoolTimeMult * (1 + studentsImpact + busImpact);
          schoolCount++;
        }
      }

      // --- HOSPITALS (always active, higher during emergencies) ---
      for (let hospital of hospitals) {
        if (scoredHospitalIds.has(hospital._id.toString())) continue;
        const hospitalPoint = { lat: parseFloat(hospital.latitude), lng: parseFloat(hospital.longitude) };
        if (calculateDistance(point, hospitalPoint) <= PROXIMITY_RADIUS_M) {
          scoredHospitalIds.add(hospital._id.toString());
          // Hospitals have consistent impact, slightly higher during visiting hours (10-12, 4-7)
          const hour = parseInt(timeRange.split('-')[0]);
          let hospitalTimeMult = 1.0;
          if ((hour >= 10 && hour <= 12) || (hour >= 16 && hour <= 19)) {
            hospitalTimeMult = 1.5;
          }
          const capacityImpact = Math.min((hospital.capacity || 100) / 100, 2);
          hospitalScore += W_HOTSPOT * hospitalTimeMult * (1 + capacityImpact);
          hospitalCount++;
        }
      }

      // --- MALLS (peak on weekends and evenings) ---
      for (let mall of malls) {
        if (scoredMallIds.has(mall._id.toString())) continue;
        const mallPoint = { lat: parseFloat(mall.latitude), lng: parseFloat(mall.longitude) };
        if (calculateDistance(point, mallPoint) <= PROXIMITY_RADIUS_M) {
          scoredMallIds.add(mall._id.toString());
          const hour = parseInt(timeRange.split('-')[0]);
          // Higher impact during evening shopping hours (5-9 PM)
          let mallTimeMult = 1.0;
          if (hour >= 17 && hour <= 21) {
            mallTimeMult = 1.8;
          } else if (hour >= 11 && hour <= 14) {
            mallTimeMult = 1.3; // Lunch hour shopping
          }
          const parkingImpact = Math.min((mall.parkingCapacity || 200) / 200, 2);
          mallScore += W_HOTSPOT * mallTimeMult * (1 + parkingImpact);
          mallCount++;
        }
      }

      // --- HOTELS (check-in/check-out times) ---
      for (let hotel of hotels) {
        if (scoredHotelIds.has(hotel._id.toString())) continue;
        const hotelPoint = { lat: parseFloat(hotel.latitude), lng: parseFloat(hotel.longitude) };
        if (calculateDistance(point, hotelPoint) <= PROXIMITY_RADIUS_M) {
          scoredHotelIds.add(hotel._id.toString());
          const hour = parseInt(timeRange.split('-')[0]);
          // Higher impact during check-in (2-6 PM) and check-out (9-12 AM)
          let hotelTimeMult = 0.8;
          if ((hour >= 9 && hour <= 12) || (hour >= 14 && hour <= 18)) {
            hotelTimeMult = 1.5;
          }
          const parkingImpact = Math.min((hotel.parkingCapacity || 50) / 50, 2);
          const crowdImpact = Math.min((hotel.crowdCapacity || 100) / 100, 1.5);
          hotelScore += W_HOTSPOT * hotelTimeMult * (1 + parkingImpact + crowdImpact);
          hotelCount++;
        }
      }

      // --- GARDENS (weekend and evening impact) ---
      for (let garden of gardens) {
        if (scoredGardenIds.has(garden._id.toString())) continue;
        const gardenPoint = { lat: parseFloat(garden.latitude), lng: parseFloat(garden.longitude) };
        if (calculateDistance(point, gardenPoint) <= PROXIMITY_RADIUS_M) {
          scoredGardenIds.add(garden._id.toString());
          const hour = parseInt(timeRange.split('-')[0]);
          // Higher impact during morning (6-9 AM) and evening (5-8 PM)
          let gardenTimeMult = 0.5;
          if ((hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20)) {
            gardenTimeMult = 1.5;
          }
          const capacityImpact = Math.min((garden.capacity || 200) / 200, 1.5);
          gardenScore += W_HOTSPOT * gardenTimeMult * (1 + capacityImpact);
          gardenCount++;
        }
      }

      // --- BANQUET HALLS (event-based, check event times) ---
      for (let hall of banquetHalls) {
        if (scoredBanquetHallIds.has(hall._id.toString())) continue;
        const hallPoint = { lat: parseFloat(hall.latitude), lng: parseFloat(hall.longitude) };
        if (calculateDistance(point, hallPoint) <= PROXIMITY_RADIUS_M) {
          scoredBanquetHallIds.add(hall._id.toString());
          // Check if event is happening at this time
          const hour = parseInt(timeRange.split('-')[0]);
          let hallTimeMult = 0.5;
          // Evening events are common (5-11 PM)
          if (hour >= 17 && hour <= 23) {
            hallTimeMult = 2.0;
          } else if (hour >= 11 && hour <= 14) {
            hallTimeMult = 1.5; // Lunch events
          }
          const vehiclesImpact = Math.min((hall.numberOfVehiclesExpected || 50) / 50, 2);
          const capacityImpact = Math.min((hall.hallCapacity || 200) / 200, 1.5);
          banquetHallScore += W_HOTSPOT * hallTimeMult * (1 + vehiclesImpact + capacityImpact);
          banquetHallCount++;
        }
      }

      // --- PARKING BUILDINGS (high during business hours) ---
      for (let parkingBuilding of parkingBuildings) {
        if (scoredParkingBuildingIds.has(parkingBuilding._id.toString())) continue;
        const pbPoint = { lat: parseFloat(parkingBuilding.latitude), lng: parseFloat(parkingBuilding.longitude) };
        if (calculateDistance(point, pbPoint) <= PROXIMITY_RADIUS_M) {
          scoredParkingBuildingIds.add(parkingBuilding._id.toString());
          const hour = parseInt(timeRange.split('-')[0]);
          // Higher impact during business hours (8-10 AM, 5-7 PM)
          let pbTimeMult = 0.8;
          if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
            pbTimeMult = 2.0;
          }
          const parkingImpact = Math.min((parkingBuilding.parkingCapacity || 100) / 100, 2);
          parkingBuildingScore += W_HOTSPOT * pbTimeMult * (1 + parkingImpact);
          parkingBuildingCount++;
        }
      }

      // --- POTHOLES ---
      for (let pothole of potholes) {
        if (scoredPotholeIds.has(pothole._id.toString())) continue;
        const potholePoint = { lat: parseFloat(pothole.latitude), lng: parseFloat(pothole.longitude) };
        if (calculateDistance(point, potholePoint) <= PROXIMITY_RADIUS_M) {
          scoredPotholeIds.add(pothole._id.toString());
          const decayFactor = getDecayFactor(pothole.createdAt, date);
          potholeScore += W_POTHOLE * decayFactor;
          potholeCount++;
        }
      }

      // --- COMPLAINTS ---
      for (let complaint of complaints) {
        if (scoredComplaintIds.has(complaint._id.toString())) continue;
        const complaintPoint = { lat: parseFloat(complaint.latitude), lng: parseFloat(complaint.longitude) };
        if (calculateDistance(point, complaintPoint) <= PROXIMITY_RADIUS_M) {
          scoredComplaintIds.add(complaint._id.toString());
          const decayFactor = getDecayFactor(complaint.createdAt, date);
          complaintScore += W_COMPLAINT * decayFactor;
          complaintCount++;
        }
      }
    }

    // --- FESTIVAL (skipped to avoid API rate limits) ---
    // const festival = await getFestivalForDate(dateStr);
    // if (festival) {
    //   festivalScore = festival.impact || 15;
    //   festivalName = festival.festivalName || festival.name || '';
    // }

    // --- TRANSIT (estimate based on time) ---
    const hour = parseInt(timeRange.split('-')[0]);
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
      transitScore = 10; // Rush hour transit impact
    } else if (hour >= 6 && hour <= 22) {
      transitScore = 5;
    }

    // Time multiplier
    const timeMultiplier = getTimeMultiplier(timeRange);

    // Calculate combined hotspot score (generic + all individual types)
    const totalHotspotScore = hotspotScore + schoolScore + hospitalScore + mallScore + 
                               hotelScore + gardenScore + banquetHallScore + parkingBuildingScore;
    const totalHotspotCount = hotspotCount + schoolCount + hospitalCount + mallCount + 
                               hotelCount + gardenCount + banquetHallCount + parkingBuildingCount;

    // Build breakdown object (matching PathInfo schema)
    const breakdown = {
      construction: Math.round(constructionScore),
      diversion: Math.round(diversionScore),
      event: Math.round(eventScore),
      hotspot: Math.round(totalHotspotScore),
      pothole: Math.round(potholeScore),
      complaint: Math.round(complaintScore),
      weather: weatherScore,
      transit: transitScore,
      metro: Math.round(metroStationScore),
      festival: festivalScore,
      timeMultiplier: timeMultiplier,
      constructionCount,
      diversionCount,
      eventCount,
      hotspotCount: totalHotspotCount,
      potholeCount,
      complaintCount,
      metroCount: metroStationCount,
      weatherCondition,
      festivalName,
      // Individual hotspot type breakdown
      schoolScore: Math.round(schoolScore),
      schoolCount,
      hospitalScore: Math.round(hospitalScore),
      hospitalCount,
      mallScore: Math.round(mallScore),
      mallCount,
      hotelScore: Math.round(hotelScore),
      hotelCount,
      gardenScore: Math.round(gardenScore),
      gardenCount,
      banquetHallScore: Math.round(banquetHallScore),
      banquetHallCount,
      parkingBuildingScore: Math.round(parkingBuildingScore),
      parkingBuildingCount
    };

    return breakdown;

  } catch (err) {
    console.error(`Error calculating breakdown for ${pathId} on ${date}:`, err.message);
    return null;
  }
};

// Main backfill function
const backfillBreakdown = async () => {
  try {
    // Only backfill data from December 15, 2025 onwards
    const backfillStartDate = new Date('2025-12-15');
    backfillStartDate.setHours(0, 0, 0, 0);
    
    // Find ALL records from Dec 15 onwards (reprocess to add new hotspot types)
    // This will update all records with the complete breakdown including individual hotspot types
    const recordsToUpdate = await PathInfo.find({
      date: { $gte: backfillStartDate }
    }).sort({ date: -1, timeRange: -1 });

    console.log(`\nFound ${recordsToUpdate.length} records from Dec 15, 2025 onwards to process`);
    
    if (recordsToUpdate.length === 0) {
      console.log('No records found from Dec 15 onwards!');
      return;
    }

    let updated = 0;
    let failed = 0;
    
    for (let i = 0; i < recordsToUpdate.length; i++) {
      const record = recordsToUpdate[i];
      
      try {
        const breakdown = await calculateRealBreakdown(record);
        
        if (breakdown) {
          await PathInfo.updateOne(
            { _id: record._id },
            { $set: { breakdown: breakdown } }
          );
          updated++;
        } else {
          failed++;
        }
        
        // Progress log
        if ((i + 1) % 50 === 0 || i === recordsToUpdate.length - 1) {
          console.log(`Processed: ${i + 1}/${recordsToUpdate.length} (${Math.round((i + 1) / recordsToUpdate.length * 100)}%)`);
        }
        
      } catch (err) {
        console.error(`Failed to update record ${record._id}:`, err.message);
        failed++;
      }
    }
    
    console.log('\n=== Backfill Complete ===');
    console.log(`Date Range: Dec 15, 2025 onwards`);
    console.log(`Total records processed: ${recordsToUpdate.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    
    // Show sample
    const sample = await PathInfo.findOne({ 
      date: { $gte: backfillStartDate },
      breakdown: { $exists: true, $ne: null }
    });
    
    if (sample) {
      console.log('\n--- Sample Record ---');
      console.log(`Route: ${sample.pathId}`);
      console.log(`Date: ${sample.date.toISOString().split('T')[0]}`);
      console.log(`Time: ${sample.timeRange}`);
      console.log(`Score: ${sample.score}`);
      console.log(`Breakdown:`, sample.breakdown);
    }
    
  } catch (err) {
    console.error('Backfill error:', err);
  }
};

// Run
const run = async () => {
  console.log('=== Starting Real Data Backfill ===');
  console.log('Using same logic as predictTraffic.controller.js\n');
  
  await connectDB();
  await backfillBreakdown();
  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
  process.exit(0);
};

run();
