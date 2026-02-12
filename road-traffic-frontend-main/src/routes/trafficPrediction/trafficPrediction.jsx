import React, { useState, useRef, useEffect } from "react";
import Select from "react-select";
import "./trafficPrediction.css";
import apiRequest from "../../lib/apiRequest";

const TrafficPrediction = () => {
    const [timeSlot, setTimeSlot] = useState(null);
    const [date, setDate] = useState("");
    const [sourceAddress, setSourceAddress] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [sourceCoords, setSourceCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [routePoints, setRoutePoints] = useState([]);
    const sourceInputRef = useRef(null);
    const destinationInputRef = useRef(null);
    const sourceAutocomplete = useRef(null);
    const destinationAutocomplete = useRef(null);
    const googleMapRef = useRef(null);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const [directionsRenderer, setDirectionsRenderer] = useState(null);
    const [message, setMessage] = useState(false);
    const [score, setScore] = useState(0);
    const [constructions, setConstructions] = useState(0);
    const [event, setEvents] = useState(0);
    const [diversions, setDiversions] = useState(0);
    const [hotspots, setHotspots] = useState(0);
    const [potholes, setPotholes] = useState(0); // ✅ ADDED
    const [complaints, setComplaints] = useState(0); // ✅ ADDED
    const [festival, setFestival] = useState(null);
    const [weather, setWeather] = useState(null);
    const [metroStations, setMetroStations] = useState(0);
    const [baseDuration, setBaseDuration] = useState(0); // Google's time at zero traffic in seconds
    const [estimatedTime, setEstimatedTime] = useState(0); // Estimated time with traffic in seconds
    const [suggestions, setSuggestions] = useState([]); // Smart time suggestions
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [expandedSlot, setExpandedSlot] = useState(null); // Which suggestion card is expanded

    const isScriptLoaded = useRef(false);
    const isMapInitialized = useRef(false);

    const sourceMarkerRef = useRef(null);
    const destinationMarkerRef = useRef(null);

    // Initialize Google Maps
    const loadGoogleMapsScript = () => {
        return new Promise((resolve, reject) => {
            // Check if Google Maps is already loaded
            if (window.google && window.google.maps) {
                resolve();
                return;
            }

            // Prevent multiple script loading attempts
            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                const checkGoogle = setInterval(() => {
                    if (window.google && window.google.maps) {
                        clearInterval(checkGoogle);
                        resolve();
                    }
                }, 200);
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                const checkGoogle = setInterval(() => {
                    if (window.google && window.google.maps) {
                        clearInterval(checkGoogle);
                        resolve();
                    }
                }, 200);
            };

            script.onerror = (error) => {
                console.error('Failed to load Google Maps script', error);
                reject(error);
            };

            document.head.appendChild(script);
        });
    };

    const initializeMap = async () => {
        // Prevent multiple initializations
        if (isMapInitialized.current) return;

        try {
            // Ensure Google Maps script is loaded
            await loadGoogleMapsScript();

            // Wait for the map container to be available
            const mapContainer = document.getElementById('googleMap');
            if (!mapContainer) {
                console.error('Map container not found. Retrying...');
                return;
            }

            // Ensure Google Maps and its libraries are fully loaded
            if (!window.google?.maps?.Map) {
                throw new Error('Google Maps API not fully loaded');
            }

            const mapOptions = {
                zoom: 12,
                center: { lat: 18.46456, lng: 73.87389 },
                mapTypeId: window.google.maps.MapTypeId.ROADMAP
            };

            const map = new window.google.maps.Map(mapContainer, mapOptions);
            googleMapRef.current = map;

            // Add layers and renderers safely
            if (window.google.maps.TrafficLayer) {
                const trafficLayer = new window.google.maps.TrafficLayer();
                trafficLayer.setMap(map);
            }

            const renderer = new window.google.maps.DirectionsRenderer({
                map: map,
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: '#1e11f0',
                    strokeWeight: 2
                }
            });
            setDirectionsRenderer(renderer);

            // Initialize autocomplete after map is ready
            initializeAutocomplete();

            isMapInitialized.current = true;
        } catch (error) {
            console.error('Initialization error:', error);
            // Reset initialization flag to allow retry
            isMapInitialized.current = false;
        }
    };

    const updateEndpointMarkers = () => {
        // Clear existing endpoint markers
        if (sourceMarkerRef.current) sourceMarkerRef.current.setMap(null);
        if (destinationMarkerRef.current) destinationMarkerRef.current.setMap(null);

        // Create source marker
        if (sourceCoords) {
            sourceMarkerRef.current = new window.google.maps.Marker({
                position: sourceCoords,
                map: googleMapRef.current,
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new window.google.maps.Size(35, 35)
                },
                title: 'Source'
            });
        }

        // Create destination marker
        if (destinationCoords) {
            destinationMarkerRef.current = new window.google.maps.Marker({
                position: destinationCoords,
                map: googleMapRef.current,
                icon: {
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    scaledSize: new window.google.maps.Size(35, 35)
                },
                title: 'Destination'
            });
        }
    };

    // Modify useEffect to handle potential initialization failures
    useEffect(() => {
        let isMounted = true;

        const safeInit = async () => {
            try {
                if (isMounted) {
                    await initializeMap();
                }
            } catch (error) {
                console.error('Initialization failed:', error);
            }
        };

        safeInit();

        return () => {
            isMounted = false;
            isMapInitialized.current = false;
            isScriptLoaded.current = false;
        };
    }, []); // Empty dependency array ensures this runs only once

    const initializeAutocomplete = () => {
        if (!sourceInputRef.current || !destinationInputRef.current) return;

        sourceAutocomplete.current = new window.google.maps.places.Autocomplete(sourceInputRef.current);
        destinationAutocomplete.current = new window.google.maps.places.Autocomplete(destinationInputRef.current);

        sourceAutocomplete.current?.addListener('place_changed', () => {
            const place = sourceAutocomplete.current.getPlace();
            if (place?.geometry) {
                setSourceAddress(place.formatted_address);
                setSourceCoords({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                });
            }
        });

        destinationAutocomplete.current?.addListener('place_changed', () => {
            const place = destinationAutocomplete.current.getPlace();
            if (place?.geometry) {
                setDestinationAddress(place.formatted_address);
                setDestinationCoords({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                });
            }
        });
    };


    const handleGetRoute = async () => {

        try {
            if (!sourceCoords || !destinationCoords) {
                throw new Error("Please select valid source and destination addresses");
            }

            if (!window.google?.maps) {
                throw new Error("Google Maps not initialized");
            }

            const directionsService = new window.google.maps.DirectionsService();

            const result = await new Promise((resolve, reject) => {
                directionsService.route({
                    origin: sourceCoords,
                    destination: destinationCoords,
                    travelMode: window.google.maps.TravelMode.DRIVING
                }, (response, status) => {
                    if (status === 'OK') resolve(response);
                    else reject(new Error(`Directions request failed: ${status}`));
                });
            });

            if (directionsRenderer && result.routes?.[0]) {
                directionsRenderer.setDirections(result);

                const path = result.routes[0].overview_path;
                const points = path.map(point => ({
                    lat: point.lat(),
                    lng: point.lng()
                }));

                setRoutePoints(points);

            }
        } catch (error) {
            console.error("Error calculating route:", error);
            alert(error.message);
        }
    };

    // Helper function to format time in seconds to readable format
    const formatTime = (seconds) => {
        if (!seconds || seconds === 0) return "Calculating...";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours} hr ${minutes} min`;
        }
        return `${minutes} min`;
    };

    useEffect(() => {
        if (googleMapRef.current) {
            updateEndpointMarkers();
        }
    }, [sourceCoords, destinationCoords]);

    const timeSlots = [
        { value: "00-02", label: "00-02" },
        { value: "02-04", label: "02-04" },
        { value: "04-06", label: "04-06" },
        { value: "06-08", label: "06-08" },
        { value: "08-10", label: "08-10" },
        { value: "10-12", label: "10-12" },
        { value: "12-14", label: "12-14" },
        { value: "14-16", label: "14-16" },
        { value: "16-18", label: "16-18" },
        { value: "18-20", label: "18-20" },
        { value: "20-22", label: "20-22" },
        { value: "22-24", label: "22-24" },
    ];

    // --- MAIN PREDICTION FUNCTION (UPDATED SCORING LOGIC) ---
    const handlePrediction = async () => {
        // 1. Check for all inputs
        if (!sourceCoords || !destinationCoords || !timeSlot || !date) {
            alert("Please select source, destination, time, and date.");
            return;
        }

        if (!sourceAddress || !destinationAddress) {
            alert("Please select valid addresses.");
            return;
        }

        // Block past date/time predictions
        const [slotStart] = timeSlot.split('-').map(Number);
        const selectedDateTime = new Date(date);
        selectedDateTime.setHours(slotStart, 0, 0, 0);
        if (selectedDateTime < new Date()) {
            alert("Cannot predict traffic for past dates/times. Please select a future date and time.");
            return;
        }

        try {
            // --- PART A: PREPARE DATA ---
            const sourcePart = sourceAddress.split(' ')[0].replace(',', '').trim();
            const destPart = destinationAddress.split(' ')[0].replace(',', '').trim();
            const pathId = `${sourcePart}-${destPart}`;

            // --- PART B: GET GOOGLE ROUTE FOR MAP RENDERING (JS SDK) ---
            // Still needed for directionsRenderer.setDirections() to draw the route on the map
            const directionsService = new window.google.maps.DirectionsService();
            const googleResult = await new Promise((resolve, reject) => {
                directionsService.route({
                    origin: sourceCoords,
                    destination: destinationCoords,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                }, (response, status) => {
                    if (status === 'OK') resolve(response);
                    else reject(new Error(`Directions request failed: ${status}`));
                });
            });

            if (directionsRenderer && googleResult.routes?.[0]) {
                directionsRenderer.setDirections(googleResult);
            }

            // Extract route points for backend
            const path = googleResult.routes[0].overview_path;
            const points = path.map(point => ({ lat: point.lat(), lng: point.lng() }));

            // --- PART C: CALL BACKEND (scores + Google REST API traffic) ---
            const dataToSend = {
                timeSlot: timeSlot,
                date: date,
                pathId: pathId,
                routePoints: points,
                sourceCoords: sourceCoords,
                destinationCoords: destinationCoords
            };

            const response = await apiRequest.post(
                '/path-info/predictTraffic',
                dataToSend
            );

            // --- PART D: USE BACKEND'S FINAL SCORE ---
            // Backend now handles: Google REST API call, 30/70 weighting, normalization
            const finalScore = response.data.finalScore;
            const durationNormal = response.data.durationNormal;      // Google's average baseline
            const durationTraffic = response.data.durationTraffic;    // Google's actual predicted time (matches Google Maps)

            // Use durationTraffic as base — this is what Google Maps shows the user
            const actualBase = durationTraffic || durationNormal;
            setBaseDuration(actualBase);

            // Display the results and update counts
            setMessage(true);
            setScore(finalScore);
            setConstructions(response.data.constructionCount);
            setDiversions(response.data.diversionCount);
            setEvents(response.data.eventCount);
            setHotspots(response.data.hotspotCount);
            setPotholes(response.data.potholeCount || 0);
            setComplaints(response.data.complaintCount || 0);
            setFestival(response.data.festival || null);
            setWeather(response.data.weather || null);
            setMetroStations(response.data.metroStationCount || 0);

            // Calculate estimated time using local variable (not stale state)
            const estimatedTimeInSeconds = actualBase + (actualBase * finalScore / 100);
            setEstimatedTime(estimatedTimeInSeconds);

            console.log("------------------------------------------------");
            console.log(`\ud83c\udfc1 Backend Final Score: ${finalScore.toFixed(2)}%`);
            console.log(`\ud83d\ude97 Google Score (REST): ${response.data.googleScore.toFixed(2)}%`);
            console.log(`\ud83d\udcca Backend Obstacle:    ${response.data.yourObstacleScore.toFixed(2)}`);
            console.log(`\ud83d\udcdc Backend History:     ${response.data.yourHistoryScore.toFixed(2)}`);
            console.log(`\u23f1\ufe0f  Base Duration:      ${(actualBase / 60).toFixed(1)} min`);
            console.log(`\u23f3 Estimated Time:     ${(estimatedTimeInSeconds / 60).toFixed(1)} min`);
            console.log("------------------------------------------------");

            // --- PART E: FETCH SMART TIME SUGGESTIONS ---
            setSuggestions([]);
            setExpandedSlot(null);
            setLoadingSuggestions(true);
            try {
                const sugRes = await apiRequest.post('/path-info/suggestions', {
                    timeSlot: timeSlot,
                    date: date,
                    pathId: pathId,
                    routePoints: points,
                    sourceCoords: sourceCoords,
                    destinationCoords: destinationCoords,
                    selectedScore: finalScore,
                });
                setSuggestions(sugRes.data.suggestions || []);
            } catch (sugErr) {
                console.error("Time suggestions error:", sugErr);
            } finally {
                setLoadingSuggestions(false);
            }

        } catch (error) {
            console.error("Error fetching prediction:", error);
            alert(`An error occurred: ${error.message}`);
        }
    };

    return (
        <div className="traffic-prediction-container">
            <h1 className="header">Traffic Prediction</h1>

            <div className="address-inputs">
                <div>
                    <input
                        ref={sourceInputRef}
                        className="styled-input"
                        type="text"
                        value={sourceAddress}
                        onChange={(e) => {
                            setSourceAddress(e.target.value);
                        }}
                        placeholder="Enter source address"
                    />
                </div>
                <div>
                    <input
                        ref={destinationInputRef}
                        className="styled-input"
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => {
                            setDestinationAddress(e.target.value);
                        }}
                        placeholder="Enter destination address"
                    />
                </div>
                <button className="btn-top" id="get" onClick={handleGetRoute}>
                    Get Route
                </button>
            </div>

            <div className='map'>
                <div id="googleMap" style={{ height: '460px', width: '100%', border: '2.5px solid black' }}></div>
            </div>

            <div className="input-group">
                <label className="input-label">Select Time Slot</label>
                <Select
                    options={timeSlots}
                    onChange={(selected) => setTimeSlot(selected.value)}
                    className="dropdown"
                />
            </div>


            <div className="input-group">
                <label className="input-label">Select Future Date</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="date-picker"
                />
            </div>

            <button onClick={handlePrediction} className="predict-button">
                Predict
            </button>

            {message && (
                <div className="message-predict-box">
                    <div className="message-predict">
                        <p style={{
                            color: score <= 15
                                ? 'green'
                                : score <= 29
                                    ? 'lightgreen'
                                    : score <= 59
                                        ? 'orange'
                                        : score <= 79
                                            ? 'red'
                                            : 'darkred',
                            fontSize: '20px',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                            margin: '20px 0',
                        }}>
                            {console.log(score)}
                            {/* Traffic Message */}
                            <span>
                                {score <= 15 && "Traffic on the selected route seems will be VERY LOW "}
                                {score >= 16 && score <= 29 && "Traffic on the selected route will be LOW "}
                                {score >= 30 && score <= 59 && "Traffic on the selected route will be MEDIUM "}
                                {score >= 60 && score <= 79 && "Traffic on the selected route seems will be HIGH "}
                                {score >= 80 && "Traffic on the selected route seems will be VERY HIGH "}
                            </span>

                            <span style={{
                                fontSize: '16px',
                                color: '#555',
                                animation: 'fadeIn 1s',
                            }}>
                                Estimated Travel Time: {formatTime(estimatedTime)}
                            </span>

                            <span style={{
                                fontSize: '14px',
                                color: '#777',
                            }}>
                                (Base time: {formatTime(baseDuration)} | Traffic Score: {score.toFixed(2)}%)
                            </span>
                        </p>

                        <h3>Factors affecting traffic:</h3>
                        <div className="factors-list">
                            {constructions > 0 && (
                                <div className="factor-item factor-negative">
                                    <span>{constructions} active construction{constructions > 1 ? 's' : ''} found on this route, causing slowdowns</span>
                                </div>
                            )}
                            {diversions > 0 && (
                                <div className="factor-item factor-negative">
                                    <span>{diversions} road diversion{diversions > 1 ? 's' : ''} in effect, rerouting traffic nearby</span>
                                </div>
                            )}
                            {event > 0 && (
                                <div className="factor-item factor-negative">
                                    <span>{event} event{event > 1 ? 's' : ''} happening near this route, expect more crowd</span>
                                </div>
                            )}
                            {hotspots > 0 && (
                                <div className="factor-item factor-warn">
                                    <span>Route passes through {hotspots} known congestion hotspot{hotspots > 1 ? 's' : ''}</span>
                                </div>
                            )}
                            {metroStations > 0 && (
                                <div className="factor-item factor-warn">
                                    <span>{metroStations} metro station{metroStations > 1 ? 's' : ''} nearby — auto/cab crowding expected</span>
                                </div>
                            )}
                            {potholes > 0 && (
                                <div className="factor-item factor-warn">
                                    <span>{potholes} reported pothole{potholes > 1 ? 's' : ''} on route, may slow down traffic</span>
                                </div>
                            )}
                            {complaints > 0 && (
                                <div className="factor-item factor-warn">
                                    <span>{complaints} unresolved traffic complaint{complaints > 1 ? 's' : ''} reported in this area</span>
                                </div>
                            )}
                            {weather && weather.condition !== 'Clear' && (
                                <div className="factor-item factor-warn">
                                    <span>Weather: {weather.description} ({weather.temp}°C) — may affect driving conditions</span>
                                </div>
                            )}
                            {weather && weather.condition === 'Clear' && (
                                <div className="factor-item factor-positive">
                                    <span>Clear weather ({weather.temp}°C) — good driving conditions</span>
                                </div>
                            )}
                            {festival && (
                                <div className="factor-item factor-negative">
                                    <span>{festival.festivalName} — holiday traffic expected across the city</span>
                                </div>
                            )}
                            {constructions === 0 && diversions === 0 && event === 0 && hotspots === 0 && potholes === 0 && complaints === 0 && !festival && metroStations === 0 && (
                                <div className="factor-item factor-positive">
                                    <span>No obstructions detected on this route</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Time Suggestions */}
            {message && (
                <div className="suggestions-section">
                    <h3 className="suggestions-title">Better Time Slots</h3>
                    <p className="suggestions-subtitle">Nearby time slots with lower traffic than your selection ({score.toFixed(1)}%)</p>

                    {loadingSuggestions && <p className="loading">Analyzing nearby time slots...</p>}

                    {!loadingSuggestions && suggestions.length === 0 && (
                        <p className="no-suggestions">Your selected time slot already has the best score among nearby slots.</p>
                    )}

                    {!loadingSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-grid">
                            {suggestions.map((s) => (
                                <div key={s.timeSlot}>
                                    <div
                                        className={`suggestion-card suggestion-${s.level}${expandedSlot === s.timeSlot ? ' suggestion-expanded' : ''}`}
                                        onClick={() => setExpandedSlot(expandedSlot === s.timeSlot ? null : s.timeSlot)}
                                    >
                                        {s.isBest && <span className="suggestion-badge badge-best">Best</span>}

                                        <div className="suggestion-time">{s.timeSlot}</div>
                                        <div className="suggestion-score">{s.score.toFixed(1)}%</div>
                                        <div className="suggestion-label">
                                            {s.level === 'very-low' && 'Very Low'}
                                            {s.level === 'low' && 'Low'}
                                            {s.level === 'medium' && 'Medium'}
                                            {s.level === 'high' && 'High'}
                                            {s.level === 'very-high' && 'Very High'}
                                        </div>
                                        <div className="suggestion-hint">Click for details</div>
                                    </div>

                                    {expandedSlot === s.timeSlot && s.breakdown && (() => {
                                        const b = s.breakdown;
                                        const timePeriod = (() => {
                                            const h = parseInt(s.timeSlot.split('-')[0]);
                                            if (h >= 0 && h < 6) return 'Night';
                                            if (h >= 6 && h < 8) return 'Early Morning';
                                            if (h >= 8 && h < 11) return 'Morning Rush';
                                            if (h >= 11 && h < 16) return 'Midday';
                                            if (h >= 16 && h < 20) return 'Evening Rush';
                                            return 'Late Evening';
                                        })();
                                        const selectedHour = parseInt(timeSlot.split('-')[0]);
                                        const selectedPeriod = (() => {
                                            if (selectedHour >= 0 && selectedHour < 6) return 'Night';
                                            if (selectedHour >= 6 && selectedHour < 8) return 'Early Morning';
                                            if (selectedHour >= 8 && selectedHour < 11) return 'Morning Rush';
                                            if (selectedHour >= 11 && selectedHour < 16) return 'Midday';
                                            if (selectedHour >= 16 && selectedHour < 20) return 'Evening Rush';
                                            return 'Late Evening';
                                        })();
                                        const scoreDiff = (score - s.score).toFixed(1);
                                        return (
                                            <div className="suggestion-breakdown">
                                                <h4>Why {s.timeSlot} is better (−{scoreDiff}% less traffic)</h4>

                                                {/* Reason: time-of-day difference */}
                                                {timePeriod !== selectedPeriod && (
                                                    <div className="factor-item factor-positive">
                                                        <span>This slot falls in <b>{timePeriod}</b> instead of <b>{selectedPeriod}</b>, so traffic impact is lower</span>
                                                    </div>
                                                )}
                                                {timePeriod === selectedPeriod && (
                                                    <div className="factor-item factor-warn">
                                                        <span>Same traffic period ({timePeriod}), but Google data shows slightly less congestion</span>
                                                    </div>
                                                )}

                                                {/* Reason: Google traffic difference */}
                                                {b.googleScore < (score * 0.3 / 0.7) && (
                                                    <div className="factor-item factor-positive">
                                                        <span>Google Maps predicts less real-time congestion at this time ({b.googleScore.toFixed(1)}%)</span>
                                                    </div>
                                                )}

                                                {b.durationTraffic > 0 && (
                                                    <div className="factor-item factor-positive">
                                                        <span>Estimated travel time: {formatTime(b.durationTraffic)}</span>
                                                    </div>
                                                )}

                                                {/* Show active factors on this slot */}
                                                <h4 style={{ marginTop: '10px' }}>Factors on this slot:</h4>
                                                {b.constructionCount > 0 && (
                                                    <div className="factor-item factor-negative">
                                                        <span>{b.constructionCount} active construction{b.constructionCount > 1 ? 's' : ''} on route</span>
                                                    </div>
                                                )}
                                                {b.diversionCount > 0 && (
                                                    <div className="factor-item factor-negative">
                                                        <span>{b.diversionCount} road diversion{b.diversionCount > 1 ? 's' : ''} in effect</span>
                                                    </div>
                                                )}
                                                {b.eventCount > 0 && (
                                                    <div className="factor-item factor-negative">
                                                        <span>{b.eventCount} event{b.eventCount > 1 ? 's' : ''} happening nearby</span>
                                                    </div>
                                                )}
                                                {b.hotspotCount > 0 && (
                                                    <div className="factor-item factor-warn">
                                                        <span>Passes through {b.hotspotCount} congestion hotspot{b.hotspotCount > 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                                {b.metroStationCount > 0 && (
                                                    <div className="factor-item factor-warn">
                                                        <span>{b.metroStationCount} metro station{b.metroStationCount > 1 ? 's' : ''} nearby</span>
                                                    </div>
                                                )}
                                                {b.potholeCount > 0 && (
                                                    <div className="factor-item factor-warn">
                                                        <span>{b.potholeCount} reported pothole{b.potholeCount > 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                                {b.complaintCount > 0 && (
                                                    <div className="factor-item factor-warn">
                                                        <span>{b.complaintCount} unresolved complaint{b.complaintCount > 1 ? 's' : ''}</span>
                                                    </div>
                                                )}
                                                {b.weatherCondition && b.weatherCondition !== 'Clear' && b.weatherCondition !== 'N/A' && (
                                                    <div className="factor-item factor-warn">
                                                        <span>{b.weatherDescription || b.weatherCondition} ({b.weatherTemp}°C)</span>
                                                    </div>
                                                )}
                                                {b.weatherCondition === 'Clear' && (
                                                    <div className="factor-item factor-positive">
                                                        <span>Clear weather ({b.weatherTemp}°C) — good driving conditions</span>
                                                    </div>
                                                )}
                                                {b.festival && b.festival !== 'None' && (
                                                    <div className="factor-item factor-negative">
                                                        <span>{b.festival} — holiday traffic expected</span>
                                                    </div>
                                                )}
                                                {b.constructionCount === 0 && b.diversionCount === 0 && b.eventCount === 0 && b.hotspotCount === 0 && b.potholeCount === 0 && b.complaintCount === 0 && b.metroStationCount === 0 && (b.festival === 'None' || !b.festival) && (
                                                    <div className="factor-item factor-positive">
                                                        <span>No obstructions detected on this route</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default TrafficPrediction;