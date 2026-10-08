import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  Filler
} from 'chart.js';
import './adminReports.css';

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

const REPORTS_API_BASE = import.meta.env.VITE_REPORTS_API_URL || 'http://localhost:8090/api/reports';

export default function AdminReports() {
  const [viewMode, setViewMode] = useState('compare'); // 'compare' | 'single'
  const [periodType, setPeriodType] = useState('day'); // 'day' | 'month' | 'year'
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  
  const [availableReports, setAvailableReports] = useState([]);
  const [selectedKeyA, setSelectedKeyA] = useState('');
  const [selectedKeyB, setSelectedKeyB] = useState('');
  const [singleKey, setSingleKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [comparisonData, setComparisonData] = useState(null);
  const [singleReport, setSingleReport] = useState(null);

  // Load distinct routes on mount
  useEffect(() => {
    async function fetchRoutes() {
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/routes`);
        if (res.data?.success && res.data.routes?.length > 0) {
          setRoutes(res.data.routes);
          setSelectedRoute(res.data.routes[0]);
        }
      } catch (err) {
        console.warn('Could not load routes from reports API:', err.message);
      }
    }
    fetchRoutes();
  }, []);

  // Fetch list of available reports whenever selectedRoute or periodType changes
  useEffect(() => {
    if (!selectedRoute) return;
    async function fetchList() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/list`, {
          params: { route: selectedRoute, type: periodType }
        });
        if (res.data?.success) {
          const list = res.data.reports || [];
          setAvailableReports(list);
          if (list.length >= 2) {
            setSelectedKeyA(list[0].periodKey);
            setSelectedKeyB(list[1].periodKey);
          } else if (list.length === 1) {
            setSelectedKeyA(list[0].periodKey);
            setSelectedKeyB(list[0].periodKey);
            setSingleKey(list[0].periodKey);
          } else {
            setSelectedKeyA('');
            setSelectedKeyB('');
            setSingleKey('');
          }
        }
      } catch (err) {
        setError(`Failed to fetch report list: ${err.response?.data?.error || err.message}`);
      } finally {
        setLoading(false);
      }
    }
    fetchList();
  }, [selectedRoute, periodType]);

  // Fetch comparison data
  useEffect(() => {
    if (viewMode !== 'compare' || !selectedRoute || !selectedKeyA || !selectedKeyB) return;
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/compare`, {
          params: {
            route: selectedRoute,
            type: periodType,
            a: selectedKeyA,
            b: selectedKeyB
          }
        });
        if (res.data?.success) {
          setComparisonData(res.data);
        }
      } catch (err) {
        setError(`Comparison failed: ${err.response?.data?.error || err.message}`);
        setComparisonData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchComparison();
  }, [viewMode, selectedRoute, periodType, selectedKeyA, selectedKeyB]);

  // Fetch single report data
  useEffect(() => {
    if (viewMode !== 'single' || !selectedRoute || !singleKey) return;
    async function fetchSingle() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/one`, {
          params: {
            route: selectedRoute,
            type: periodType,
            key: singleKey
          }
        });
        if (res.data?.success) {
          setSingleReport(res.data.report);
        }
      } catch (err) {
        setError(`Failed to fetch report: ${err.response?.data?.error || err.message}`);
        setSingleReport(null);
      } finally {
        setLoading(false);
      }
    }
    fetchSingle();
  }, [viewMode, selectedRoute, periodType, singleKey]);

  // Render Data Quality Badge
  const renderQualityBadge = (sourceMix, label) => {
    if (!sourceMix) return null;
    return (
      <div className="quality-badges-row">
        {label && <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{label}:</span>}
        <span className="quality-badge badge-computed">
          Computed: {sourceMix.computed}%
        </span>
        <span className="quality-badge badge-reconstructed">
          Reconstructed: {sourceMix.reconstructed}%
        </span>
        <span className="quality-badge badge-simulated">
          Simulated: {sourceMix.simulated}%
        </span>
      </div>
    );
  };

  // Build Factor Bar Chart Data
  const getFactorBarChartData = () => {
    if (!comparisonData?.comparison?.lines) return null;
    const lines = comparisonData.comparison.lines;
    const labels = lines.map(l => l.label);
    const dataValues = lines.map(l => l.contribution);
    const backgroundColors = dataValues.map(v => (v > 0 ? '#ef4444' : '#10b981')); // Red = increase, Green = decrease

    return {
      labels,
      datasets: [
        {
          label: 'Factor Contribution (Points)',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }
      ]
    };
  };

  // Build Daily Averages Overlay Line Chart Data
  const getDailyOverlayChartData = () => {
    if (!comparisonData?.reportA || !comparisonData?.reportB) return null;
    const dailyA = comparisonData.reportA.dailyAvgs || [];
    const dailyB = comparisonData.reportB.dailyAvgs || [];

    const maxDays = Math.max(dailyA.length, dailyB.length);
    const labels = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`);

    return {
      labels,
      datasets: [
        {
          label: `Period A (${comparisonData.reportA.periodKey})`,
          data: dailyA.map(d => d.avgScore),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: `Period B (${comparisonData.reportB.periodKey})`,
          data: dailyB.map(d => d.avgScore),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3,
          fill: true
        }
      ]
    };
  };

  return (
    <div className="admin-reports-container">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h1>Pre-Computed Period Reports & Analytics</h1>
          <p>Strictly isolated, deterministic comparative analysis engine for road traffic monitoring.</p>
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-button ${viewMode === 'compare' ? 'active' : ''}`}
            onClick={() => setViewMode('compare')}
          >
            Period Comparison
          </button>
          <button
            className={`segmented-button ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
          >
            Single Period View
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="reports-controls">
        <div className="control-group">
          <label>Route</label>
          <select
            className="control-select"
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
          >
            {routes.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Granularity</label>
          <div className="segmented-control">
            {['day', 'month', 'year'].map(t => (
              <button
                key={t}
                className={`segmented-button ${periodType === t ? 'active' : ''}`}
                onClick={() => setPeriodType(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'compare' ? (
          <>
            <div className="control-group period-picker-group">
              <label>Period A (Baseline)</label>
              <div className="picker-inputs-row">
                {periodType === 'day' && (
                  <input
                    type="date"
                    className="control-date-input"
                    value={selectedKeyA && selectedKeyA.match(/^\d{4}-\d{2}-\d{2}$/) ? selectedKeyA : ''}
                    onChange={e => {
                      if (e.target.value) setSelectedKeyA(e.target.value);
                    }}
                    title="Pick Period A date from calendar"
                  />
                )}
                {periodType === 'month' && (
                  <input
                    type="month"
                    className="control-date-input"
                    value={selectedKeyA ? selectedKeyA.slice(0, 7) : ''}
                    onChange={e => {
                      if (e.target.value) setSelectedKeyA(e.target.value);
                    }}
                    title="Pick Period A month from calendar"
                  />
                )}
                <select
                  className="control-select"
                  value={selectedKeyA}
                  onChange={e => setSelectedKeyA(e.target.value)}
                >
                  {availableReports.map(rep => (
                    <option key={rep.periodKey} value={rep.periodKey}>
                      {rep.periodKey} (Avg: {rep.avgScore})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="control-group period-picker-group">
              <label>Period B (Comparison)</label>
              <div className="picker-inputs-row">
                {periodType === 'day' && (
                  <input
                    type="date"
                    className="control-date-input"
                    value={selectedKeyB && selectedKeyB.match(/^\d{4}-\d{2}-\d{2}$/) ? selectedKeyB : ''}
                    onChange={e => {
                      if (e.target.value) setSelectedKeyB(e.target.value);
                    }}
                    title="Pick Period B date from calendar"
                  />
                )}
                {periodType === 'month' && (
                  <input
                    type="month"
                    className="control-date-input"
                    value={selectedKeyB ? selectedKeyB.slice(0, 7) : ''}
                    onChange={e => {
                      if (e.target.value) setSelectedKeyB(e.target.value);
                    }}
                    title="Pick Period B month from calendar"
                  />
                )}
                <select
                  className="control-select"
                  value={selectedKeyB}
                  onChange={e => setSelectedKeyB(e.target.value)}
                >
                  {availableReports.map(rep => (
                    <option key={rep.periodKey} value={rep.periodKey}>
                      {rep.periodKey} (Avg: {rep.avgScore})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="control-group period-picker-group">
            <label>Select Period</label>
            <div className="picker-inputs-row">
              {periodType === 'day' && (
                <input
                  type="date"
                  className="control-date-input"
                  value={singleKey && singleKey.match(/^\d{4}-\d{2}-\d{2}$/) ? singleKey : ''}
                  onChange={e => {
                    if (e.target.value) setSingleKey(e.target.value);
                  }}
                  title="Pick date from calendar"
                />
              )}
              {periodType === 'month' && (
                <input
                  type="month"
                  className="control-date-input"
                  value={singleKey ? singleKey.slice(0, 7) : ''}
                  onChange={e => {
                    if (e.target.value) setSingleKey(e.target.value);
                  }}
                  title="Pick month from calendar"
                />
              )}
              <select
                className="control-select"
                value={singleKey}
                onChange={e => setSingleKey(e.target.value)}
              >
                {availableReports.map(rep => (
                  <option key={rep.periodKey} value={rep.periodKey}>
                    {rep.periodKey} (Avg: {rep.avgScore})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error or Empty Notices */}
      {error && <div className="error-box">{error}</div>}
      {loading && <div className="loading-box">Computing analysis and metrics...</div>}

      {availableReports.length === 0 && !loading && !error && (
        <div className="empty-box">
          <h3>No Pre-Computed Reports Found</h3>
          <p>Please run the reports generation CLI to pre-compute period snapshots:</p>
          <code style={{ background: '#1e293b', padding: '0.4rem 0.8rem', borderRadius: 6 }}>
            npm run reports:build -- --route="{selectedRoute}"
          </code>
        </div>
      )}

      {/* COMPARISON VIEW */}
      {viewMode === 'compare' && comparisonData && !loading && (
        <div>
          {/* Summary Card with Narrative */}
          <div className="narrative-card">
            <h3>Automated Comparative Narrative</h3>
            <p className="narrative-text">
              {comparisonData.comparison?.explanation}
            </p>
            {comparisonData.comparison?.confidenceNote && (
              <p className="confidence-note">
                ⚠️ {comparisonData.comparison.confidenceNote}
              </p>
            )}
            <div style={{ marginTop: '1rem' }}>
              {renderQualityBadge(comparisonData.reportA?.sourceMix, `Period A (${comparisonData.reportA?.periodKey}) Data Quality`)}
              {renderQualityBadge(comparisonData.reportB?.sourceMix, `Period B (${comparisonData.reportB?.periodKey}) Data Quality`)}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Period A Avg Score</div>
              <div className="metric-value">{comparisonData.comparison?.scoreA}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Period B Avg Score</div>
              <div className="metric-value">{comparisonData.comparison?.scoreB}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net Score Delta</div>
              <div className={`metric-value ${
                comparisonData.comparison?.totalScoreChange > 0
                  ? 'delta-increase'
                  : comparisonData.comparison?.totalScoreChange < 0
                  ? 'delta-decrease'
                  : 'delta-neutral'
              }`}>
                {comparisonData.comparison?.totalScoreChange > 0 ? '+' : ''}
                {comparisonData.comparison?.totalScoreChange} pts
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Shared Overlapping Cells</div>
              <div className="metric-value">{comparisonData.comparison?.sharedCellsCount}</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-grid">
            {/* Factor Bar Chart */}
            <div className="chart-card">
              <h4>Factor Attribution & Remainder Decomposition</h4>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                Red denotes upward pressure on congestion; Green indicates relief. All lines sum exactly to net change.
              </p>
              {getFactorBarChartData() && (
                <Bar
                  data={getFactorBarChartData()}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
                      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                  }}
                />
              )}
            </div>

            {/* Daily Averages Overlay Line Chart */}
            <div className="chart-card">
              <h4>Daily Traffic Averages Overlay</h4>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                Comparing Day-over-Day progression across the respective observation periods.
              </p>
              {getDailyOverlayChartData() && (
                <Line
                  data={getDailyOverlayChartData()}
                  options={{
                    responsive: true,
                    plugins: { legend: { labels: { color: '#f1f5f9' } } },
                    scales: {
                      y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
                      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Context Facts List */}
          <div className="context-list-card">
            <h4>Observed Environmental Context in Period B</h4>
            <div className="context-items-grid">
              <div className="context-item">
                <div className="context-item-title">Active Constructions</div>
                <div className="context-item-val">{comparisonData.reportB?.context?.constructionActive || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Active Diversions</div>
                <div className="context-item-val">{comparisonData.reportB?.context?.diversions || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Recorded Rainy Days</div>
                <div className="context-item-val">{comparisonData.reportB?.context?.rainyDays || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Recorded Events</div>
                <div className="context-item-val">{comparisonData.reportB?.context?.eventCount || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Festivals</div>
                <div className="context-item-val" style={{ fontSize: '0.95rem' }}>
                  {comparisonData.reportB?.context?.festivals?.length > 0
                    ? comparisonData.reportB.context.festivals.join(', ')
                    : 'None reported'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PERIOD VIEW */}
      {viewMode === 'single' && singleReport && !loading && (
        <div>
          <div className="narrative-card">
            <h3>Period Report: {singleReport.periodKey} ({singleReport.periodType.toUpperCase()})</h3>
            <p className="narrative-text">{singleReport.summaryText}</p>
            {renderQualityBadge(singleReport.sourceMix, 'Data Quality Composition')}
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Average Score</div>
              <div className="metric-value">{singleReport.avgScore}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Coverage Percentage</div>
              <div className="metric-value">{singleReport.coveragePct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Records Evaluated</div>
              <div className="metric-value">{singleReport.recordCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Busiest Time Slot</div>
              <div className="metric-value" style={{ fontSize: '1.4rem' }}>{singleReport.busiestSlot}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Lowest Traffic Day</div>
              <div className="metric-value" style={{ fontSize: '1.2rem', color: '#34d399' }}>{singleReport.bestDay || 'N/A'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Peak Traffic Day</div>
              <div className="metric-value" style={{ fontSize: '1.2rem', color: '#f87171' }}>{singleReport.worstDay || 'N/A'}</div>
            </div>
          </div>

          {singleReport.dailyAvgs?.length > 1 && (
            <div className="chart-card" style={{ marginBottom: '2rem' }}>
              <h4>Daily Average Traffic Score</h4>
              <Line
                data={{
                  labels: singleReport.dailyAvgs.map(d => d.date),
                  datasets: [
                    {
                      label: 'Avg Score',
                      data: singleReport.dailyAvgs.map(d => d.avgScore),
                      borderColor: '#38bdf8',
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      fill: true,
                      tension: 0.3
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                  }
                }}
              />
            </div>
          )}

          <div className="context-list-card">
            <h4>Observed Environmental Context</h4>
            <div className="context-items-grid">
              <div className="context-item">
                <div className="context-item-title">Active Constructions</div>
                <div className="context-item-val">{singleReport.context?.constructionActive || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Active Diversions</div>
                <div className="context-item-val">{singleReport.context?.diversions || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Recorded Rainy Days</div>
                <div className="context-item-val">{singleReport.context?.rainyDays || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Recorded Events</div>
                <div className="context-item-val">{singleReport.context?.eventCount || 0}</div>
              </div>
              <div className="context-item">
                <div className="context-item-title">Festivals</div>
                <div className="context-item-val" style={{ fontSize: '0.95rem' }}>
                  {singleReport.context?.festivals?.length > 0
                    ? singleReport.context.festivals.join(', ')
                    : 'None reported'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
