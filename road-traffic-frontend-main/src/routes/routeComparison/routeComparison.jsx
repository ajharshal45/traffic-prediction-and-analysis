import React, { useState, useEffect } from 'react';
import apiRequest from '../../lib/apiRequest';
import './routeComparison.css';

const ROUTES = [
  { id: 'Kondhwa-Hinjewadi', name: 'Kondhwa → Hinjewadi' },
  { id: 'Swargate-Katraj', name: 'Swargate → Katraj' },
  { id: 'Hinjewadi-Swargate', name: 'Hinjewadi → Swargate' },
];

const getLevel = (score) => {
  if (score >= 80) return { text: 'VERY HIGH', color: '#991b1b' };
  if (score >= 60) return { text: 'HIGH', color: '#ef4444' };
  if (score >= 30) return { text: 'MEDIUM', color: '#f59e0b' };
  if (score >= 16) return { text: 'LOW', color: '#22c55e' };
  return { text: 'VERY LOW', color: '#22c55e' };
};

const getBarColor = (score) => {
  if (score >= 80) return '#991b1b';
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#f59e0b';
  return '#22c55e';
};

const RouteComparison = () => {
  const [routeData, setRouteData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.all(
        ROUTES.map(async (route) => {
          try {
            const res = await apiRequest.get(`/analytics/trends?route=${route.id}&days=1`);
            const d = res.data?.data?.[0];
            return {
              ...route,
              avgScore: d?.avgScore != null ? Math.round(d.avgScore) : null,
              peakSlot: d?.peakSlot || 'N/A',
            };
          } catch {
            return { ...route, avgScore: null, peakSlot: 'N/A' };
          }
        })
      );
      setRouteData(results);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Determine best/worst among routes that have data
  const withScores = routeData.filter((r) => r.avgScore != null);
  let bestId = null;
  let worstId = null;
  if (withScores.length > 0) {
    bestId = withScores.reduce((a, b) => (a.avgScore <= b.avgScore ? a : b)).id;
    worstId = withScores.reduce((a, b) => (a.avgScore >= b.avgScore ? a : b)).id;
    if (bestId === worstId) worstId = null; // don't badge same route as both
  }

  if (loading) {
    return <div className="route-loading">Loading route comparisons...</div>;
  }

  return (
    <div className="route-comparison">
      <h1>Route Comparison</h1>
      <div className="route-cards-grid">
        {routeData.map((route) => {
          const hasData = route.avgScore != null;
          const score = hasData ? route.avgScore : 0;
          const level = hasData ? getLevel(score) : null;

          return (
            <div className="route-card" key={route.id}>
              <span className="route-card-title">{route.name}</span>

              {route.id === bestId && (
                <span className="route-badge best">Best Route</span>
              )}
              {route.id === worstId && (
                <span className="route-badge worst">Avoid</span>
              )}

              {hasData ? (
                <>
                  <span
                    className="route-level-badge"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.text}
                  </span>
                  <p className="route-detail">
                    <strong>Avg Score:</strong> {score}
                  </p>
                  <div className="route-score-bar">
                    <div
                      className="route-score-fill"
                      style={{
                        width: `${score}%`,
                        backgroundColor: getBarColor(score),
                      }}
                    />
                  </div>
                  <p className="route-detail">
                    <strong>Peak Slot:</strong> {route.peakSlot}
                  </p>
                </>
              ) : (
                <p className="route-detail">No data available</p>
              )}

              <a href="/analysis" className="route-analyze-btn">
                Analyze This Route
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteComparison;
