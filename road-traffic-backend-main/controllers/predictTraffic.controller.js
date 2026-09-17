import PredictionLog from '../models/predictionLog.model.js';
import { calculateTrafficScore } from '../services/trafficScoring.js';

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

  try {
    const scoreData = await calculateTrafficScore(pathId, date, timeSlot, routePoints, sourceCoords, destinationCoords);
    
    // --- LOGGING ---
    console.log("------------------------------------------------");
    console.log(`🔍 TRAFFIC SCORE BREAKDOWN for Path: ${pathId}`);
    console.log(`📅 Date: ${date} | TimeSlot: ${timeSlot}`);
    console.log("------------------------------------------------");
    console.log(`🏗️  Construction: ${scoreData.breakdown.constructionCount} found | Score: +${scoreData.breakdown.construction}`);
    console.log(`🚧 Diversion:    ${scoreData.breakdown.diversionCount} found | Score: +${scoreData.breakdown.diversion}`);
    console.log(`🎉 Event (All):  ${scoreData.breakdown.eventCount} found | Score: +${scoreData.breakdown.event.toFixed(0)}`);
    console.log(`🪔 Festival:     ${scoreData.festival ? scoreData.festival.festivalName : 'None'} | Score: +${scoreData.breakdown.festival}`);
    console.log(`🚇 Metro Stn:    ${scoreData.breakdown.metroCount} found | Score: +${scoreData.breakdown.metro.toFixed(0)}`);
    console.log(`🔥 Hotspot:      ${scoreData.breakdown.hotspotCount} found | Score: +${scoreData.breakdown.hotspot}`);
    console.log(`🕳️  Pothole:      ${scoreData.breakdown.potholeCount} found | Score: +${scoreData.breakdown.pothole.toFixed(0)}`);
    console.log(`📢 Complaint:    ${scoreData.breakdown.complaintCount} found | Score: +${scoreData.breakdown.complaint.toFixed(0)}`);
    console.log(`☁️  Weather:      ${scoreData.weatherDetails?.condition || 'N/A'} (${scoreData.weatherDetails?.temp || 0}°C) | Score: +${scoreData.weatherScore}`);
    console.log(`🚌 Transit/Bus:  ${scoreData.transitDetails?.upcomingDepartures || 0} departures, ${scoreData.transitDetails?.nearbyStopsOrigin || 0}+${scoreData.transitDetails?.nearbyStopsDest || 0} stops | Score: +${scoreData.transitScore}`);
    console.log(`🚗 Google Score: ${scoreData.googleScore.toFixed(2)}%`);
    console.log("------------------------------------------------");
    console.log(`📊 TOTAL OBSTACLE SCORE:  ${scoreData.yourObstacleScore.toFixed(2)}`);
    console.log(`📜 HISTORICAL SCORE:      ${scoreData.yourHistoryScore.toFixed(2)}`);
    console.log(`🏁 FINAL WEIGHTED SCORE:  ${scoreData.finalScore.toFixed(2)}%${scoreData.correctionApplied ? ' (includes +10 under-prediction correction)' : ''}`);
    console.log("------------------------------------------------");

    // Save Prediction Log (fire-and-forget, don't block response)
    try {
      await PredictionLog.create({
        pathId,
        timeRange: timeSlot,
        predictedDate: new Date(date),
        predictedAt: new Date(),
        predictedScore: scoreData.finalScore,
        breakdown: scoreData.breakdown,
        actualScore: null,
        accuracy: null,
        isVerified: false,
      });
      console.log(`📝 Prediction logged for ${pathId} | ${date} | ${timeSlot} | Score: ${scoreData.finalScore}`);
    } catch (logErr) {
      console.error('Failed to save prediction log:', logErr.message);
    }

    res.json({
      yourHistoryScore: scoreData.yourHistoryScore,
      yourObstacleScore: scoreData.yourObstacleScore,
      googleScore: scoreData.googleScore,
      durationNormal: scoreData.durationNormal,
      durationTraffic: scoreData.durationTraffic,
      finalScore: scoreData.finalScore,
      weatherScore: scoreData.weatherScore,
      weather: scoreData.weatherDetails,
      transitScore: scoreData.transitScore,
      transit: scoreData.transitDetails,
      constructionCount: scoreData.breakdown.constructionCount,
      diversionCount: scoreData.breakdown.diversionCount,
      eventCount: scoreData.breakdown.eventCount,
      metroStationCount: scoreData.breakdown.metroCount,
      hotspotCount: scoreData.breakdown.hotspotCount,
      festival: scoreData.festival,
      potholeCount: scoreData.breakdown.potholeCount,
      complaintCount: scoreData.breakdown.complaintCount,
    });

  } catch (error) {
    console.error("Error predicting traffic:", error);
    res.status(500).json({ error: "Server error during traffic prediction." });
  }
};

// --- SMART TIME SUGGESTIONS (±2 adjacent slots, full prediction module) ---
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

  // Gather ±2 adjacent slots (excluding selected — we already have its score)
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

      // 6. Final weighted score (30% Google + 70% Backend) — same formula as main
      const combined = historyScore + obstacleScore;
      let normalizedBackend = (combined / 200) * 100;
      if (normalizedBackend > 100) normalizedBackend = 100;
      let finalScore = Math.round(((0.3 * googleResult.googleScore) + (0.7 * normalizedBackend)) * 100) / 100;
      finalScore -= 15;
      if (finalScore < 15) finalScore = 2;

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