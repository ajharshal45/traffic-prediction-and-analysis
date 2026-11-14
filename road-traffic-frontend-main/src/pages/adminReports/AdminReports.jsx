import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './adminReports.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const REPORTS_API_BASE = import.meta.env.VITE_REPORTS_API_URL || 'http://localhost:8090/api/reports';

const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
];

const WEEKDAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const FULL_WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function formatPeriodLabel(key, type) {
  if (!key) return '';
  if (type === 'month') {
    const parts = key.split('-');
    if (parts.length === 2) {
      const idx = parseInt(parts[1], 10) - 1;
      return `${FULL_MONTH_NAMES[idx] || parts[1]} ${parts[0]}`;
    }
  }
  return key;
}

export default function AdminReports() {
  // Filter states
  const [selectedRoute, setSelectedRoute] = useState('');
  const [periodType, setPeriodType] = useState('month'); // 'month' (default), 'year', 'day'
  const [routes, setRoutes] = useState([]);
  const [availableReports, setAvailableReports] = useState([]);
  
  // Staged picker selections (requested only on [Compare])
  const [pickerA, setPickerA] = useState('');
  const [pickerB, setPickerB] = useState('');

  // Active comparison and query states
  const [activeQuery, setActiveQuery] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Toggle state (OFF by default)
  const [showFactors, setShowFactors] = useState(false);

  // Month sub-view: 'daily' (default Score vs Day) or 'weekly' (4 weekly bar graphs)
  const [monthSubView, setMonthSubView] = useState('daily');
  const [selectedWeekTab, setSelectedWeekTab] = useState('all'); // 'all' | 1 | 2 | 3 | 4

  // 1. Fetch available routes on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/routes`);
        if (res.data?.success && res.data.routes?.length > 0) {
          setRoutes(res.data.routes);
          setSelectedRoute(res.data.routes[0]);
        }
      } catch (err) {
        console.warn('Could not load routes:', err.message);
      }
    }
    loadRoutes();
  }, []);

  // 2. Fetch list of available reports when route or periodType changes
  useEffect(() => {
    if (!selectedRoute) return;
    async function fetchList() {
      setError(null);
      try {
        const res = await axios.get(`${REPORTS_API_BASE}/list`, {
          params: { route: selectedRoute, type: periodType }
        });
        if (res.data?.success) {
          const list = res.data.reports || [];
          setAvailableReports(list);

          // Populate staged pickers
          if (list.length >= 2) {
            if (periodType === 'month' || periodType === 'day') {
              setPickerA(list[list.length - 2].periodKey);
              setPickerB(list[list.length - 1].periodKey);
            } else {
              setPickerA(list[0].periodKey);
              setPickerB(list[1].periodKey);
            }
          } else if (list.length === 1) {
            setPickerA(list[0].periodKey);
            setPickerB(list[0].periodKey);
          } else {
            setPickerA('');
            setPickerB('');
          }
        }
      } catch (err) {
        setError(`Failed to fetch available periods: ${err.response?.data?.error || err.message}`);
      }
    }
    fetchList();
  }, [selectedRoute, periodType]);

  // Execute comparison query
  const executeComparison = async (overrideParams = {}) => {
    if (!selectedRoute || !pickerA || !pickerB) return;
    setLoading(true);
    setError(null);

    const queryRoute = overrideParams.route || selectedRoute;
    const queryType = overrideParams.type || periodType;
    const queryA = overrideParams.a || pickerA;
    const queryB = overrideParams.b || pickerB;
    const sharedOnly = overrideParams.sharedOnly || false;

    try {
      const res = await axios.get(`${REPORTS_API_BASE}/compare`, {
        params: {
          route: queryRoute,
          type: queryType,
          a: queryA,
          b: queryB,
          sharedOnly: sharedOnly ? 'true' : 'false'
        }
      });
      if (res.data?.success) {
        setComparisonData(res.data);
        setActiveQuery({
          route: queryRoute,
          type: queryType,
          a: queryA,
          b: queryB,
          sharedOnly
        });
      }
    } catch (err) {
      setError(`Comparison failed: ${err.response?.data?.error || err.message}`);
      setComparisonData(null);
    } finally {
      setLoading(false);
    }
  };

  // Compute available date range hint text
  const availableRangeHint = useMemo(() => {
    if (availableReports.length === 0) return 'No stored data';
    const first = formatPeriodLabel(availableReports[0].periodKey, periodType);
    const last = formatPeriodLabel(availableReports[availableReports.length - 1].periodKey, periodType);
    return first === last ? `Available: ${first}` : `Available: ${first} – ${last}`;
  }, [availableReports, periodType]);

  // Available years for month and year modes
  const availableYears = useMemo(() => {
    if (periodType !== 'month' && periodType !== 'year') return [];
    const set = new Set();
    availableReports.forEach(r => {
      const y = r.periodKey.split('-')[0];
      if (y) set.add(y);
    });
    return Array.from(set).sort();
  }, [availableReports, periodType]);

  // Available months for a selected year in month mode
  const getAvailableMonthsForYear = (year) => {
    if (!year) return [];
    return availableReports
      .filter(r => r.periodKey.startsWith(year + '-'))
      .map(r => {
        const m = r.periodKey.split('-')[1];
        const idx = parseInt(m, 10) - 1;
        return {
          code: m,
          label: FULL_MONTH_NAMES[idx] || m
        };
      });
  };

  // Day range limits for calendar in day mode
  const dayRangeLimits = useMemo(() => {
    if (periodType !== 'day' || availableReports.length === 0) return { min: '', max: '' };
    return {
      min: availableReports[0].periodKey,
      max: availableReports[availableReports.length - 1].periodKey
    };
  }, [availableReports, periodType]);

  // Data quality classification for ONE single badge
  const dataBadgeInfo = useMemo(() => {
    if (!comparisonData?.reportA || !comparisonData?.reportB) return null;
    const a = comparisonData.reportA;
    const b = comparisonData.reportB;

    const covA = a.coveragePct ?? 100;
    const covB = b.coveragePct ?? 100;

    const label = 'Verified data';
    const type = 'verified';

    const tooltip = (
      <>
        <div><strong>Period A ({formatPeriodLabel(a.periodKey, a.periodType)}):</strong> Verified traffic sensor & route records ({covA}% coverage)</div>
        <div><strong>Period B ({formatPeriodLabel(b.periodKey, b.periodType)}):</strong> Verified traffic sensor & route records ({covB}% coverage)</div>
      </>
    );

    return { label, type, tooltip, isDemo: false };
  }, [comparisonData]);

  // Day mode weekday check
  const dayModeWeekdayInfo = useMemo(() => {
    if (activeQuery?.type !== 'day' || !comparisonData?.reportA || !comparisonData?.reportB) return null;
    const dateA = new Date(comparisonData.reportA.start);
    const dateB = new Date(comparisonData.reportB.start);
    const dayNameA = FULL_WEEKDAY_NAMES[dateA.getUTCDay()];
    const dayNameB = FULL_WEEKDAY_NAMES[dateB.getUTCDay()];
    const isMismatch = dateA.getUTCDay() !== dateB.getUTCDay();
    return { dayNameA, dayNameB, isMismatch };
  }, [activeQuery, comparisonData]);

  // Year mode shared months warning
  const yearModeMismatchInfo = useMemo(() => {
    if (activeQuery?.type !== 'year' || !comparisonData?.reportA || !comparisonData?.reportB) return null;
    const dailyA = comparisonData.reportA.dailyAvgs || [];
    const dailyB = comparisonData.reportB.dailyAvgs || [];
    const monthsA = new Set(dailyA.map(d => d.date.split('-')[1]));
    const monthsB = new Set(dailyB.map(d => d.date.split('-')[1]));

    const countA = monthsA.size;
    const countB = monthsB.size;
    const isMismatch = countA !== countB || Array.from(monthsA).some(m => !monthsB.has(m));

    return {
      yearA: activeQuery.a,
      yearB: activeQuery.b,
      countA,
      countB,
      isMismatch: isMismatch && !activeQuery.sharedOnly
    };
  }, [activeQuery, comparisonData]);

  // Month mode different days warning
  const monthModeMismatchInfo = useMemo(() => {
    if (activeQuery?.type !== 'month' || !comparisonData?.reportA || !comparisonData?.reportB) return null;
    const daysA = (comparisonData.reportA.dailyAvgs || []).length;
    const daysB = (comparisonData.reportB.dailyAvgs || []).length;
    return {
      daysA,
      daysB,
      isMismatch: Math.abs(daysA - daysB) >= 3
    };
  }, [activeQuery, comparisonData]);

  // Custom ChartJS Plugins: Horizontal Level Bands & Day Mode Rush Hour Shading
  const chartPlugins = useMemo(() => {
    const horizontalBandsPlugin = {
      id: 'horizontalBandsPlugin',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales?.y) return;
        const { left, width } = chartArea;
        const y = scales.y;

        const bands = [
          { min: 0, max: 15, color: 'rgba(34, 197, 94, 0.05)' },     // Very Low
          { min: 15, max: 35, color: 'rgba(59, 130, 246, 0.05)' },    // Low
          { min: 35, max: 60, color: 'rgba(234, 179, 8, 0.05)' },     // Medium
          { min: 60, max: 85, color: 'rgba(249, 115, 22, 0.05)' },    // High
          { min: 85, max: 100, color: 'rgba(239, 68, 68, 0.05)' }     // Very High
        ];

        ctx.save();
        for (const b of bands) {
          const yTop = y.getPixelForValue(Math.min(100, b.max));
          const yBottom = y.getPixelForValue(Math.max(0, b.min));
          ctx.fillStyle = b.color;
          ctx.fillRect(left, yTop, width, yBottom - yTop);
        }
        ctx.restore();
      }
    };

    const rushHourShadingPlugin = {
      id: 'rushHourShadingPlugin',
      beforeDraw(chart) {
        if (activeQuery?.type !== 'day') return;
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales?.x) return;
        const { top, bottom } = chartArea;
        const x = scales.x;

        // Morning Rush: 08-10 (idx 4) to 10-12 (idx 5)
        // Evening Rush: 16-18 (idx 8) to 18-20 (idx 9)
        const stepWidth = x.width / 12;
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';

        // Morning
        const mLeft = x.getPixelForValue(4) - (stepWidth / 2);
        const mRight = x.getPixelForValue(5) + (stepWidth / 2);
        ctx.fillRect(mLeft, top, mRight - mLeft, bottom - top);

        // Evening
        const eLeft = x.getPixelForValue(8) - (stepWidth / 2);
        const eRight = x.getPixelForValue(9) + (stepWidth / 2);
        ctx.fillRect(eLeft, top, eRight - eLeft, bottom - top);

        ctx.restore();
      }
    };

    return [horizontalBandsPlugin, rushHourShadingPlugin];
  }, [activeQuery]);

  // Build Grouped Bar Chart Data
  const chartConfig = useMemo(() => {
    if (!comparisonData?.reportA || !comparisonData?.reportB) return null;
    const a = comparisonData.reportA;
    const b = comparisonData.reportB;
    const typical = comparisonData.comparison?.typicalProfile || null;
    const type = activeQuery?.type || 'month';

    let labels = [];
    let dataA = [];
    let dataB = [];
    let typicalData = [];
    let xAxisTitle = 'Time of day';

    if (type === 'day') {
      labels = TIME_SLOTS;
      xAxisTitle = 'Time of day';
      const weekdayA = new Date(a.start).getUTCDay();
      const weekdayB = new Date(b.start).getUTCDay();

      dataA = TIME_SLOTS.map(slot => {
        const cell = a.grid?.[weekdayA]?.[slot];
        return (cell && cell.count > 0) ? Math.round((cell.scoreSum / cell.count) * 10) / 10 : null;
      });

      dataB = TIME_SLOTS.map(slot => {
        const cell = b.grid?.[weekdayB]?.[slot];
        return (cell && cell.count > 0) ? Math.round((cell.scoreSum / cell.count) * 10) / 10 : null;
      });

      if (typical) {
        typicalData = TIME_SLOTS.map(slot => (typeof typical[slot] === 'number' ? typical[slot] : null));
      }
    } else if (type === 'month') {
      const getDaysInMonth = (periodKey) => {
        if (!periodKey) return 30;
        const parts = periodKey.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(m)) return 30;
        return new Date(Date.UTC(y, m, 0)).getUTCDate();
      };

      const daysInA = getDaysInMonth(a.periodKey);
      const daysInB = getDaysInMonth(b.periodKey);
      const maxDays = Math.max(daysInA, daysInB);

      labels = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`);
      xAxisTitle = 'Day of Month';

      const mapA = {};
      (a.dailyAvgs || []).forEach(item => {
        const d = parseInt(item.date.split('-')[2], 10);
        mapA[d] = item.avgScore;
      });

      const mapB = {};
      (b.dailyAvgs || []).forEach(item => {
        const d = parseInt(item.date.split('-')[2], 10);
        mapB[d] = item.avgScore;
      });

      dataA = Array.from({ length: maxDays }, (_, i) => {
        const day = i + 1;
        return typeof mapA[day] === 'number' ? Math.round(mapA[day] * 10) / 10 : null;
      });

      dataB = Array.from({ length: maxDays }, (_, i) => {
        const day = i + 1;
        return typeof mapB[day] === 'number' ? Math.round(mapB[day] * 10) / 10 : null;
      });
    } else if (type === 'year') {
      labels = MONTH_NAMES;
      xAxisTitle = 'Month';

      const getMonthlyMap = (rep) => {
        const map = {};
        for (const d of (rep.dailyAvgs || [])) {
          const m = parseInt(d.date.split('-')[1], 10) - 1;
          if (!map[m]) map[m] = { sum: 0, count: 0 };
          map[m].sum += d.avgScore * d.count;
          map[m].count += d.count;
        }
        return map;
      };

      const mapA = getMonthlyMap(a);
      const mapB = getMonthlyMap(b);

      dataA = MONTH_NAMES.map((_, idx) => {
        const item = mapA[idx];
        return item && item.count > 0 ? Math.round((item.sum / item.count) * 10) / 10 : null;
      });

      dataB = MONTH_NAMES.map((_, idx) => {
        const item = mapB[idx];
        return item && item.count > 0 ? Math.round((item.sum / item.count) * 10) / 10 : null;
      });
    }

    const datasets = [
      {
        label: `Period A (${formatPeriodLabel(a.periodKey, type)})`,
        data: dataA,
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 4,
        order: 2
      },
      {
        label: `Period B (${formatPeriodLabel(b.periodKey, type)})`,
        data: dataB,
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
        borderColor: '#059669',
        borderWidth: 1,
        borderRadius: 4,
        order: 2
      }
    ];

    if (typicalData.length > 0 && typicalData.some(v => v !== null)) {
      datasets.push({
        type: 'line',
        label: 'Usual (all available data)',
        data: typicalData,
        borderColor: '#6b7280',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 1
      });
    }

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 12, weight: '600' },
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          padding: 10,
          callbacks: {
            label: function (context) {
              const val = context.raw;
              if (val === null || val === undefined) {
                return `${context.dataset.label}: Not enough data`;
              }
              return `${context.dataset.label}: ${val} points`;
            },
            afterBody: function (items) {
              if (items.length >= 2) {
                const valA = items[0].raw;
                const valB = items[1].raw;
                if (typeof valA === 'number' && typeof valB === 'number') {
                  const diff = Math.round((valB - valA) * 10) / 10;
                  return [`Difference: ${diff >= 0 ? '+' : ''}${diff} points`];
                }
              }
              return [];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: xAxisTitle,
            font: { weight: '600', size: 12 },
            color: '#4b5563'
          },
          grid: { display: false }
        },
        y: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Congestion Score (0–100)',
            font: { weight: '600', size: 12 },
            color: '#4b5563'
          },
          ticks: { stepSize: 20 },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      }
    };

    return { data: { labels, datasets }, options };
  }, [comparisonData, activeQuery]);

  // 4 Weekly Bar Charts Data (Score vs Day of Week: Mon–Sun)
  const weeklyChartsConfig = useMemo(() => {
    if (!comparisonData?.reportA || !comparisonData?.reportB || activeQuery?.type !== 'month') {
      return null;
    }
    const a = comparisonData.reportA;
    const b = comparisonData.reportB;

    const weeks = [
      { id: 1, label: 'Week 1', sublabel: 'Days 1–7', minDay: 1, maxDay: 7 },
      { id: 2, label: 'Week 2', sublabel: 'Days 8–14', minDay: 8, maxDay: 14 },
      { id: 3, label: 'Week 3', sublabel: 'Days 15–21', minDay: 15, maxDay: 21 },
      { id: 4, label: 'Week 4', sublabel: 'Days 22–31', minDay: 22, maxDay: 31, hasRemaining: true }
    ];

    const dayIndices = [1, 2, 3, 4, 5, 6, 0]; // Mon to Sun

    const computeWeekScores = (report, minDay, maxDay) => {
      const daily = report.dailyAvgs || [];
      return dayIndices.map(wIndex => {
        const matches = daily.filter(item => {
          const parts = item.date.split('-');
          const day = parseInt(parts[2], 10);
          if (day < minDay || day > maxDay) return false;
          const dObj = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, day));
          return dObj.getUTCDay() === wIndex;
        });

        if (matches.length === 0) return null;
        const totalScore = matches.reduce((sum, item) => sum + (item.avgScore * (item.count || 1)), 0);
        const totalCount = matches.reduce((sum, item) => sum + (item.count || 1), 0);
        return totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : null;
      });
    };

    return weeks.map(w => {
      const dataA = computeWeekScores(a, w.minDay, w.maxDay);
      const dataB = computeWeekScores(b, w.minDay, w.maxDay);

      return {
        ...w,
        chartData: {
          labels: WEEKDAY_NAMES,
          datasets: [
            {
              label: `Period A (${formatPeriodLabel(a.periodKey, 'month')})`,
              data: dataA,
              backgroundColor: 'rgba(59, 130, 246, 0.85)',
              borderColor: '#2563eb',
              borderWidth: 1,
              borderRadius: 4
            },
            {
              label: `Period B (${formatPeriodLabel(b.periodKey, 'month')})`,
              data: dataB,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              borderColor: '#059669',
              borderWidth: 1,
              borderRadius: 4
            }
          ]
        }
      };
    });
  }, [comparisonData, activeQuery]);

  // Weekly Chart Options
  const weeklyChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 11, weight: '600' },
            boxWidth: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#1f2937',
          padding: 8,
          callbacks: {
            label: function (context) {
              const val = context.raw;
              if (val === null || val === undefined) {
                return `${context.dataset.label}: No data`;
              }
              return `${context.dataset.label}: ${val} points`;
            },
            afterBody: function (items) {
              if (items.length >= 2) {
                const valA = items[0].raw;
                const valB = items[1].raw;
                if (typeof valA === 'number' && typeof valB === 'number') {
                  const diff = Math.round((valB - valA) * 10) / 10;
                  return [`Difference: ${diff >= 0 ? '+' : ''}${diff} points`];
                }
              }
              return [];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Day of week',
            font: { weight: '600', size: 11 },
            color: '#4b5563'
          },
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Score (0–100)',
            font: { weight: '600', size: 11 },
            color: '#4b5563'
          },
          ticks: { stepSize: 25, font: { size: 10 } },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      }
    };
  }, []);

  // Contributing Factors decomposition data
  const factorPanelData = useMemo(() => {
    if (!comparisonData?.comparison) return null;
    const comp = comparisonData.comparison;
    const a = comparisonData.reportA;
    const b = comparisonData.reportB;

    const contextRows = [
      {
        label: 'Active construction sites',
        valA: a?.context?.constructionActive ?? 0,
        valB: b?.context?.constructionActive ?? 0
      },
      {
        label: 'Traffic diversions',
        valA: a?.context?.diversions ?? 0,
        valB: b?.context?.diversions ?? 0
      },
      {
        label: 'Public events',
        valA: a?.context?.eventCount ?? 0,
        valB: b?.context?.eventCount ?? 0
      },
      {
        label: 'Festivals / Holidays',
        valA: a?.context?.festivals?.length ? a.context.festivals.join(', ') : 'None',
        valB: b?.context?.festivals?.length ? b.context.festivals.join(', ') : 'None'
      },
      {
        label: 'Rainy days',
        valA: a?.context?.rainyDays ?? 0,
        valB: b?.context?.rainyDays ?? 0
      }
    ];

    const rawLines = comp.lines || [];
    const nonZero = rawLines
      .filter(l => Math.abs(l.contribution) > 0.01)
      .map(l => ({
        ...l,
        label: l.name === 'remainder' ? 'Other adjustments' : l.label
      }))
      .sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution))
      .slice(0, 5);

    const top = nonZero[0];
    const summaryText = top
      ? `${top.label} contributed the largest shift (${top.contribution >= 0 ? '+' : ''}${top.contribution} points) under the current scoring formula.`
      : 'All measured contributing factors were balanced across both periods.';

    return { contextRows, lines: nonZero, summaryText };
  }, [comparisonData]);

  // Visual Donut / Pie Chart Data for Period A and Period B
  const factorsChartData = useMemo(() => {
    if (!comparisonData?.reportA || !comparisonData?.reportB) return null;
    const a = comparisonData.reportA;
    const b = comparisonData.reportB;

    const FACTOR_METADATA = {
      festival: { label: 'Festivals / Holidays', color: '#8b5cf6' },
      hotspot: { label: 'Bottlenecks & Hotspots', color: '#ef4444' },
      transit: { label: 'Public Transit Volume', color: '#f59e0b' },
      weather: { label: 'Rain & Weather', color: '#3b82f6' },
      metro: { label: 'Metro Construction', color: '#10b981' },
      construction: { label: 'Road Construction', color: '#f97316' },
      diversion: { label: 'Traffic Diversions', color: '#ec4899' },
      event: { label: 'Public Events', color: '#06b6d4' },
      pothole: { label: 'Potholes / Road Condition', color: '#6366f1' },
      complaint: { label: 'Citizen Complaints', color: '#a855f7' }
    };

    const extractFactors = (report) => {
      const sums = {};
      const grid = report.grid || {};
      for (const w of Object.keys(grid)) {
        for (const s of Object.keys(grid[w] || {})) {
          const fSums = grid[w][s]?.factorSums || {};
          for (const [k, v] of Object.entries(fSums)) {
            if (typeof v === 'number' && v > 0) {
              sums[k] = (sums[k] || 0) + v;
            }
          }
        }
      }

      // Context fallback if factorSums were zero
      if (Object.keys(sums).length === 0 && report.context) {
        if (report.context.rainyDays > 0) sums.weather = report.context.rainyDays * 50;
        if (report.context.diversions > 0) sums.diversion = report.context.diversions * 40;
        if (report.context.eventCount > 0) sums.event = report.context.eventCount * 30;
        if (report.context.festivals?.length > 0) sums.festival = report.context.festivals.length * 200;
        if (report.context.constructionActive > 0) sums.construction = report.context.constructionActive * 80;
      }

      const total = Object.values(sums).reduce((acc, curr) => acc + curr, 0);
      if (total === 0) return { items: [], chartData: null };

      const items = Object.entries(sums)
        .map(([key, val]) => {
          const meta = FACTOR_METADATA[key] || { label: key, color: '#6b7280' };
          const pct = Math.round((val / total) * 1000) / 10;
          return {
            key,
            label: meta.label,
            value: val,
            percentage: pct,
            color: meta.color
          };
        })
        .filter(it => it.percentage >= 0.5)
        .sort((x, y) => y.value - x.value);

      const chartData = {
        labels: items.map(it => it.label),
        datasets: [
          {
            data: items.map(it => it.value),
            backgroundColor: items.map(it => it.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      };

      return { items, chartData };
    };

    const dataA = extractFactors(a);
    const dataB = extractFactors(b);

    const donutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          padding: 9,
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const dataset = context.dataset;
              const total = dataset.data.reduce((acc, cur) => acc + cur, 0);
              const val = dataset.data[context.dataIndex];
              const pct = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;
              return ` ${label}: ${pct}% of factor pressure`;
            }
          }
        }
      }
    };

    return {
      periodA: { ...dataA, report: a },
      periodB: { ...dataB, report: b },
      options: donutOptions
    };
  }, [comparisonData]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-container">
      {/* Print-Only Header */}
      <div className="print-header" style={{ display: 'none' }}>
        <div className="print-meta-grid">
          <div>
            <h1>Traffic Comparison</h1>
            <div>Route: <strong>{selectedRoute}</strong></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Comparing: <strong>{activeQuery ? `${formatPeriodLabel(activeQuery.a, activeQuery.type)} vs ${formatPeriodLabel(activeQuery.b, activeQuery.type)}` : ''}</strong></div>
            <div>Generated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="reports-header no-print">
        <h1>Traffic Comparison</h1>
        <p>Compare traffic congestion across two time periods for a single route.</p>
      </div>

      {/* 2. One Filter Row */}
      <div className="filter-row no-print">
        {/* Route Selector */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="route-select">Route</label>
          <select
            id="route-select"
            className="filter-select"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Compare By Mode */}
        <div className="filter-group btn-group-cell">
          <label className="filter-label">Compare by</label>
          <div className="mode-segmented-control">
            <button
              type="button"
              className={`mode-btn ${periodType === 'month' ? 'active' : ''}`}
              onClick={() => setPeriodType('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`mode-btn ${periodType === 'year' ? 'active' : ''}`}
              onClick={() => setPeriodType('year')}
            >
              Year
            </button>
            <button
              type="button"
              className={`mode-btn ${periodType === 'day' ? 'active' : ''}`}
              onClick={() => setPeriodType('day')}
            >
              Day
            </button>
          </div>
        </div>

        {/* Period A Picker */}
        <div className="filter-group">
          <label className="filter-label">
            Period A {periodType === 'month' ? '(Month & Year)' : periodType === 'day' ? '(Calendar Date)' : '(Year)'}
          </label>

          {periodType === 'month' ? (
            <div className="month-year-picker-group">
              {/* Month Selector */}
              <select
                className="filter-select month-select"
                value={pickerA.split('-')[1] || ''}
                onChange={(e) => {
                  const y = pickerA.split('-')[0] || availableYears[0];
                  setPickerA(`${y}-${e.target.value}`);
                }}
                disabled={availableReports.length === 0}
              >
                {getAvailableMonthsForYear(pickerA.split('-')[0] || availableYears[0]).map(m => (
                  <option key={`a-m-${m.code}`} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                className="filter-select year-select"
                value={pickerA.split('-')[0] || ''}
                onChange={(e) => {
                  const newY = e.target.value;
                  const currentM = pickerA.split('-')[1];
                  const validMonths = getAvailableMonthsForYear(newY);
                  const match = validMonths.find(m => m.code === currentM);
                  const targetM = match ? match.code : (validMonths[0]?.code || '01');
                  setPickerA(`${newY}-${targetM}`);
                }}
                disabled={availableReports.length === 0}
              >
                {availableYears.map(y => (
                  <option key={`a-y-${y}`} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : periodType === 'day' ? (
            <div className="calendar-input-wrapper">
              <input
                type="date"
                id="period-a-date"
                className="filter-select calendar-date-input"
                value={pickerA}
                min={dayRangeLimits.min}
                max={dayRangeLimits.max}
                onChange={(e) => setPickerA(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                disabled={availableReports.length === 0}
              />
            </div>
          ) : (
            <select
              id="period-a-select"
              className="filter-select"
              value={pickerA}
              onChange={(e) => setPickerA(e.target.value)}
              disabled={availableReports.length === 0}
            >
              {availableReports.map((r) => (
                <option key={`a-${r.periodKey}`} value={r.periodKey}>
                  {r.periodKey}
                </option>
              ))}
            </select>
          )}

          <span className="range-hint">{availableRangeHint}</span>
        </div>

        {/* Period B Picker */}
        <div className="filter-group">
          <label className="filter-label">
            Period B {periodType === 'month' ? '(Month & Year)' : periodType === 'day' ? '(Calendar Date)' : '(Year)'}
          </label>

          {periodType === 'month' ? (
            <div className="month-year-picker-group">
              {/* Month Selector */}
              <select
                className="filter-select month-select"
                value={pickerB.split('-')[1] || ''}
                onChange={(e) => {
                  const y = pickerB.split('-')[0] || availableYears[0];
                  setPickerB(`${y}-${e.target.value}`);
                }}
                disabled={availableReports.length === 0}
              >
                {getAvailableMonthsForYear(pickerB.split('-')[0] || availableYears[0]).map(m => (
                  <option key={`b-m-${m.code}`} value={m.code}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                className="filter-select year-select"
                value={pickerB.split('-')[0] || ''}
                onChange={(e) => {
                  const newY = e.target.value;
                  const currentM = pickerB.split('-')[1];
                  const validMonths = getAvailableMonthsForYear(newY);
                  const match = validMonths.find(m => m.code === currentM);
                  const targetM = match ? match.code : (validMonths[0]?.code || '01');
                  setPickerB(`${newY}-${targetM}`);
                }}
                disabled={availableReports.length === 0}
              >
                {availableYears.map(y => (
                  <option key={`b-y-${y}`} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : periodType === 'day' ? (
            <div className="calendar-input-wrapper">
              <input
                type="date"
                id="period-b-date"
                className="filter-select calendar-date-input"
                value={pickerB}
                min={dayRangeLimits.min}
                max={dayRangeLimits.max}
                onChange={(e) => setPickerB(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                disabled={availableReports.length === 0}
              />
            </div>
          ) : (
            <select
              id="period-b-select"
              className="filter-select"
              value={pickerB}
              onChange={(e) => setPickerB(e.target.value)}
              disabled={availableReports.length === 0}
            >
              {availableReports.map((r) => (
                <option key={`b-${r.periodKey}`} value={r.periodKey}>
                  {r.periodKey}
                </option>
              ))}
            </select>
          )}

          <span className="range-hint">{availableRangeHint}</span>
        </div>

        {/* Compare Button */}
        <div className="filter-group btn-group-cell">
          <label className="filter-label">&nbsp;</label>
          <button
            type="button"
            className="compare-btn"
            onClick={() => executeComparison()}
            disabled={loading || availableReports.length === 0 || !pickerA || !pickerB}
          >
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>
      </div>

      {/* Errors */}
      {error && <div className="error-banner">{error}</div>}

      {/* Day Mode Yellow Notice */}
      {activeQuery?.type === 'day' && comparisonData && (
        <div className="warning-banner">
          <span className="warning-icon">⚠️</span>
          <div>
            <div>Single days can be misleading (weekday, weather, incidents). For decisions, compare whole months.</div>
            {dayModeWeekdayInfo?.isMismatch && (
              <div style={{ marginTop: '4px', fontWeight: '600' }}>
                Period A is a {dayModeWeekdayInfo.dayNameA} and Period B is a {dayModeWeekdayInfo.dayNameB}. Weekday and weekend traffic differ.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Year Mode Shared Months Warning */}
      {yearModeMismatchInfo?.isMismatch && (
        <div className="mismatch-banner no-print">
          <div>
            <strong>Notice:</strong> {yearModeMismatchInfo.yearA} has data for {yearModeMismatchInfo.countA} months, and {yearModeMismatchInfo.yearB} for {yearModeMismatchInfo.countB} months.
          </div>
          <button
            type="button"
            className="restrict-btn"
            onClick={() => executeComparison({ sharedOnly: true })}
          >
            Compare shared months only
          </button>
        </div>
      )}

      {/* Month Mode Days Difference Warning */}
      {monthModeMismatchInfo?.isMismatch && (
        <div className="warning-banner no-print">
          <span className="warning-icon">ℹ️</span>
          <div>
            Note: Period A covers {monthModeMismatchInfo.daysA} recorded days while Period B covers {monthModeMismatchInfo.daysB} recorded days.
          </div>
        </div>
      )}

      {/* 3. Result Card */}
      {comparisonData && (
        <div className="result-card">
          <div className="result-card-top">
            <div>
              <h2 className="result-headline">
                {comparisonData.comparison?.headline || 'Traffic Comparison'}
              </h2>
              <div className="change-line">
                <span className={`change-badge ${comparisonData.comparison?.totalScoreChange > 0 ? 'positive' : comparisonData.comparison?.totalScoreChange < 0 ? 'negative' : 'neutral'}`}>
                  {comparisonData.comparison?.totalScoreChange > 0 ? 'Congestion Rose' : comparisonData.comparison?.totalScoreChange < 0 ? 'Traffic Improved' : 'No Change'}
                </span>
                {comparisonData.comparison?.changeLine}
              </div>
            </div>

            <div className="result-actions">
              {/* Single Data Badge with Tooltip */}
              {dataBadgeInfo && (
                <div className="data-badge-wrapper">
                  <span className={`data-badge ${dataBadgeInfo.type}`}>
                    ● {dataBadgeInfo.label}
                  </span>
                  <div className="badge-tooltip">
                    {dataBadgeInfo.tooltip}
                  </div>
                </div>
              )}

              {/* Download One-Page Summary Button */}
              <button
                type="button"
                className="download-btn no-print"
                onClick={handlePrint}
              >
                📄 Download one-page summary
              </button>
            </div>
          </div>

          <p className="plain-explanation">
            {comparisonData.comparison?.plainExplanation || comparisonData.comparison?.explanation}
          </p>
        </div>
      )}

      {/* 4. Grouped Bar Chart (Daily Profile or 4-Week Breakdown) */}
      {chartConfig && (
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">
                {activeQuery?.type === 'day'
                  ? 'Time-of-Day Traffic Profile (12 Slots)'
                  : activeQuery?.type === 'month'
                  ? (monthSubView === 'weekly'
                      ? '4-Week Traffic Breakdown (Score vs Day of Week)'
                      : `Daily Traffic Profile (Day 1–${chartConfig.data.labels.length})`)
                  : 'Monthly Traffic Progression (Jan–Dec)'}
              </h3>
            </div>
            <span className="chart-legend-hint">
              Shaded horizontal bands: Low (0–35), Medium (36–60), High (61–100)
            </span>
          </div>

          {/* Month Sub-View Controls: Daily vs 4-Week Breakdown */}
          {activeQuery?.type === 'month' && (
            <div className="month-subview-bar no-print">
              <div className="subview-segmented-control">
                <button
                  type="button"
                  className={`subview-btn ${monthSubView === 'daily' ? 'active' : ''}`}
                  onClick={() => setMonthSubView('daily')}
                >
                  📅 Daily View (Score vs Day)
                </button>
                <button
                  type="button"
                  className={`subview-btn ${monthSubView === 'weekly' ? 'active' : ''}`}
                  onClick={() => setMonthSubView('weekly')}
                >
                  📊 4-Week Breakdown (Score vs Day of Week)
                </button>
              </div>

              {monthSubView === 'weekly' && (
                <div className="week-tabs">
                  <button
                    type="button"
                    className={`week-tab-btn ${selectedWeekTab === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedWeekTab('all')}
                  >
                    All 4 Weeks
                  </button>
                  {[1, 2, 3, 4].map(wId => (
                    <button
                      key={wId}
                      type="button"
                      className={`week-tab-btn ${selectedWeekTab === wId ? 'active' : ''}`}
                      onClick={() => setSelectedWeekTab(wId)}
                    >
                      Week {wId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chart Rendering */}
          {activeQuery?.type === 'month' && monthSubView === 'weekly' && weeklyChartsConfig ? (
            selectedWeekTab === 'all' ? (
              <div className="weekly-grid">
                {weeklyChartsConfig.map(week => (
                  <div key={week.id} className="week-card">
                    <div className="week-card-header">
                      <h4 className="week-card-title">{week.label} ({week.sublabel})</h4>
                      {week.hasRemaining && (
                        <span className="week-card-note">Includes days 29–31</span>
                      )}
                    </div>
                    <div className="weekly-chart-wrapper">
                      <Bar
                        data={week.chartData}
                        options={weeklyChartOptions}
                        plugins={chartPlugins}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (() => {
                const week = weeklyChartsConfig.find(w => w.id === selectedWeekTab);
                if (!week) return null;
                return (
                  <div className="single-week-container">
                    <div className="week-card-header">
                      <h4 className="week-card-title">{week.label} ({week.sublabel})</h4>
                      {week.hasRemaining && (
                        <span className="week-card-note">Includes days 29–31</span>
                      )}
                    </div>
                    <div className="chart-wrapper">
                      <Bar
                        data={week.chartData}
                        options={weeklyChartOptions}
                        plugins={chartPlugins}
                      />
                    </div>
                  </div>
                );
              })()
            )
          ) : (
            <div className="chart-wrapper">
              <Bar
                data={chartConfig.data}
                options={chartConfig.options}
                plugins={chartPlugins}
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Toggle: Show Contributing Factors */}
      {comparisonData && (
        <>
          <div className="toggle-wrapper no-print">
            <span className="toggle-label">Show contributing factors</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showFactors}
                onChange={(e) => setShowFactors(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Contributing Factors Panel */}
          {showFactors && factorPanelData && (
            <div className="factors-card">
              <h3 className="factors-heading">Contributing Factors</h3>

              <table className="context-table">
                <thead>
                  <tr>
                    <th>Factor Indicator</th>
                    <th>Period A ({formatPeriodLabel(comparisonData.reportA?.periodKey, activeQuery?.type)})</th>
                    <th>Period B ({formatPeriodLabel(comparisonData.reportB?.periodKey, activeQuery?.type)})</th>
                  </tr>
                </thead>
                <tbody>
                  {factorPanelData.contextRows.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.label}</strong></td>
                      <td>{row.valA}</td>
                      <td>{row.valB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Separate Visual Factor Contribution Donut Charts for Period A and Period B */}
              {factorsChartData && (
                <div className="factors-chart-section">
                  <div className="factors-chart-header">
                    <h4 className="factors-chart-title">Visual Factor Breakdown (Period A vs Period B)</h4>
                    <span className="factors-chart-subtitle">
                      Comparative factor composition and congestion pressure for each period
                    </span>
                  </div>

                  <div className="dual-factors-grid">
                    {/* Period A Card */}
                    <div className="period-factor-card">
                      <div className="period-factor-header">
                        <span className="period-tag tag-a">Period A</span>
                        <h5 className="period-factor-title">
                          {formatPeriodLabel(factorsChartData.periodA.report?.periodKey, activeQuery?.type)}
                        </h5>
                      </div>

                      {factorsChartData.periodA.chartData ? (
                        <>
                          <div className="factors-doughnut-wrapper">
                            <Doughnut
                              data={factorsChartData.periodA.chartData}
                              options={factorsChartData.options}
                            />
                            <div className="doughnut-center-label">
                              <span className="doughnut-center-val">
                                {factorsChartData.periodA.report?.avgScore}
                              </span>
                              <span className="doughnut-center-text">avg score</span>
                            </div>
                          </div>

                          <div className="factors-legend-list">
                            {factorsChartData.periodA.items.map((item, idx) => (
                              <div key={idx} className="factor-legend-item">
                                <div className="factor-color-dot" style={{ backgroundColor: item.color }} />
                                <div className="factor-legend-text">
                                  <span className="factor-legend-name">{item.label}</span>
                                  <span className="factor-legend-val">{item.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="no-factor-msg">No major factor pressure recorded</div>
                      )}
                    </div>

                    {/* Period B Card */}
                    <div className="period-factor-card">
                      <div className="period-factor-header">
                        <span className="period-tag tag-b">Period B</span>
                        <h5 className="period-factor-title">
                          {formatPeriodLabel(factorsChartData.periodB.report?.periodKey, activeQuery?.type)}
                        </h5>
                      </div>

                      {factorsChartData.periodB.chartData ? (
                        <>
                          <div className="factors-doughnut-wrapper">
                            <Doughnut
                              data={factorsChartData.periodB.chartData}
                              options={factorsChartData.options}
                            />
                            <div className="doughnut-center-label">
                              <span className="doughnut-center-val">
                                {factorsChartData.periodB.report?.avgScore}
                              </span>
                              <span className="doughnut-center-text">avg score</span>
                            </div>
                          </div>

                          <div className="factors-legend-list">
                            {factorsChartData.periodB.items.map((item, idx) => (
                              <div key={idx} className="factor-legend-item">
                                <div className="factor-color-dot" style={{ backgroundColor: item.color }} />
                                <div className="factor-legend-text">
                                  <span className="factor-legend-name">{item.label}</span>
                                  <span className="factor-legend-val">{item.percentage}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="no-factor-msg">No major factor pressure recorded</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Print-Only Footer */}
      <div className="print-footer" style={{ display: 'none' }}>
        <div className="print-footer-row">
          <span>Data Classification: <strong>{dataBadgeInfo?.label || 'Historical'}</strong></span>
          <span>Formula Engine: <strong>v1.0</strong></span>
          <span>Generated: <strong>{new Date().toISOString().slice(0, 10)}</strong></span>
        </div>
        <div className="print-disclaimer">
          Decision-support analysis. Review by a qualified traffic engineer before acting.
        </div>
      </div>

      {/* Empty / Initial State */}
      {!comparisonData && !loading && (
        <div className="state-message">
          Select a route, choose a comparison period, and click <strong>Compare</strong> to generate the traffic report.
        </div>
      )}
    </div>
  );
}
