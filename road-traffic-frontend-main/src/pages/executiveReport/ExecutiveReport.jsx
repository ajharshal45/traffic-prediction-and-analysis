import React from 'react';
import './ExecutiveReport.css';

const ExecutiveReport = () => {
  return (
    <div className="executive-report-container">
      <div className="executive-report-header">
        <div className="header-info">
          <h2>📊 Pune Traffic Comprehensive Executive Report</h2>
          <span className="badge-live">Live Verified Dashboard</span>
        </div>
        <div className="header-actions">
          <a href="/report.html" target="_blank" rel="noopener noreferrer" className="btn-action primary">
            ↗️ Fullscreen / New Tab
          </a>
          <a href="/report.xlsx" download="Pune_Traffic_Report_365Days.xlsx" className="btn-action">
            📥 Excel Report (.xlsx)
          </a>
          <a href="/daily.csv" download="daily.csv" className="btn-action">
            📄 Daily CSV
          </a>
          <a href="/monthly.csv" download="monthly.csv" className="btn-action">
            📄 Monthly CSV
          </a>
          <a href="/reports" className="btn-action secondary">
            Interactive Period Reports ↗
          </a>
        </div>
      </div>
      <div className="iframe-wrapper">
        <iframe
          src="/report.html"
          title="Pune Traffic Analytics Executive Report"
          className="report-iframe"
        />
      </div>
    </div>
  );
};

export default ExecutiveReport;
