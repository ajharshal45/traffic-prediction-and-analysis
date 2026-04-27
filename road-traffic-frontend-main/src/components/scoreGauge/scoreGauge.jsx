import React from 'react';
import './scoreGauge.css';

const ScoreGauge = ({ score, estimatedTime, baseDuration }) => {
  const clampedScore = Math.max(0, Math.min(100, Math.ceil(score || 0)));

  // Determine level and color
  let level = 'VERY LOW';
  let levelColor = '#22c55e';
  if (clampedScore >= 80) { level = 'VERY HIGH'; levelColor = '#991b1b'; }
  else if (clampedScore >= 60) { level = 'HIGH'; levelColor = '#ef4444'; }
  else if (clampedScore >= 30) { level = 'MEDIUM'; levelColor = '#f59e0b'; }
  else if (clampedScore >= 16) { level = 'LOW'; levelColor = '#86efac'; }

  // SVG arc params
  const cx = 150, cy = 150, r = 120;

  // Create arc path for a segment from startAngle to endAngle (degrees, 180=left, 0=right)
  const describeArc = (startAngle, endAngle) => {
    const startRad = (Math.PI * startAngle) / 180;
    const endRad = (Math.PI * endAngle) / 180;
    const x1 = cx - r * Math.cos(startRad);
    const y1 = cy - r * Math.sin(startRad);
    const x2 = cx - r * Math.cos(endRad);
    const y2 = cy - r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  // Zone definitions (mapped to 0-180 degrees)
  const zones = [
    { start: 0, end: 27, color: '#22c55e' },    // 0-15%
    { start: 27, end: 52.2, color: '#86efac' },  // 15-29%
    { start: 52.2, end: 106.2, color: '#f59e0b' }, // 30-59%
    { start: 106.2, end: 142.2, color: '#ef4444' }, // 60-79%
    { start: 142.2, end: 180, color: '#991b1b' }, // 80-100%
  ];

  // Needle rotation: 0 score = -90deg (left), 100 score = 90deg (right)
  const needleAngle = -90 + (clampedScore / 100) * 180;

  return (
    <div className="score-gauge-container">
      <svg className="score-gauge-svg" viewBox="0 0 300 180" width="300" height="180">
        {/* Colored arc zones */}
        {zones.map((zone, i) => (
          <path
            key={i}
            d={describeArc(zone.start, zone.end)}
            fill="none"
            stroke={zone.color}
            strokeWidth="18"
            strokeLinecap="butt"
          />
        ))}

        {/* Tick marks */}
        {[0, 15, 30, 60, 80, 100].map((tick) => {
          const angle = (Math.PI * (180 - (tick / 100) * 180)) / 180;
          const innerR = r - 14;
          const outerR = r + 14;
          const x1 = cx - innerR * Math.cos(angle);
          const y1 = cy - innerR * Math.sin(angle);
          const x2 = cx - outerR * Math.cos(angle);
          const y2 = cy - outerR * Math.sin(angle);
          return (
            <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#ccc" strokeWidth="2" />
          );
        })}

        {/* Needle */}
        <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 20}
            stroke="#333" strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="6" fill="#333" />
        </g>

        {/* Score text */}
        <text x={cx} y={cy - 25} textAnchor="middle" className="gauge-score-value">
          {clampedScore}
        </text>

        {/* Level text */}
        <text x={cx} y={cy - 5} textAnchor="middle" className="gauge-level-text" fill={levelColor}>
          {level}
        </text>

        {/* Min / Max labels */}
        <text x="20" y={cy + 15} className="gauge-label-text">0</text>
        <text x="270" y={cy + 15} className="gauge-label-text">100</text>
      </svg>

      <div className="gauge-info">
        <span>Estimated Travel Time: {estimatedTime}</span>
        <span>Base time: {baseDuration} | Traffic Score: {clampedScore}%</span>
      </div>
    </div>
  );
};

export default ScoreGauge;
