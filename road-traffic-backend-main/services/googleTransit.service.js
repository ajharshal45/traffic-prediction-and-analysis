/**
 * Google Transit Service
 * Fetches bus/transit data using Google Maps APIs
 * - Directions API: Get transit routes between points
 * - Nearby Search: Find bus stops near a location
 */

import axios from 'axios';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Cache transit data for 10 minutes to reduce API calls
let transitCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Get transit directions between two points
 * Returns bus/transit departure times along the route
 */
export const getTransitDirections = async (originLat, originLng, destLat, destLng) => {
    const cacheKey = `dir_${originLat}_${originLng}_${destLat}_${destLng}`;
    const cached = transitCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/directions/json`;
        const response = await axios.get(url, {
            params: {
                origin: `${originLat},${originLng}`,
                destination: `${destLat},${destLng}`,
                mode: 'transit',
                transit_mode: 'bus',
                alternatives: true,
                key: GOOGLE_API_KEY
            }
        });

        if (response.data.status !== 'OK') {
            console.log(`⚠️ Transit API: ${response.data.status}`);
            return null;
        }

        const routes = response.data.routes || [];
        const transitInfo = {
            routeCount: routes.length,
            departures: [],
            transitSteps: []
        };

        routes.forEach(route => {
            const legs = route.legs || [];
            legs.forEach(leg => {
                const steps = leg.steps || [];
                steps.forEach(step => {
                    if (step.travel_mode === 'TRANSIT' && step.transit_details) {
                        const transit = step.transit_details;
                        transitInfo.departures.push({
                            departureTime: transit.departure_time?.text || 'N/A',
                            arrivalTime: transit.arrival_time?.text || 'N/A',
                            lineName: transit.line?.short_name || transit.line?.name || 'Bus',
                            vehicleType: transit.line?.vehicle?.type || 'BUS',
                            numStops: transit.num_stops || 0,
                            departureStop: transit.departure_stop?.name || 'Unknown',
                            arrivalStop: transit.arrival_stop?.name || 'Unknown'
                        });
                        transitInfo.transitSteps.push({
                            from: transit.departure_stop?.name,
                            to: transit.arrival_stop?.name,
                            line: transit.line?.short_name || transit.line?.name
                        });
                    }
                });
            });
        });

        transitCache.set(cacheKey, { data: transitInfo, timestamp: Date.now() });
        return transitInfo;

    } catch (error) {
        console.error('❌ Google Transit API Error:', error.message);
        return null;
    }
};

/**
 * Get nearby transit stations/bus stops
 * Uses Places API Nearby Search
 */
export const getNearbyTransitStops = async (lat, lng, radius = 500) => {
    const cacheKey = `nearby_${lat}_${lng}_${radius}`;
    const cached = transitCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
        const response = await axios.get(url, {
            params: {
                location: `${lat},${lng}`,
                radius: radius,
                type: 'transit_station|bus_station',
                key: GOOGLE_API_KEY
            }
        });

        if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
            console.log(`⚠️ Places API: ${response.data.status}`);
            return { stops: [], count: 0 };
        }

        const places = response.data.results || [];
        const stops = places.map(place => ({
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            vicinity: place.vicinity || ''
        }));

        const result = { stops, count: stops.length };
        transitCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;

    } catch (error) {
        console.error('❌ Google Places API Error:', error.message);
        return { stops: [], count: 0 };
    }
};

/**
 * Calculate transit impact score for a route
 * Combines both approaches for comprehensive data
 */
export const calculateTransitImpact = async (originLat, originLng, destLat, destLng) => {
    // Get transit directions along the route
    const transitDirections = await getTransitDirections(originLat, originLng, destLat, destLng);

    // Get nearby stops at origin and destination
    const originStops = await getNearbyTransitStops(originLat, originLng, 300);
    const destStops = await getNearbyTransitStops(destLat, destLng, 300);

    // Calculate score based on transit activity
    let score = 0;
    let details = {
        busRoutes: 0,
        upcomingDepartures: 0,
        nearbyStopsOrigin: originStops.count,
        nearbyStopsDest: destStops.count,
        transitSteps: []
    };

    if (transitDirections) {
        details.busRoutes = transitDirections.routeCount;
        details.upcomingDepartures = transitDirections.departures.length;
        details.transitSteps = transitDirections.transitSteps.slice(0, 5); // Top 5

        // Buses have minimal traffic impact - only 0.5 points per active bus
        score += transitDirections.departures.length * 0.5;
    }

    // Nearby stops have very minor impact - 0.3 points per nearby stop
    score += (originStops.count + destStops.count) * 0.3;

    // Apply time-based multiplier
    const hour = new Date().getHours();
    let timeMultiplier = 1.0;

    if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21)) {
        timeMultiplier = 1.3; // Slight increase during peak hours
    } else if (hour >= 22 || hour <= 5) {
        timeMultiplier = 0.2; // Almost no bus activity late night
    }

    score = Math.round(score * timeMultiplier);

    // Cap the score at 15 (buses have LOW impact on traffic)
    score = Math.min(score, 15);

    return {
        score,
        details,
        isPeakHour: timeMultiplier > 1.0
    };
};

export default {
    getTransitDirections,
    getNearbyTransitStops,
    calculateTransitImpact
};
