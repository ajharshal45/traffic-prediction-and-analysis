import React, { useState, useEffect } from 'react'
import apiRequest from '../../lib/apiRequest'
import './adminDashboard.css'

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    complaints: null,
    potholes: null,
    constructions: null,
    avgScore: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      const results = { complaints: 'N/A', potholes: 'N/A', constructions: 'N/A', avgScore: 'N/A' };

      try {
        const complaintRes = await apiRequest.get('/complaint/getComplaintData');
        results.complaints = Array.isArray(complaintRes.data) ? complaintRes.data.length : 'N/A';
      } catch (e) { console.error('Failed to fetch complaints', e); }

      try {
        const potholeRes = await apiRequest.get('/model/getPotholeData');
        results.potholes = Array.isArray(potholeRes.data) ? potholeRes.data.length : 'N/A';
      } catch (e) { console.error('Failed to fetch potholes', e); }

      try {
        const constructionRes = await apiRequest.get('/construction/getAllConstructionProjects');
        if (Array.isArray(constructionRes.data)) {
          results.constructions = constructionRes.data.filter(c => c.status === 'active').length;
        }
      } catch (e) { console.error('Failed to fetch constructions', e); }

      try {
        const trendRes = await apiRequest.get('/analytics/trends?route=Kondhwa-Hinjewadi&days=1');
        if (trendRes.data && trendRes.data.data && trendRes.data.data.length > 0) {
          results.avgScore = Math.round(trendRes.data.data[0].avgScore);
        }
      } catch (e) { console.error('Failed to fetch avg score', e); }

      setStats(results);
      setStatsLoading(false);
      setLastUpdated(new Date());
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Complaints', value: stats.complaints, color: '#fabc3c', icon: '' },
    { label: 'Total Potholes', value: stats.potholes, color: '#fabc3c', icon: '' },
    { label: 'Active Constructions', value: stats.constructions, color: '#fabc3c', icon: '' },
    { label: "Today's Avg Score", value: stats.avgScore, color: '#fabc3c', icon: '' },
  ];

  return (
    <div className='admin-dashboard'>
      <h1 className='admin-dashboard-title'>Admin Dashboard</h1>
      {lastUpdated && (
        <p className='admin-last-updated'>
          Last Updated: {lastUpdated.toLocaleTimeString()} — {lastUpdated.toLocaleDateString()}
        </p>
      )}

      <div className='admin-stats-grid'>
        {statCards.map((card, i) => (
          <div className='admin-stat-card' key={i} style={{ borderTop: `4px solid ${card.color}` }}>
            {statsLoading ? (
              <div className='admin-spinner-wrapper'>
                <div className='admin-spinner'></div>
              </div>
            ) : (
              <>
                <span className='admin-stat-icon'>{card.icon}</span>
                <span className='admin-stat-value' style={{ color: card.color }}>
                  {card.value}
                </span>
                <span className='admin-stat-label'>{card.label}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className='btn-container'>
        <a href="/admin/analytics" className="btn">Traffic Analytics</a>
        <a href="/admin/predictions" className="btn">Prediction Accuracy</a>
        <a href="/admin/potholes" className="btn">View Potholes</a>
        <a href="/admin/complaints" className="btn">View Complaints</a>
        <a href="/admin/users" className="btn">Grant Admin role</a>
        <a href="/admin/construction-timeline" className="btn">Construction Timeline</a>
      </div>
    </div>
  )
}

export default AdminDashboard;