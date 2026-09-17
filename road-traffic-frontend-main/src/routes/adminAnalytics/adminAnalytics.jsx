import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import apiRequest from '../../lib/apiRequest';
import './adminAnalytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AdminAnalytics = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('trends'); // 'trends' or 'routeDetails'

  // State management - Common
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  // Traffic Trends Tab State
  const [trendData, setTrendData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [rootCause, setRootCause] = useState(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [loadingRootCause, setLoadingRootCause] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Route Details Tab State
  const [routeDetailsData, setRouteDetailsData] = useState(null);
  const [routeDetailsDate, setRouteDetailsDate] = useState(() => {
    // Default to yesterday for complete data (today may not have all time slots yet)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  const [selectedRouteSlot, setSelectedRouteSlot] = useState(null);
  const [routeBreakdown, setRouteBreakdown] = useState(null);
  const [loadingRouteDetails, setLoadingRouteDetails] = useState(false);
  const [loadingRouteBreakdown, setLoadingRouteBreakdown] = useState(false);
  const [routeRecommendations, setRouteRecommendations] = useState(null);
  const [showRouteRecommendations, setShowRouteRecommendations] = useState(false);
  const [loadingRouteRecommendations, setLoadingRouteRecommendations] = useState(false);

  // Data Science Insights Tab State
  const [insightsData, setInsightsData] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsDays, setInsightsDays] = useState(30);
  const [selectedFactorRoute, setSelectedFactorRoute] = useState(null);

  // Fetch available routes on mount
  useEffect(() => {
    fetchRoutes();
  }, []);

  // Fetch insights when tab changes or days change
  useEffect(() => {
    if (activeTab === 'insights') {
      fetchInsights();
    }
  }, [activeTab, insightsDays]);

  // Fetch trend data when route or days change
  useEffect(() => {
    if (selectedRoute) {
      fetchTrendData();
      // Reset drill-down when route changes
      setSelectedPoint(null);
      setRootCause(null);
      setShowRecommendations(false);
      setRecommendations(null);
    }
  }, [selectedRoute, days]);

  const fetchRoutes = async () => {
    try {
      const res = await apiRequest.get('/analytics/routes');
      setRoutes(res.data.routes || []);
      if (res.data.routes?.length > 0) {
        setSelectedRoute(res.data.routes[0]);
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    }
  };

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const param = insightsDays === 'all' ? 'all' : insightsDays;
      const res = await apiRequest.get(`/analytics/insights?days=${param}`);
      setInsightsData(res.data);
      // Auto-select first route for factor chart
      if (res.data.factorContribution) {
        const routeKeys = Object.keys(res.data.factorContribution);
        if (routeKeys.length > 0 && !selectedFactorRoute) {
          setSelectedFactorRoute(routeKeys[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
    }
    setLoadingInsights(false);
  };

  const fetchTrendData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest.get(`/analytics/trends?route=${selectedRoute}&days=${days}`);
      setTrendData(res.data);
    } catch (err) {
      console.error('Error fetching trends:', err);
    }
    setLoading(false);
  };

  const fetchRootCause = async (date, timeSlot) => {
    setLoadingRootCause(true);
    try {
      const res = await apiRequest.get(`/analytics/breakdown?route=${selectedRoute}&date=${date}&timeSlot=${timeSlot}`);
      setRootCause(res.data);
    } catch (err) {
      console.error('Error fetching root cause:', err);
    }
    setLoadingRootCause(false);
  };

  // New: Fetch all 12 time slots for a date
  const fetchTimeSlots = async (date) => {
    setLoadingTimeSlots(true);
    try {
      const res = await apiRequest.get(`/analytics/timeslots?route=${selectedRoute}&date=${date}`);
      setTimeSlots(res.data.timeSlots || []);
    } catch (err) {
      console.error('Error fetching time slots:', err);
      setTimeSlots([]);
    }
    setLoadingTimeSlots(false);
  };

  const fetchRecommendations = async () => {
    if (!selectedPoint) return;
    setLoadingRecommendations(true);
    try {
      const res = await apiRequest.get(`/analytics/recommendations?route=${selectedRoute}&date=${selectedPoint.date}&timeSlot=${selectedPoint.timeSlot}`);
      setRecommendations(res.data.recommendations || []);
      setShowRecommendations(true);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
    setLoadingRecommendations(false);
  };

  // Route Details Tab - Fetch time slots for selected date
  const fetchRouteDetails = async () => {
    setLoadingRouteDetails(true);
    try {
      const res = await apiRequest.get(`/analytics/timeslots?route=${selectedRoute}&date=${routeDetailsDate}`);
      setRouteDetailsData({
        date: routeDetailsDate,
        timeSlots: res.data.timeSlots || []
      });
    } catch (err) {
      console.error('Error fetching route details:', err);
      setRouteDetailsData(null);
    }
    setLoadingRouteDetails(false);
  };

  // Route Details - Handle bar click
  const handleRouteBarClick = (event, elements) => {
    if (elements.length > 0 && routeDetailsData?.timeSlots) {
      const index = elements[0].index;
      const slotData = routeDetailsData.timeSlots[index];

      if (slotData && slotData.hasData) {
        setSelectedRouteSlot(slotData);
        setShowRouteRecommendations(false);
        setRouteRecommendations(null);
        fetchRouteBreakdown(slotData.timeSlot);
      }
    }
  };

  // Route Details - Fetch breakdown for clicked slot
  const fetchRouteBreakdown = async (timeSlot) => {
    setLoadingRouteBreakdown(true);
    try {
      const res = await apiRequest.get(`/analytics/breakdown?route=${selectedRoute}&date=${routeDetailsDate}&timeSlot=${timeSlot}`);
      setRouteBreakdown(res.data);
    } catch (err) {
      console.error('Error fetching route breakdown:', err);
    }
    setLoadingRouteBreakdown(false);
  };

  // Route Details - Fetch recommendations
  const fetchRouteRecommendations = async () => {
    if (!selectedRouteSlot) return;
    setLoadingRouteRecommendations(true);
    try {
      const res = await apiRequest.get(`/analytics/recommendations?route=${selectedRoute}&date=${routeDetailsDate}&timeSlot=${selectedRouteSlot.timeSlot}`);
      setRouteRecommendations(res.data.recommendations || []);
      setShowRouteRecommendations(true);
    } catch (err) {
      console.error('Error fetching route recommendations:', err);
    }
    setLoadingRouteRecommendations(false);
  };

  // Fetch route details when tab changes, route changes, or date changes
  useEffect(() => {
    if (activeTab === 'routeDetails' && selectedRoute) {
      fetchRouteDetails();
      setSelectedRouteSlot(null);
      setRouteBreakdown(null);
      setShowRouteRecommendations(false);
    }
  }, [activeTab, selectedRoute, routeDetailsDate]);

  // Handle click on graph data point - Now fetches time slots
  const handleGraphClick = (event, elements) => {
    if (elements.length > 0 && trendData?.data) {
      const index = elements[0].index;
      const dayData = trendData.data[index];

      if (dayData) {
        // Store selected date info
        setSelectedDate({
          date: dayData.date,
          avgScore: dayData.avgScore,
          peakScore: dayData.peakScore,
          level: dayData.level,
          peakSlot: dayData.peakSlot
        });

        // Reset downstream state
        setSelectedTimeSlot(null);
        setSelectedPoint(null);
        setRootCause(null);
        setShowRecommendations(false);
        setRecommendations(null);

        // Fetch all time slots for this date
        fetchTimeSlots(dayData.date);
      }
    }
  };

  // Handle click on time slot
  const handleTimeSlotClick = (slot) => {
    setSelectedTimeSlot(slot);

    const pointData = {
      date: selectedDate.date,
      timeSlot: slot.timeSlot,
      score: slot.score,
      level: slot.level,
      hasBreakdown: slot.hasBreakdown
    };

    setSelectedPoint(pointData);
    setShowRecommendations(false);
    setRecommendations(null);

    // Fetch stored breakdown for this specific slot
    fetchRootCause(selectedDate.date, slot.timeSlot);
  };

  // Chart configuration
  const chartData = trendData?.data ? {
    labels: trendData.data.map(d => {
      const parts = d.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    }),
    datasets: [
      {
        label: 'Traffic Score',
        data: trendData.data.map(d => d.avgScore),
        borderColor: '#fabc3c',
        backgroundColor: 'rgba(250, 188, 60, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 8,
        pointHoverRadius: 12,
        pointBackgroundColor: trendData.data.map(d => {
          if (d.avgScore >= 70) return '#ef4444';
          if (d.avgScore >= 50) return '#f59e0b';
          return '#22c55e';
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleGraphClick,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        callbacks: {
          title: (items) => {
            if (items.length && trendData?.data) {
              const idx = items[0].dataIndex;
              return `Date: ${trendData.data[idx].date}`;
            }
            return '';
          },
          label: (item) => {
            if (trendData?.data) {
              const data = trendData.data[item.dataIndex];
              return [
                `Avg Score: ${data.avgScore}`,
                `Peak Score: ${data.peakScore}`,
                `Level: ${data.level}`,
                `Peak Time: ${data.peakSlot}`,
                '',
                'Click to see root cause'
              ];
            }
            return '';
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Traffic Score',
          font: { weight: 'bold' },
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { weight: 'bold' },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      intersect: true,
    },
  };

  const getLevelColor = (level) => {
    const l = level?.toLowerCase();
    if (l === 'low' || l === 'very low') return '#22c55e';
    if (l === 'moderate' || l === 'medium') return '#f59e0b';
    if (l === 'high') return '#ef4444';
    if (l === 'severe' || l === 'very high') return '#dc2626';
    return '#6b7280';
  };

  const getPriorityColor = (priority) => {
    const p = priority?.toUpperCase();
    if (p === 'HIGH') return '#ef4444';
    if (p === 'MEDIUM') return '#f59e0b';
    if (p === 'LOW') return '#22c55e';
    return '#6b7280';
  };

  // Route Details Bar Chart Data
  const routeBarChartData = routeDetailsData?.timeSlots ? {
    labels: routeDetailsData.timeSlots.map(s => s.timeSlot),
    datasets: [{
      label: 'Traffic Score',
      data: routeDetailsData.timeSlots.map(s => s.hasData ? s.score : 0),
      backgroundColor: routeDetailsData.timeSlots.map(s => {
        if (!s.hasData) return '#e5e7eb';
        if (s.score >= 70) return '#ef4444';
        if (s.score >= 50) return '#f59e0b';
        return '#22c55e';
      }),
      borderColor: routeDetailsData.timeSlots.map(s =>
        selectedRouteSlot?.timeSlot === s.timeSlot ? '#fabc3c' : 'transparent'
      ),
      borderWidth: routeDetailsData.timeSlots.map(s =>
        selectedRouteSlot?.timeSlot === s.timeSlot ? 3 : 0
      ),
      borderRadius: 6,
    }]
  } : null;

  const routeBarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleRouteBarClick,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Time: ${items[0].label}`,
          label: (item) => {
            const slot = routeDetailsData?.timeSlots[item.dataIndex];
            if (!slot?.hasData) return 'No data collected';
            return [
              `Score: ${slot.score}`,
              `Level: ${slot.level}`,
              '',
              'Click to see breakdown'
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Traffic Score', font: { weight: 'bold' } }
      },
      x: {
        title: { display: true, text: 'Time Slot (2-hour intervals)', font: { weight: 'bold' } }
      }
    }
  };

  return (
    <div className="analytics-container">
      {/* Header */}
      <div className="analytics-header">
        <h1>PMC Traffic Analytics Dashboard</h1>
        <p>Interactive traffic analysis with drill-down insights</p>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        <button
          className={`tab ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Traffic Trends
        </button>
        <button
          className={`tab ${activeTab === 'routeDetails' ? 'active' : ''}`}
          onClick={() => setActiveTab('routeDetails')}
        >
          Route Details
        </button>
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights & Analysis
        </button>
      </div>

      {/* Controls */}
      <div className="analytics-controls">
        <div className="control-group">
          <label>Select Route</label>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            {routes.map(route => (
              <option key={route} value={route}>{route}</option>
            ))}
          </select>
        </div>

        {activeTab === 'trends' && (
          <div className="control-group">
            <label>Time Period</label>
            <div className="period-buttons">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  className={`period-btn ${days === d ? 'active' : ''}`}
                  onClick={() => setDays(d)}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========== TRAFFIC TRENDS TAB ========== */}
      {activeTab === 'trends' && (
        <div className="analytics-content">
          {/* Trend Graph Section */}
          <div className="graph-section">
            <div className="section-header">
              <h2>Traffic Trend Graph - {selectedRoute}</h2>
              <span className="hint">Click on any data point to see all time slots for that day</span>
            </div>

            {loading ? (
              <div className="loading">Loading traffic data...</div>
            ) : chartData ? (
              <div className="chart-container">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="no-data">Select a route to view traffic trends</div>
            )}
          </div>

          {/* Time Slots Section - Shows when a date is clicked */}
          {selectedDate && (
            <div className="time-slots-section">
              <div className="section-header">
                <h2>Time Slots for {selectedDate.date}</h2>
                <span className="hint">Click on a time slot to view its root cause breakdown</span>
              </div>

              <div className="selected-date-info">
                <div className="info-item">
                  <span className="label">Date:</span>
                  <span className="value">{selectedDate.date}</span>
                </div>
                <div className="info-item">
                  <span className="label">Daily Avg Score:</span>
                  <span className="value">{selectedDate.avgScore}</span>
                </div>
                <div className="info-item">
                  <span className="label">Peak Score:</span>
                  <span
                    className="value score-badge"
                    style={{ backgroundColor: getLevelColor(selectedDate.level) }}
                  >
                    {selectedDate.peakScore} ({selectedDate.level})
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Peak Time:</span>
                  <span className="value">{selectedDate.peakSlot}</span>
                </div>
              </div>

              {loadingTimeSlots ? (
                <div className="loading">Loading time slots...</div>
              ) : timeSlots.length > 0 ? (
                <div className="time-slots-grid">
                  {timeSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className={`time-slot-card ${selectedTimeSlot?.timeSlot === slot.timeSlot ? 'selected' : ''} ${!slot.hasData ? 'no-data' : ''}`}
                      onClick={() => slot.hasData && handleTimeSlotClick(slot)}
                      style={{
                        cursor: slot.hasData ? 'pointer' : 'not-allowed',
                        borderColor: selectedTimeSlot?.timeSlot === slot.timeSlot ? '#fabc3c' : 'transparent'
                      }}
                    >
                      <div className="slot-time">{slot.timeSlot}</div>
                      {slot.hasData ? (
                        <>
                          <div
                            className="slot-score"
                            style={{ color: getLevelColor(slot.level) }}
                          >
                            {slot.score}
                          </div>
                          <div className="slot-level" style={{ color: getLevelColor(slot.level) }}>
                            {slot.level}
                          </div>
                          {slot.hasBreakdown && (
                            <div className="slot-breakdown-badge">Breakdown Available</div>
                          )}
                        </>
                      ) : (
                        <div className="slot-no-data">No Data</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No time slot data available for this date</div>
              )}
            </div>
          )}

          {/* Root Cause Section - Shows when a time slot is clicked */}
          {selectedPoint && (
            <div className="root-cause-section">
              <div className="section-header">
                <h2>Root Cause Analysis - {selectedPoint.timeSlot}</h2>
              </div>

              <div className="selected-point-info">
                <div className="info-item">
                  <span className="label">Date:</span>
                  <span className="value">{selectedPoint.date}</span>
                </div>
                <div className="info-item">
                  <span className="label">Time Slot:</span>
                  <span className="value">{selectedPoint.timeSlot}</span>
                </div>
                <div className="info-item">
                  <span className="label">Score:</span>
                  <span
                    className="value score-badge"
                    style={{ backgroundColor: getLevelColor(selectedPoint.level) }}
                  >
                    {selectedPoint.score} ({selectedPoint.level})
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Breakdown Status:</span>
                  <span className="value">{selectedPoint.hasBreakdown ? 'Stored' : 'Generated'}</span>
                </div>
              </div>

              {loadingRootCause ? (
                <div className="loading">Fetching stored breakdown...</div>
              ) : rootCause ? (
                <div className="root-cause-content">
                  <div className="factors-breakdown">
                    <h3>Contributing Factors</h3>
                    <div className="factors-bars">
                      {rootCause.factors?.map((factor, idx) => (
                        <div key={idx} className="factor-bar-item">
                          <div className="factor-info">
                            <span className="factor-name">{factor.name}</span>
                            <span className="factor-score">{factor.score} pts</span>
                          </div>
                          <div className="factor-bar-bg">
                            <div
                              className="factor-bar-fill"
                              style={{
                                width: `${Math.min((factor.score / 30) * 100, 100)}%`,
                                backgroundColor: factor.score > 20 ? '#ef4444' :
                                  factor.score > 10 ? '#f59e0b' : '#22c55e'
                              }}
                            ></div>
                          </div>
                          {factor.details && (
                            <div className="factor-details">{factor.details}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="summary-box">
                    <p>{rootCause.summary}</p>
                  </div>

                  <button
                    className="recommendations-btn"
                    onClick={fetchRecommendations}
                    disabled={loadingRecommendations}
                  >
                    {loadingRecommendations ? 'Loading...' : 'Get Recommendations'}
                  </button>
                </div>
              ) : (
                <div className="no-data">Unable to fetch root cause data</div>
              )}
            </div>
          )}

          {/* Recommendations Section - Shows when button is clicked */}
          {showRecommendations && recommendations && (
            <div className="recommendations-section">
              <div className="section-header">
                <h2>Recommendations</h2>
              </div>

              <div className="recommendations-list">
                {recommendations.length > 0 ? (
                  recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="recommendation-card"
                      style={{ borderLeftColor: getPriorityColor(rec.priority) }}
                    >
                      <div className="rec-header">
                        <span
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(rec.priority) }}
                        >
                          {rec.priority?.toUpperCase()}
                        </span>
                        <span className="rec-category">{rec.category}</span>
                      </div>
                      <h4 className="rec-title">{rec.title}</h4>
                      <p className="rec-description">{rec.description}</p>
                      {rec.action && (
                        <div className="rec-action">
                          <strong>Action:</strong> {rec.action}
                        </div>
                      )}
                      {rec.impact && (
                        <div className="rec-impact">
                          <strong>Expected Impact:</strong> {rec.impact}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-data">No specific recommendations for this time period</div>
                )}
              </div>
            </div>
          )}

          {/* Instructions when nothing selected */}
          {!selectedDate && chartData && (
            <div className="instructions-box">
              <h3>How to use this dashboard</h3>
              <ol>
                <li>Select a route from the dropdown above</li>
                <li>Click on any data point in the graph to see all 12 time slots for that day</li>
                <li>Click on a specific time slot to view its stored root cause breakdown</li>
                <li>See exactly why traffic was high/low during that specific 2-hour window</li>
                <li>Click "Get Recommendations" to see actionable suggestions based on the breakdown</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ========== ROUTE DETAILS TAB ========== */}
      {activeTab === 'routeDetails' && (
        <div className="analytics-content">
          {/* Route Time Slots Bar Chart */}
          <div className="graph-section">
            <div className="section-header">
              <h2>Traffic by Time - {selectedRoute}</h2>
              <div className="date-selector">
                <label htmlFor="routeDate">Date: </label>
                <input
                  type="date"
                  id="routeDate"
                  value={routeDetailsDate}
                  onChange={(e) => setRouteDetailsDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  min="2025-12-15"
                  className="date-input"
                />
              </div>
              <span className="hint">Click on any bar to see breakdown for that time slot</span>
            </div>

            {loadingRouteDetails ? (
              <div className="loading">Loading route details...</div>
            ) : routeBarChartData ? (
              <div className="chart-container">
                <Bar data={routeBarChartData} options={routeBarChartOptions} />
              </div>
            ) : (
              <div className="no-data">No data available for this route on {routeDetailsDate}</div>
            )}
          </div>

          {/* Breakdown Section - Shows when a bar is clicked */}
          {selectedRouteSlot && (
            <div className="root-cause-section">
              <div className="section-header">
                <h2>Breakdown - {selectedRouteSlot.timeSlot}</h2>
              </div>

              <div className="selected-point-info">
                <div className="info-item">
                  <span className="label">Route:</span>
                  <span className="value">{selectedRoute}</span>
                </div>
                <div className="info-item">
                  <span className="label">Date:</span>
                  <span className="value">{routeDetailsData?.date}</span>
                </div>
                <div className="info-item">
                  <span className="label">Time Slot:</span>
                  <span className="value">{selectedRouteSlot.timeSlot}</span>
                </div>
                <div className="info-item">
                  <span className="label">Score:</span>
                  <span
                    className="value score-badge"
                    style={{ backgroundColor: getLevelColor(selectedRouteSlot.level) }}
                  >
                    {selectedRouteSlot.score} ({selectedRouteSlot.level})
                  </span>
                </div>
              </div>

              {loadingRouteBreakdown ? (
                <div className="loading">Fetching breakdown...</div>
              ) : routeBreakdown ? (
                <div className="root-cause-content">
                  <div className="factors-breakdown">
                    <h3>Contributing Factors</h3>
                    <div className="factors-bars">
                      {routeBreakdown.factors?.map((factor, idx) => (
                        <div key={idx} className="factor-bar-item">
                          <div className="factor-info">
                            <span className="factor-name">{factor.name}</span>
                            <span className="factor-score">{factor.score} pts</span>
                          </div>
                          <div className="factor-bar-bg">
                            <div
                              className="factor-bar-fill"
                              style={{
                                width: `${Math.min((factor.score / 30) * 100, 100)}%`,
                                backgroundColor: factor.score > 20 ? '#ef4444' :
                                  factor.score > 10 ? '#f59e0b' : '#22c55e'
                              }}
                            ></div>
                          </div>
                          {factor.details && (
                            <div className="factor-details">{factor.details}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="summary-box">
                    <p>{routeBreakdown.summary}</p>
                  </div>

                  <button
                    className="recommendations-btn"
                    onClick={fetchRouteRecommendations}
                    disabled={loadingRouteRecommendations}
                  >
                    {loadingRouteRecommendations ? 'Loading...' : 'Get Recommendations'}
                  </button>
                </div>
              ) : (
                <div className="no-data">Unable to fetch breakdown data</div>
              )}
            </div>
          )}

          {/* Route Recommendations Section */}
          {showRouteRecommendations && routeRecommendations && (
            <div className="recommendations-section">
              <div className="section-header">
                <h2>Recommendations for {selectedRouteSlot?.timeSlot}</h2>
              </div>

              <div className="recommendations-list">
                {routeRecommendations.length > 0 ? (
                  routeRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="recommendation-card"
                      style={{ borderLeftColor: getPriorityColor(rec.priority) }}
                    >
                      <div className="rec-header">
                        <span
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(rec.priority) }}
                        >
                          {rec.priority?.toUpperCase()}
                        </span>
                        <span className="rec-category">{rec.category}</span>
                      </div>
                      <h4 className="rec-title">{rec.title}</h4>
                      <p className="rec-description">{rec.description}</p>
                      {rec.action && (
                        <div className="rec-action">
                          <strong>Action:</strong> {rec.action}
                        </div>
                      )}
                      {rec.impact && (
                        <div className="rec-impact">
                          <strong>Expected Impact:</strong> {rec.impact}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-data">No specific recommendations for this time slot</div>
                )}
              </div>
            </div>
          )}

          {/* Instructions when no slot selected */}
          {!selectedRouteSlot && routeBarChartData && (
            <div className="instructions-box">
              <h3>How to use Route Details</h3>
              <ol>
                <li>View today's traffic pattern across all 12 time slots (2-hour intervals)</li>
                <li>Click on any bar to see the breakdown of factors causing that traffic score</li>
                <li>See constructions, events, metro stations, potholes, etc. affecting this route</li>
                <li>Click "Get Recommendations" for actionable suggestions</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ========== DATA SCIENCE INSIGHTS TAB ========== */}
      {activeTab === 'insights' && (
        <div className="analytics-content ds-insights">
          {/* Period Selector */}
          <div className="ds-period-selector">
            <span className="ds-period-label">Analysis Period:</span>
            <div className="period-buttons">
              {[7, 30, 60, 'all'].map(d => (
                <button
                  key={d}
                  className={`period-btn ${insightsDays === d ? 'active' : ''}`}
                  onClick={() => setInsightsDays(d)}
                >
                  {d === 'all' ? 'All Data' : `${d} Days`}
                </button>
              ))}
            </div>
          </div>

          {loadingInsights ? (
            <div className="loading">Loading insights...</div>
          ) : insightsData ? (
            <>

              {/* --- MODEL VALIDATION METRICS --- */}
              <div className="ds-section">
                <div className="ds-section-header">
                  <h2>Prediction Performance</h2>
                  <span className="ds-subtitle">
                    {insightsData.validation.totalSamples > 0
                      ? `Based on ${insightsData.validation.totalSamples.toLocaleString()} verified predictions`
                      : 'No verified predictions available for this period'}
                  </span>
                </div>

                {insightsData.validation.totalSamples > 0 ? (
                  <>
                    <div className="ds-kpi-grid">
                      <div className="ds-kpi-card">
                        <div className="ds-kpi-label">Avg. Error</div>
                        <div className="ds-kpi-value">{insightsData.validation.mae ?? 'N/A'}</div>
                        <div className="ds-kpi-unit">points off on average</div>
                        <div className="ds-kpi-sub">{insightsData.validation.totalSamples.toLocaleString()} predictions checked</div>
                      </div>
                      <div className="ds-kpi-card">
                        <div className="ds-kpi-label">Error %</div>
                        <div className="ds-kpi-value">{insightsData.validation.mape ?? 'N/A'}</div>
                        <div className="ds-kpi-unit">% average deviation</div>
                        <div className="ds-kpi-sub">{insightsData.validation.mapeSampleCount.toLocaleString()} valid comparisons</div>
                      </div>
                      <div className="ds-kpi-card">
                        <div className="ds-kpi-label">Error Range</div>
                        <div className="ds-kpi-value">{insightsData.validation.rmse ?? 'N/A'}</div>
                        <div className="ds-kpi-unit">typical spread of error</div>
                      </div>
                      <div className="ds-kpi-card">
                        <div className="ds-kpi-label">Accuracy</div>
                        <div className={`ds-kpi-value ${
                          insightsData.validation.r2 === null ? '' :
                          insightsData.validation.r2 >= 0.7 ? 'ds-good' :
                          insightsData.validation.r2 >= 0.4 ? 'ds-warn' : 'ds-bad'
                        }`}>
                          {insightsData.validation.r2 !== null ? `${Math.round(insightsData.validation.r2 * 100)}%` : 'N/A'}
                        </div>
                        <div className="ds-kpi-unit">prediction reliability</div>
                      </div>
                    </div>

                    <div className="ds-accuracy-band">
                      <div className="ds-band-item">
                        <span className="ds-band-label">Very Close</span>
                        <div className="ds-band-bar"><div className="ds-band-fill ds-fill-green" style={{width: `${insightsData.validation.accuracyBand.within5}%`}}></div></div>
                        <span className="ds-band-value">{insightsData.validation.accuracyBand.within5}%</span>
                      </div>
                      <div className="ds-band-item">
                        <span className="ds-band-label">Close</span>
                        <div className="ds-band-bar"><div className="ds-band-fill ds-fill-amber" style={{width: `${insightsData.validation.accuracyBand.within10}%`}}></div></div>
                        <span className="ds-band-value">{insightsData.validation.accuracyBand.within10}%</span>
                      </div>
                      <div className="ds-band-item">
                        <span className="ds-band-label">Reasonable</span>
                        <div className="ds-band-bar"><div className="ds-band-fill ds-fill-blue" style={{width: `${insightsData.validation.accuracyBand.within20}%`}}></div></div>
                        <span className="ds-band-value">{insightsData.validation.accuracyBand.within20}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-data">No verified predictions available for this period.</div>
                )}
              </div>

              {/* --- FACTOR CONTRIBUTION --- */}
              {insightsData.factorContribution && Object.keys(insightsData.factorContribution).length > 0 && (
                <div className="ds-section">
                  <div className="ds-section-header">
                    <h2>What Affects Traffic</h2>
                    <span className="ds-subtitle">Breakdown of factors contributing to traffic scores on each route</span>
                  </div>

                  <div className="ds-factor-controls">
                    <label>Select Route:</label>
                    <select
                      value={selectedFactorRoute || ''}
                      onChange={e => setSelectedFactorRoute(e.target.value)}
                    >
                      {Object.keys(insightsData.factorContribution).map(r => (
                        <option key={r} value={r}>{r.replace(/-/g, ' → ')}</option>
                      ))}
                    </select>
                  </div>

                  {selectedFactorRoute && insightsData.factorContribution[selectedFactorRoute] && (() => {
                    const factors = insightsData.factorContribution[selectedFactorRoute];
                    const sorted = Object.entries(factors)
                      .filter(([, v]) => v.pct > 0)
                      .sort((a, b) => b[1].pct - a[1].pct);
                    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#22c55e','#06b6d4','#3b82f6','#a855f7','#14b8a6'];

                    const doughnutData = {
                      labels: sorted.map(([name]) => name),
                      datasets: [{
                        data: sorted.map(([, v]) => v.pct),
                        backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
                        borderWidth: 2,
                        borderColor: '#ffffff',
                      }]
                    };

                    return (
                      <div className="ds-factor-content">
                        <div className="ds-factor-chart">
                          <Doughnut data={doughnutData} options={{
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                              legend: { position: 'right', labels: { color: '#374151', padding: 12 } },
                              tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` } }
                            },
                            cutout: '60%'
                          }} />
                        </div>
                        <div className="ds-factor-table">
                          <table className="ds-table">
                            <thead><tr><th>Factor</th><th>Impact Score</th><th>Share</th></tr></thead>
                            <tbody>
                              {sorted.map(([name, v], idx) => (
                                <tr key={name}>
                                  <td><span className="ds-factor-dot" style={{backgroundColor: COLORS[idx % COLORS.length]}}></span>{name}</td>
                                  <td>{v.total}</td>
                                  <td><strong>{v.pct}%</strong></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="ds-factor-note">Percentages show each factor's share in the overall traffic score calculation for this route.</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* --- TREND ANALYSIS --- */}
              {insightsData.trendRegression && Object.keys(insightsData.trendRegression).length > 0 && (
                <div className="ds-section">
                  <div className="ds-section-header">
                    <h2>Traffic Trends</h2>
                    <span className="ds-subtitle">How traffic is changing over time on each route</span>
                  </div>
                  <div className="ds-trend-grid">
                    {Object.entries(insightsData.trendRegression).map(([routeId, data]) => {
                      const arrow = data.direction === 'worsening' ? '↑' : data.direction === 'improving' ? '↓' : '→';
                      const arrowColor = data.direction === 'worsening' ? '#ef4444' : data.direction === 'improving' ? '#22c55e' : '#6b7280';
                      const sparkData = {
                        labels: data.dailyAvgs.map(d => d.date.slice(5)),
                        datasets: [{
                          data: data.dailyAvgs.map(d => d.avg),
                          borderColor: arrowColor,
                          backgroundColor: 'transparent',
                          tension: 0.4,
                          pointRadius: 0,
                          borderWidth: 2,
                        }]
                      };

                      return (
                        <div key={routeId} className="ds-trend-card">
                          <div className="ds-trend-header">
                            <span className="ds-trend-route">{routeId.replace(/-/g, ' → ')}</span>
                            <span className="ds-trend-arrow" style={{color: arrowColor}}>{arrow}</span>
                          </div>
                          <div className="ds-trend-meta">
                            <span>Change: <strong style={{color: arrowColor}}>{data.slope > 0 ? '+' : ''}{data.slope}/day</strong></span>
                            <span>Confidence: <strong>{Math.round(data.r2 * 100)}%</strong></span>
                            <span className={`ds-trend-badge ds-trend-${data.direction}`}>{data.direction === 'worsening' ? 'Getting Worse' : data.direction === 'improving' ? 'Getting Better' : 'Stable'}</span>
                          </div>
                          <div className="ds-sparkline">
                            <Line data={sparkData} options={{
                              responsive: true, maintainAspectRatio: false,
                              plugins: { legend: { display: false }, tooltip: { enabled: false } },
                              scales: { x: { display: false }, y: { display: false } },
                              elements: { point: { radius: 0 } }
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* --- ROUTE STATISTICS --- */}
              {insightsData.routeStats && Object.keys(insightsData.routeStats).length > 0 && (
                <div className="ds-section">
                  <div className="ds-section-header">
                    <h2>Route Comparison</h2>
                    <span className="ds-subtitle">Side-by-side comparison of all monitored routes</span>
                  </div>
                  <div className="ds-table-wrapper">
                    <table className="ds-table">
                      <thead>
                        <tr>
                          <th>Route</th>
                          <th>Avg Score</th>
                          <th>Middle Value</th>
                          <th>Variation</th>
                          <th>Lowest</th>
                          <th>Highest</th>
                          <th>Busiest Time</th>
                          <th>Data Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const entries = Object.entries(insightsData.routeStats).sort((a, b) => b[1].mean - a[1].mean);
                          const worstRoute = entries.length > 0 ? entries[0][0] : null;
                          const bestRoute = entries.length > 0 ? entries[entries.length - 1][0] : null;
                          return entries.map(([routeId, s]) => (
                            <tr key={routeId} className={
                              routeId === worstRoute ? 'ds-row-worst' :
                              routeId === bestRoute ? 'ds-row-best' : ''
                            }>
                              <td style={{fontWeight: 600}}>{routeId.replace(/-/g, ' → ')}</td>
                              <td>{s.mean}</td>
                              <td>{s.median}</td>
                              <td>{s.std}</td>
                              <td>{s.min}</td>
                              <td>{s.max}</td>
                              <td>{s.peakHour}</td>
                              <td>{s.recordCount}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- KEY INSIGHTS (last) --- */}
              {insightsData.insights && insightsData.insights.length > 0 && (
                <div className="ds-section">
                  <div className="ds-section-header">
                    <h2>Key Insights</h2>
                    <span className="ds-subtitle">Based on analysis of traffic data for the selected period</span>
                  </div>
                  <div className="ds-insights-list">
                    {insightsData.insights.map((insight, idx) => (
                      <div key={idx} className="ds-insight-card">
                        <span className="ds-insight-bullet"></span>
                        <span className="ds-insight-text">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-data">Unable to load insights data.</div>
          )}
        </div>
      )}

    </div>
  );
};

// Helper for anomaly table
const getTrafficLevel = (score) => {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
};

export default AdminAnalytics;
