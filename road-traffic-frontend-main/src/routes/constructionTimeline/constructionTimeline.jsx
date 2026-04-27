import React, { useState, useEffect } from 'react';
import apiRequest from '../../lib/apiRequest';
import './constructionTimeline.css';

const ConstructionTimeline = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiRequest.get('/construction/getAllConstructionProjects');
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Failed to fetch constructions', e);
      }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  if (loading) return <div className="timeline-loading">Loading timeline...</div>;
  if (projects.length === 0) return <div className="timeline-empty">No construction projects found.</div>;

  // Calculate date range
  const dates = projects.flatMap((p) => [
    new Date(p.startDate).getTime(),
    new Date(p.expectedEndDate || p.endDate).getTime(),
  ]);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const totalMs = maxDate - minDate || 1;
  const totalDays = totalMs / (1000 * 60 * 60 * 24);

  const today = Date.now();
  const todayPct = Math.max(0, Math.min(100, ((today - minDate) / totalMs) * 100));

  // Date labels for header
  const numLabels = 6;
  const dateLabels = [];
  for (let i = 0; i <= numLabels; i++) {
    const d = new Date(minDate + (totalMs / numLabels) * i);
    dateLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  }

  const getBarStyle = (project) => {
    const start = new Date(project.startDate).getTime();
    const end = new Date(project.expectedEndDate || project.endDate).getTime();
    const leftPct = ((start - minDate) / totalMs) * 100;
    const widthPct = Math.max(2, ((end - start) / totalMs) * 100);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  };

  const getStatusClass = (status) => {
    if (status === 'active') return 'active';
    if (status === 'completed') return 'completed';
    return 'paused';
  };

  return (
    <div className="construction-timeline">
      <h1>Construction Timeline</h1>

      <div className="timeline-legend">
        <div className="timeline-legend-item">
          <span className="timeline-legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
          Active
        </div>
        <div className="timeline-legend-item">
          <span className="timeline-legend-dot" style={{ backgroundColor: '#22c55e' }}></span>
          Completed
        </div>
        <div className="timeline-legend-item">
          <span className="timeline-legend-dot" style={{ backgroundColor: '#9ca3af' }}></span>
          Paused
        </div>
      </div>

      <div className="timeline-container">
        {/* Header */}
        <div className="timeline-header">
          <div className="timeline-header-label">Project</div>
          <div className="timeline-header-dates">
            {dateLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        </div>

        {/* Rows */}
        {projects.map((project) => (
          <div className="timeline-row" key={project._id}>
            <div className="timeline-row-label">
              <strong>{project.projectName}</strong>
              <span>{project.vendorName}</span>
            </div>
            <div className="timeline-row-bar-area">
              {/* Today marker */}
              {todayPct > 0 && todayPct < 100 && (
                <div className="timeline-today" style={{ left: `${todayPct}%` }}>
                  <span className="timeline-today-label">Today</span>
                </div>
              )}

              <div
                className={`timeline-bar ${getStatusClass(project.status)}`}
                style={getBarStyle(project)}
                onMouseEnter={() => setHoveredId(project._id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {hoveredId === project._id && (
                  <div className="timeline-tooltip">
                    <div>Type: {project.type}</div>
                    <div>Start: {new Date(project.startDate).toLocaleDateString()}</div>
                    <div>End: {new Date(project.expectedEndDate || project.endDate).toLocaleDateString()}</div>
                    <div>Status: {project.status}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConstructionTimeline;
