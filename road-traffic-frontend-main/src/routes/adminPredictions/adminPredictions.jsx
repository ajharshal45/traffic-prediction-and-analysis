import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import apiRequest from '../../lib/apiRequest';
import './adminPredictions.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ROUTES = ['Kondhwa-Hinjewadi', 'Swargate-Katraj', 'Hinjewadi-Swargate'];

const AdminPredictions = () => {
  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);
  const [trendData, setTrendData] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [routeAccuracies, setRouteAccuracies] = useState({});
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [loadingRouteDetails, setLoadingRouteDetails] = useState(false);

  // --- FETCH KPI STATS ---
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiRequest.get('/prediction-logs/accuracy');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch accuracy stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // --- FETCH TREND DATA ---
  useEffect(() => {
    const fetchTrend = async () => {
      setLoadingTrend(true);
      try {
        const res = await apiRequest.get(`/prediction-logs/accuracy/trend?days=${days}`);
        setTrendData(res.data.trend || []);
      } catch (err) {
        console.error('Failed to fetch trend:', err);
      } finally {
        setLoadingTrend(false);
      }
    };
    fetchTrend();
  }, [days]);

  // --- FETCH ROUTE ACCURACIES ---
  useEffect(() => {
    const fetchRoutes = async () => {
      const results = {};
      for (const route of ROUTES) {
        try {
          const res = await apiRequest.get(`/prediction-logs/accuracy/${route}`);
          results[route] = res.data;
        } catch (err) {
          console.error(`Failed to fetch ${route}:`, err);
          results[route] = null;
        }
      }
      setRouteAccuracies(results);
    };
    fetchRoutes();
  }, []);

  // --- SELECT ROUTE FOR DRILL-DOWN ---
  const handleRouteClick = async (route) => {
    if (selectedRoute === route) {
      setSelectedRoute(null);
      setRouteDetails(null);
      return;
    }
    setSelectedRoute(route);
    setLoadingRouteDetails(true);
    try {
      const res = await apiRequest.get(`/prediction-logs/accuracy/${route}`);
      setRouteDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch route details:', err);
    } finally {
      setLoadingRouteDetails(false);
    }
  };

  // --- HELPERS ---
  const getAccuracyClass = (acc) => {
    if (acc >= 75) return 'high';
    if (acc >= 50) return 'medium';
    return 'low';
  };

  const getAccuracyColorClass = (acc) => {
    if (acc >= 75) return 'good';
    if (acc >= 50) return 'ok';
    return 'bad';
  };

  // --- TREND CHART CONFIG ---
  const trendChartData = {
    labels: trendData.map(t => {
      const d = new Date(t.date);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }),
    datasets: [
      {
        label: 'Average Accuracy %',
        data: trendData.map(t => t.avgAccuracy),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Avg Predicted Score',
        data: trendData.map(t => t.avgPredicted),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: 'Avg Actual Score',
        data: trendData.map(t => t.avgActual),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx !== undefined && trendData[idx]) {
              return `Predictions: ${trendData[idx].count}`;
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Score / Accuracy (%)' },
      },
    },
  };

  // --- ROUTE BAR CHART CONFIG ---
  const routeBarData = {
    labels: ROUTES.map(r => r.replace('-', ' → ')),
    datasets: [
      {
        label: 'Avg Accuracy %',
        data: ROUTES.map(r => routeAccuracies[r]?.overall?.avgAccuracy || 0),
        backgroundColor: ROUTES.map(r => {
          const acc = routeAccuracies[r]?.overall?.avgAccuracy || 0;
          if (acc >= 75) return 'rgba(34, 197, 94, 0.8)';
          if (acc >= 50) return 'rgba(245, 158, 11, 0.8)';
          return 'rgba(239, 68, 68, 0.8)';
        }),
        borderRadius: 8,
        barThickness: 50,
      },
    ],
  };

  const routeBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (item) => {
            const route = ROUTES[item.dataIndex];
            const data = routeAccuracies[route];
            if (!data?.overall) return '';
            return `Verified: ${data.overall.totalVerified}\nAvg Predicted: ${data.overall.avgPredicted}%\nAvg Actual: ${data.overall.avgActual}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: 'Accuracy (%)' },
      },
    },
    onClick: (_, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        handleRouteClick(ROUTES[idx]);
      }
    },
  };

  // --- RENDER ---
  return (
    <div className="predictions-container">
      {/* Header */}
      <div className="predictions-header">
        <h1>Prediction Accuracy Dashboard</h1>
        <p>Monitor how well the traffic prediction system is performing</p>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="pred-loading">
          <div className="spinner" />
          <p>Loading accuracy data...</p>
        </div>
      ) : stats ? (
        <div className="kpi-grid">
          <div className="kpi-card accuracy">
            <div className="kpi-label">Average Accuracy</div>
            <div className="kpi-value">
              {stats.avgAccuracy !== null ? `${stats.avgAccuracy}%` : 'N/A'}
            </div>
            {stats.avgAccuracy !== null && (
              <>
                <div className="kpi-sub">
                  Range: {stats.minAccuracy}% - {stats.maxAccuracy}%
                </div>
                <div className="accuracy-bar-container">
                  <div
                    className={`accuracy-bar-fill ${getAccuracyClass(stats.avgAccuracy)}`}
                    style={{ width: `${stats.avgAccuracy}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="kpi-card total">
            <div className="kpi-label">Total Predictions</div>
            <div className="kpi-value">
              {(stats.totalVerified + stats.totalUnverified).toLocaleString()}
            </div>
            <div className="kpi-sub">All logged predictions</div>
          </div>

          <div className="kpi-card verified">
            <div className="kpi-label">Verified</div>
            <div className="kpi-value">{stats.totalVerified.toLocaleString()}</div>
            <div className="kpi-sub">
              {stats.totalVerified + stats.totalUnverified > 0
                ? `${Math.round((stats.totalVerified / (stats.totalVerified + stats.totalUnverified)) * 100)}% of total`
                : '0%'}
            </div>
          </div>

          <div className="kpi-card unverified">
            <div className="kpi-label">Pending Verification</div>
            <div className="kpi-value">{stats.totalUnverified.toLocaleString()}</div>
            <div className="kpi-sub">Awaiting actual data</div>
          </div>
        </div>
      ) : (
        <div className="pred-empty">No prediction data available yet.</div>
      )}

      {/* Accuracy Trend Chart */}
      <div className="pred-section">
        <div className="pred-section-header">
          <h2>Accuracy Trend</h2>
          <div className="pred-period-buttons">
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                className={`pred-period-btn ${days === d ? 'active' : ''}`}
                onClick={() => setDays(d)}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <div className="pred-chart-container">
          {loadingTrend ? (
            <div className="pred-loading">
              <div className="spinner" />
              <p>Loading trend...</p>
            </div>
          ) : trendData.length > 0 ? (
            <Line data={trendChartData} options={trendChartOptions} />
          ) : (
            <div className="pred-empty">No trend data for this period.</div>
          )}
        </div>
      </div>

      {/* Route Accuracy Comparison */}
      <div className="pred-section">
        <div className="pred-section-header">
          <h2>Route Accuracy Comparison</h2>
          <span className="hint">Click a bar or card for time-slot breakdown</span>
        </div>

        <div className="pred-chart-container" style={{ height: 250 }}>
          <Bar data={routeBarData} options={routeBarOptions} />
        </div>

        <div className="route-cards-grid" style={{ marginTop: 20 }}>
          {ROUTES.map(route => {
            const data = routeAccuracies[route];
            const overall = data?.overall;
            return (
              <div
                key={route}
                className={`route-card ${selectedRoute === route ? 'selected' : ''}`}
                onClick={() => handleRouteClick(route)}
              >
                <div className="route-card-name">{route.replace(/-/g, ' → ')}</div>
                <div className="route-card-stats">
                  <div className="route-stat">
                    <div className={`route-stat-value ${overall ? getAccuracyColorClass(overall.avgAccuracy) : 'neutral'}`}>
                      {overall ? `${overall.avgAccuracy}%` : 'N/A'}
                    </div>
                    <div className="route-stat-label">Accuracy</div>
                  </div>
                  <div className="route-stat">
                    <div className="route-stat-value neutral">
                      {overall?.avgPredicted ?? 'N/A'}
                    </div>
                    <div className="route-stat-label">Avg Predicted</div>
                  </div>
                  <div className="route-stat">
                    <div className="route-stat-value neutral">
                      {overall?.avgActual ?? 'N/A'}
                    </div>
                    <div className="route-stat-label">Avg Actual</div>
                  </div>
                  <div className="route-stat">
                    <div className="route-stat-value neutral">
                      {overall?.totalVerified ?? 0}
                    </div>
                    <div className="route-stat-label">Verified</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Slot Breakdown (drill-down) */}
      {selectedRoute && (
        <div className="pred-section slot-breakdown-section">
          <button className="pred-back-btn" onClick={() => { setSelectedRoute(null); setRouteDetails(null); }}>
            Back to Overview
          </button>
          <div className="pred-section-header">
            <h2>Time Slot Breakdown: {selectedRoute.replace(/-/g, ' → ')}</h2>
          </div>

          {loadingRouteDetails ? (
            <div className="pred-loading">
              <div className="spinner" />
              <p>Loading breakdown...</p>
            </div>
          ) : routeDetails?.byTimeSlot?.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="slot-table">
                <thead>
                  <tr>
                    <th>Time Slot</th>
                    <th>Accuracy</th>
                    <th>Avg Predicted</th>
                    <th>Avg Actual</th>
                    <th>Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {routeDetails.byTimeSlot.map(slot => (
                    <tr key={slot.timeRange}>
                      <td style={{ fontWeight: 600 }}>{slot.timeRange}</td>
                      <td>
                        <div className="slot-accuracy-bar">
                          <div className="slot-bar-bg">
                            <div
                              className={`slot-bar-fill ${getAccuracyClass(slot.avgAccuracy)}`}
                              style={{ width: `${slot.avgAccuracy}%` }}
                            />
                          </div>
                          <span className={`slot-accuracy-value`}>{slot.avgAccuracy}%</span>
                        </div>
                      </td>
                      <td>{slot.avgPredicted}</td>
                      <td>{slot.avgActual}</td>
                      <td>{slot.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="pred-empty">No verified predictions for this route yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPredictions;
