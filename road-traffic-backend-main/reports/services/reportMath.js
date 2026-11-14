export const FORMULA_VERSION = 'v1.0';

export const TIME_SLOTS = [
  '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
  '12-14', '14-16', '16-18', '18-20', '20-22', '22-24'
];

export const OBSTACLE_FACTORS = [
  'construction', 'diversion', 'event', 'hotspot',
  'pothole', 'complaint', 'weather', 'transit', 'metro', 'festival'
];

export const OBSTACLE_WEIGHT = 0.35; // 70% backend * 100/200 max = 0.35
export const GOOGLE_WEIGHT = 0.30;
export const HISTORICAL_WEIGHT = 0.35;

// Named configuration thresholds
export const ABOUT_THE_SAME_THRESHOLD = 2.0;

export const LEVEL_THRESHOLDS = {
  veryLow: 15,
  low: 35,
  medium: 60,
  high: 85,
  veryHigh: 100
};

export const TIME_OF_DAY_BUCKETS = [
  { key: 'night', label: 'night (00:00–06:00)', slots: ['00-02', '02-04', '04-06'] },
  { key: 'early_morning', label: 'early morning (06:00–08:00)', slots: ['06-08'] },
  { key: 'morning_rush', label: 'morning rush (08:00–12:00)', slots: ['08-10', '10-12'] },
  { key: 'midday', label: 'midday (12:00–16:00)', slots: ['12-14', '14-16'] },
  { key: 'evening_rush', label: 'evening rush (16:00–20:00)', slots: ['16-18', '18-20'] },
  { key: 'late_evening', label: 'late evening (20:00–24:00)', slots: ['20-22', '22-24'] }
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export function getTrafficLevelName(score) {
  if (score <= LEVEL_THRESHOLDS.veryLow) return 'Very Low';
  if (score <= LEVEL_THRESHOLDS.low) return 'Low';
  if (score <= LEVEL_THRESHOLDS.medium) return 'Medium';
  if (score <= LEVEL_THRESHOLDS.high) return 'High';
  return 'Very High';
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getTimeMultiplier(timeSlot) {
  if (!timeSlot) return 1.0;
  const hour = parseInt(timeSlot.split('-')[0], 10);
  if (hour >= 0 && hour < 6) return 0.3;   // Night: Very Low
  if (hour >= 6 && hour < 8) return 0.7;   // Early Morning
  if (hour >= 8 && hour < 11) return 1.5;  // Morning Rush
  if (hour >= 11 && hour < 16) return 1.0; // Midday Normal
  if (hour >= 16 && hour < 20) return 1.8; // Evening Rush (Peak)
  if (hour >= 20 && hour <= 23) return 0.6; // Late Evening
  return 1.0;
}

export function createEmptyGrid() {
  const grid = {};
  for (let weekday = 0; weekday < 7; weekday++) {
    grid[weekday] = {};
    for (const slot of TIME_SLOTS) {
      grid[weekday][slot] = {
        scoreSum: 0,
        count: 0,
        googleSum: 0,
        historicalSum: 0,
        factorSums: Object.fromEntries(OBSTACLE_FACTORS.map(f => [f, 0])),
        factorCounts: Object.fromEntries(OBSTACLE_FACTORS.map(f => [f, 0]))
      };
    }
  }
  return grid;
}

export function buildDayReport(records, options = {}) {
  if (!records || records.length === 0) {
    throw new Error('Cannot build report from empty records');
  }

  const firstRec = records[0];
  const pathId = options.pathId || firstRec.pathId;
  const rawDate = firstRec.date instanceof Date ? firstRec.date : new Date(firstRec.date);
  const dateStr = options.dateStr || rawDate.toISOString().slice(0, 10);
  const weekday = rawDate.getUTCDay();

  const grid = createEmptyGrid();
  let totalScoreSum = 0;
  const levelCounts = { low: 0, medium: 0, high: 0, veryHigh: 0, veryLow: 0 };
  const sourceCounts = { simulated: 0, computed: 0, reconstructed: 0 };

  const contextData = {
    constructionActive: 0,
    diversions: 0,
    festivals: new Set(),
    eventCount: 0,
    rainyDays: 0
  };

  let hasRain = false;
  let breakdownRecordCount = 0;

  for (const record of records) {
    const score = Number(record.score) || 0;
    totalScoreSum += score;

    // Traffic level mapping
    const levelKey = (record.level || 'medium').toLowerCase().replace(/\s+/g, '');
    if (levelKey === 'verylow') levelCounts.veryLow++;
    else if (levelKey === 'veryhigh') levelCounts.veryHigh++;
    else if (levelKey === 'low') levelCounts.low++;
    else if (levelKey === 'high') levelCounts.high++;
    else levelCounts.medium++;

    // Data Source classification
    // Records without 'source' count as 'simulated' per Data Rule 1
    const src = record.source || 'simulated';
    if (src === 'computed') sourceCounts.computed++;
    else if (src === 'reconstructed') sourceCounts.reconstructed++;
    else sourceCounts.simulated++;

    const slot = record.timeRange;
    if (grid[weekday] && grid[weekday][slot]) {
      const cell = grid[weekday][slot];
      cell.scoreSum += score;
      cell.count += 1;

      if (record.breakdown) {
        breakdownRecordCount++;
        const bd = record.breakdown;
        for (const factor of OBSTACLE_FACTORS) {
          if (typeof bd[factor] === 'number') {
            cell.factorSums[factor] += bd[factor];
            cell.factorCounts[factor] += 1;
          }
        }
        if (typeof bd.googleScore === 'number') cell.googleSum += bd.googleScore;
        if (typeof bd.historyScore === 'number') cell.historicalSum += bd.historyScore;

        const cCount = bd.constructionCount || (bd.construction > 0 ? 1 : 0);
        if (cCount > contextData.constructionActive) contextData.constructionActive = cCount;

        const dCount = bd.diversionCount || (bd.diversion > 0 ? 1 : 0);
        if (dCount > contextData.diversions) contextData.diversions = dCount;

        const eCount = bd.eventCount || (bd.event > 0 ? 1 : 0);
        if (eCount > contextData.eventCount) contextData.eventCount = eCount;

        if (bd.festivalName) contextData.festivals.add(bd.festivalName);
        if (bd.weatherCondition && bd.weatherCondition.toLowerCase().includes('rain')) {
          hasRain = true;
        }
      }
    }
  }

  if (hasRain) contextData.rainyDays = 1;

  const recordCount = records.length;
  const coveragePct = Math.min(100, Math.round((recordCount / 12) * 1000) / 10);
  const avgScore = Math.round((totalScoreSum / recordCount) * 100) / 100;

  // Busiest slot on this day
  let busiestSlot = TIME_SLOTS[0];
  let maxSlotScore = -1;
  for (const slot of TIME_SLOTS) {
    const cell = grid[weekday][slot];
    if (cell.count > 0) {
      const cellAvg = cell.scoreSum / cell.count;
      if (cellAvg > maxSlotScore) {
        maxSlotScore = cellAvg;
        busiestSlot = slot;
      }
    }
  }

  const sourceMix = {
    simulated: Math.round((sourceCounts.simulated / recordCount) * 1000) / 10,
    computed: Math.round((sourceCounts.computed / recordCount) * 1000) / 10,
    reconstructed: Math.round((sourceCounts.reconstructed / recordCount) * 1000) / 10
  };

  const dailyAvgs = [
    { date: dateStr, avgScore, count: recordCount }
  ];

  const report = {
    pathId,
    periodType: 'day',
    periodKey: dateStr,
    start: `${dateStr}T00:00:00.000Z`,
    end: `${dateStr}T23:59:59.999Z`,
    isPartial: coveragePct < 80,
    coveragePct,
    formulaVersion: FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
    recordCount,
    sourceMix,
    avgScore,
    levelCounts,
    bestDay: dateStr,
    worstDay: dateStr,
    busiestSlot,
    grid,
    dailyAvgs,
    context: {
      constructionActive: contextData.constructionActive,
      diversions: contextData.diversions,
      festivals: Array.from(contextData.festivals),
      eventCount: contextData.eventCount,
      rainyDays: contextData.rainyDays
    },
    summaryText: `Day report for ${dateStr} on ${pathId}: average score ${avgScore} across ${recordCount} time slots (coverage ${coveragePct}%).`
  };

  return report;
}

export function mergeReports(reports, targetPeriodType, targetPeriodKey, options = {}) {
  if (!reports || reports.length === 0) {
    throw new Error('Cannot merge an empty array of reports');
  }

  const pathId = options.pathId || reports[0].pathId;
  const formulaVersion = reports[0].formulaVersion || FORMULA_VERSION;

  for (const r of reports) {
    if (r.formulaVersion !== formulaVersion) {
      throw new Error(`Formula version mismatch: ${r.formulaVersion} vs ${formulaVersion}`);
    }
  }

  const grid = createEmptyGrid();
  let totalScoreSum = 0;
  let totalRecordCount = 0;

  const levelCounts = { low: 0, medium: 0, high: 0, veryHigh: 0, veryLow: 0 };
  const sourceCountAccum = { simulated: 0, computed: 0, reconstructed: 0 };

  const festivalsSet = new Set();
  let totalConstruction = 0;
  let totalDiversions = 0;
  let totalEvents = 0;
  let totalRainyDays = 0;

  const dailyAvgsMap = new Map();

  let earliestStart = reports[0].start;
  let latestEnd = reports[0].end;

  for (const r of reports) {
    if (r.start < earliestStart) earliestStart = r.start;
    if (r.end > latestEnd) latestEnd = r.end;

    totalRecordCount += r.recordCount;
    totalScoreSum += r.avgScore * r.recordCount;

    // Level counts
    for (const lvl of ['low', 'medium', 'high', 'veryHigh', 'veryLow']) {
      levelCounts[lvl] += (r.levelCounts?.[lvl] || 0);
    }

    // Source mix counts
    sourceCountAccum.simulated += (r.sourceMix.simulated / 100) * r.recordCount;
    sourceCountAccum.computed += (r.sourceMix.computed / 100) * r.recordCount;
    sourceCountAccum.reconstructed += (r.sourceMix.reconstructed / 100) * r.recordCount;

    // Context facts
    if (r.context) {
      totalConstruction += (r.context.constructionActive || 0);
      totalDiversions += (r.context.diversions || 0);
      totalEvents += (r.context.eventCount || 0);
      totalRainyDays += (r.context.rainyDays || 0);
      if (Array.isArray(r.context.festivals)) {
        r.context.festivals.forEach(f => festivalsSet.add(f));
      }
    }

    // Daily averages
    if (Array.isArray(r.dailyAvgs)) {
      for (const da of r.dailyAvgs) {
        if (!dailyAvgsMap.has(da.date)) {
          dailyAvgsMap.set(da.date, { date: da.date, totalScore: da.avgScore * da.count, count: da.count });
        } else {
          const entry = dailyAvgsMap.get(da.date);
          entry.totalScore += da.avgScore * da.count;
          entry.count += da.count;
        }
      }
    }

    // Merge grid cells
    for (let weekday = 0; weekday < 7; weekday++) {
      for (const slot of TIME_SLOTS) {
        const targetCell = grid[weekday][slot];
        const sourceCell = r.grid?.[weekday]?.[slot];
        if (sourceCell) {
          targetCell.scoreSum += sourceCell.scoreSum || 0;
          targetCell.count += sourceCell.count || 0;
          targetCell.googleSum += sourceCell.googleSum || 0;
          targetCell.historicalSum += sourceCell.historicalSum || 0;
          for (const factor of OBSTACLE_FACTORS) {
            targetCell.factorSums[factor] += sourceCell.factorSums?.[factor] || 0;
            targetCell.factorCounts[factor] += sourceCell.factorCounts?.[factor] || 0;
          }
        }
      }
    }
  }

  const avgScore = totalRecordCount > 0 ? Math.round((totalScoreSum / totalRecordCount) * 100) / 100 : 0;

  const sourceMix = {
    simulated: totalRecordCount > 0 ? Math.round((sourceCountAccum.simulated / totalRecordCount) * 1000) / 10 : 0,
    computed: totalRecordCount > 0 ? Math.round((sourceCountAccum.computed / totalRecordCount) * 1000) / 10 : 0,
    reconstructed: totalRecordCount > 0 ? Math.round((sourceCountAccum.reconstructed / totalRecordCount) * 1000) / 10 : 0
  };

  const dailyAvgs = Array.from(dailyAvgsMap.values())
    .map(e => ({ date: e.date, avgScore: Math.round((e.totalScore / e.count) * 100) / 100, count: e.count }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  // Determine bestDay and worstDay from dailyAvgs
  let bestDay = null;
  let worstDay = null;
  if (dailyAvgs.length > 0) {
    let minScore = Infinity;
    let maxScore = -Infinity;
    for (const d of dailyAvgs) {
      if (d.avgScore < minScore) {
        minScore = d.avgScore;
        bestDay = d.date;
      }
      if (d.avgScore > maxScore) {
        maxScore = d.avgScore;
        worstDay = d.date;
      }
    }
  }

  // Determine busiestSlot from aggregated grid
  let busiestSlot = TIME_SLOTS[0];
  let maxSlotScore = -1;
  for (const slot of TIME_SLOTS) {
    let slotScoreSum = 0;
    let slotCount = 0;
    for (let weekday = 0; weekday < 7; weekday++) {
      slotScoreSum += grid[weekday][slot].scoreSum;
      slotCount += grid[weekday][slot].count;
    }
    if (slotCount > 0) {
      const slotAvg = slotScoreSum / slotCount;
      if (slotAvg > maxSlotScore) {
        maxSlotScore = slotAvg;
        busiestSlot = slot;
      }
    }
  }

  // Coverage percentage computation based on expected days in period
  let expectedDays = dailyAvgs.length;
  if (targetPeriodType === 'month') {
    expectedDays = 30; // Approx standard month days
  } else if (targetPeriodType === 'year') {
    expectedDays = 365;
  }
  const expectedRecords = expectedDays * 12;
  const coveragePct = Math.min(100, Math.round((totalRecordCount / expectedRecords) * 1000) / 10);

  return {
    pathId,
    periodType: targetPeriodType,
    periodKey: targetPeriodKey,
    start: earliestStart,
    end: latestEnd,
    isPartial: coveragePct < 80,
    coveragePct,
    formulaVersion,
    generatedAt: new Date().toISOString(),
    recordCount: totalRecordCount,
    sourceMix,
    avgScore,
    levelCounts,
    bestDay,
    worstDay,
    busiestSlot,
    grid,
    dailyAvgs,
    context: {
      constructionActive: totalConstruction,
      diversions: totalDiversions,
      festivals: Array.from(festivalsSet),
      eventCount: totalEvents,
      rainyDays: totalRainyDays
    },
    summaryText: `${targetPeriodType.toUpperCase()} report ${targetPeriodKey} for ${pathId}: average score ${avgScore} across ${totalRecordCount} records (coverage ${coveragePct}%).`
  };
}

export function compareReports(a, b) {
  if (!a || !b) {
    throw new Error('Both report A and report B are required for comparison');
  }

  if (a.formulaVersion !== b.formulaVersion) {
    throw new Error(
      `Cannot compare reports with different formula versions: "${a.formulaVersion}" vs "${b.formulaVersion}"`
    );
  }

  const totalScoreChange = Math.round((b.avgScore - a.avgScore) * 100) / 100;

  // Identify shared cells across grid (weekday x slot)
  let sharedCells = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (const slot of TIME_SLOTS) {
      const cellA = a.grid?.[weekday]?.[slot];
      const cellB = b.grid?.[weekday]?.[slot];
      if (cellA && cellB && cellA.count > 0 && cellB.count > 0) {
        sharedCells.push({ weekday, slot, cellA, cellB });
      }
    }
  }

  // Fallback to slot-level comparison if comparing two single days from different weekdays
  if (sharedCells.length === 0) {
    for (const slot of TIME_SLOTS) {
      let foundA = null;
      let foundB = null;
      for (let w = 0; w < 7; w++) {
        if (!foundA && a.grid?.[w]?.[slot]?.count > 0) foundA = a.grid[w][slot];
        if (!foundB && b.grid?.[w]?.[slot]?.count > 0) foundB = b.grid[w][slot];
      }
      if (foundA && foundB) {
        sharedCells.push({ weekday: -1, slot, cellA: foundA, cellB: foundB });
      }
    }
  }

  const factorContributions = {};
  for (const factor of OBSTACLE_FACTORS) {
    factorContributions[factor] = 0;
  }
  let googleContribution = 0;
  let historicalContribution = 0;

  const N = sharedCells.length;

  if (N > 0) {
    let sumGoogleContrib = 0;
    let sumHistoricalContrib = 0;
    const sumFactorContrib = Object.fromEntries(OBSTACLE_FACTORS.map(f => [f, 0]));

    for (const { slot, cellA, cellB } of sharedCells) {
      const mult = getTimeMultiplier(slot);

      // Google contribution: 0.3 * delta_google
      const avgGoogleA = cellA.googleSum / cellA.count;
      const avgGoogleB = cellB.googleSum / cellB.count;
      sumGoogleContrib += (avgGoogleB - avgGoogleA) * GOOGLE_WEIGHT;

      // Historical contribution: 0.35 * delta_hist
      const avgHistA = cellA.historicalSum / cellA.count;
      const avgHistB = cellB.historicalSum / cellB.count;
      sumHistoricalContrib += (avgHistB - avgHistA) * HISTORICAL_WEIGHT;

      // Obstacle factors: timeMultiplier(slot) * delta_factor * obstacleWeight
      for (const factor of OBSTACLE_FACTORS) {
        const countA = cellA.factorCounts?.[factor] || cellA.count;
        const countB = cellB.factorCounts?.[factor] || cellB.count;
        const avgFactorA = countA > 0 ? (cellA.factorSums[factor] / countA) : 0;
        const avgFactorB = countB > 0 ? (cellB.factorSums[factor] / countB) : 0;
        const deltaFactor = avgFactorB - avgFactorA;
        sumFactorContrib[factor] += mult * deltaFactor * OBSTACLE_WEIGHT;
      }
    }

    googleContribution = Math.round((sumGoogleContrib / N) * 100) / 100;
    historicalContribution = Math.round((sumHistoricalContrib / N) * 100) / 100;
    for (const factor of OBSTACLE_FACTORS) {
      factorContributions[factor] = Math.round((sumFactorContrib[factor] / N) * 100) / 100;
    }
  }

  // Calculate sum of all explicit factor contributions
  let explainedSum = googleContribution + historicalContribution;
  for (const factor of OBSTACLE_FACTORS) {
    explainedSum += factorContributions[factor];
  }

  // Remainder: capping, non-linear normalization, correction offset, or unshared cell variance
  const remainder = Math.round((totalScoreChange - explainedSum) * 100) / 100;

  // Breakdown line items
  const lines = [
    { name: 'google', contribution: googleContribution, label: 'Google Live Traffic' },
    { name: 'historical', contribution: historicalContribution, label: 'Historical Trend' },
    ...OBSTACLE_FACTORS.map(factor => ({
      name: factor,
      contribution: factorContributions[factor],
      label: factor.charAt(0).toUpperCase() + factor.slice(1)
    })),
    { name: 'remainder', contribution: remainder, label: 'Capping/Offset/Other' }
  ];

  // Verify that all lines sum EXACTLY to totalScoreChange
  const sumOfLines = Math.round(lines.reduce((acc, l) => acc + l.contribution, 0) * 100) / 100;

  // Rule 7 Text generation (Deterministic)
  const isIncrease = totalScoreChange > 0;
  const isDecrease = totalScoreChange < 0;
  const directionText = isIncrease
    ? `increased by ${Math.abs(totalScoreChange)} points`
    : isDecrease
    ? `decreased by ${Math.abs(totalScoreChange)} points`
    : 'remained virtually unchanged (0 points difference)';

  const bothLowSimulated = (a.sourceMix.simulated < 20) && (b.sourceMix.simulated < 20);

  let largestFactorText = '';
  if (bothLowSimulated) {
    // Find largest absolute obstacle/google contributor
    const nonRemainder = lines.filter(l => l.name !== 'remainder');
    nonRemainder.sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
    const top = nonRemainder[0];
    if (top && Math.abs(top.contribution) > 0.05) {
      largestFactorText = ` The largest contributing factor was ${top.label} (${top.contribution >= 0 ? '+' : ''}${top.contribution} points contributed under the current scoring formula).`;
    }
  } else {
    const facts = [];
    if (b.context?.festivals?.length > 0) facts.push(`festivals [${b.context.festivals.join(', ')}]`);
    if (b.context?.constructionActive > 0) facts.push(`${pluralize(b.context.constructionActive, 'active construction site')}`);
    if (b.context?.rainyDays > 0) facts.push(`${pluralize(b.context.rainyDays, 'rainy day')}`);
    if (b.context?.eventCount > 0) facts.push(`${pluralize(b.context.eventCount, 'recorded event')}`);
    const factsStr = facts.length > 0 ? facts.join(', ') : 'normal traffic indicators';
    largestFactorText = ` Demo data: shown for reference, not as the cause of the change. Facts for period: ${factsStr}.`;
  }

  // Check period length in weeks
  const startA = new Date(a.start).getTime();
  const endA = new Date(a.end).getTime();
  const weeksA = (endA - startA) / (1000 * 60 * 60 * 24 * 7);

  const startB = new Date(b.start).getTime();
  const endB = new Date(b.end).getTime();
  const weeksB = (endB - startB) / (1000 * 60 * 60 * 24 * 7);

  const lowConfidenceNotes = [];
  if (a.coveragePct < 80 || b.coveragePct < 80) {
    lowConfidenceNotes.push('data coverage is below 80%');
  }
  if ((a.periodType !== 'day' && weeksA < 8) || (b.periodType !== 'day' && weeksB < 8)) {
    lowConfidenceNotes.push('observation period is under 8 weeks');
  }

  let confidenceNote = '';
  if (lowConfidenceNotes.length > 0) {
    confidenceNote = ` Note (low confidence): ${lowConfidenceNotes.join(' and ')}.`;
  }

  const explanation = `Between ${a.periodKey} and ${b.periodKey}, the average traffic score on route ${a.pathId} ${directionText}.${largestFactorText}${confidenceNote}`;

  // Generate plain explanation for PMC officers
  const plainResult = generatePlainExplanation(a, b, { totalScoreChange, ...a }, a.periodType);

  return {
    pathId: a.pathId,
    periodType: a.periodType,
    periodA: a.periodKey,
    periodB: b.periodKey,
    formulaVersion: a.formulaVersion,
    scoreA: a.avgScore,
    scoreB: b.avgScore,
    totalScoreChange,
    sharedCellsCount: N,
    factorContributions,
    googleContribution,
    historicalContribution,
    remainder,
    lines,
    sumOfLines,
    bothLowSimulated,
    confidenceNote,
    explanation,
    headline: plainResult.headline,
    changeLine: plainResult.changeLine,
    plainExplanation: plainResult.explanation
  };
}

/**
 * Pure function to compute typical reference profile from in-memory reports
 * (0 DB calls, works strictly on loaded report objects)
 */
export function typicalProfile(reports, periodType = 'day') {
  if (!Array.isArray(reports) || reports.length === 0) {
    return periodType === 'day' ? {} : {};
  }

  if (periodType === 'day') {
    // 12 time-slot averages across all reports
    const slotSums = Object.fromEntries(TIME_SLOTS.map(s => [s, { sum: 0, count: 0 }]));
    for (const r of reports) {
      if (!r || !r.grid) continue;
      for (let w = 0; w < 7; w++) {
        const row = r.grid[w];
        if (!row) continue;
        for (const s of TIME_SLOTS) {
          const cell = row[s];
          if (cell && cell.count > 0) {
            slotSums[s].sum += cell.scoreSum;
            slotSums[s].count += cell.count;
          }
        }
      }
    }
    const result = {};
    for (const s of TIME_SLOTS) {
      result[s] = slotSums[s].count > 0
        ? Math.round((slotSums[s].sum / slotSums[s].count) * 100) / 100
        : null;
    }
    return result;
  } else {
    // Month mode: 7 weekday averages (0..6 Sun..Sat)
    const weekdaySums = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
    for (const r of reports) {
      if (!r || !r.grid) continue;
      for (let w = 0; w < 7; w++) {
        const row = r.grid[w];
        if (!row) continue;
        for (const s of TIME_SLOTS) {
          const cell = row[s];
          if (cell && cell.count > 0) {
            weekdaySums[w].sum += cell.scoreSum;
            weekdaySums[w].count += cell.count;
          }
        }
      }
    }
    const result = {};
    for (let w = 0; w < 7; w++) {
      result[w] = weekdaySums[w].count > 0
        ? Math.round((weekdaySums[w].sum / weekdaySums[w].count) * 100) / 100
        : null;
    }
    return result;
  }
}

export function formatPeriodLabel(key, type) {
  if (!key) return '';
  if (type === 'month') {
    const parts = key.split('-');
    if (parts.length === 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${MONTH_NAMES[mIdx] || parts[1]} ${parts[0]}`;
    }
  } else if (type === 'year') {
    return key;
  } else if (type === 'day') {
    return key;
  }
  return key;
}

export function getYearMonthlyAverages(report) {
  const monthSums = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
  if (Array.isArray(report?.dailyAvgs)) {
    for (const d of report.dailyAvgs) {
      const parts = d.date.split('-');
      if (parts.length >= 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          monthSums[mIdx].sum += d.avgScore * d.count;
          monthSums[mIdx].count += d.count;
        }
      }
    }
  }
  return monthSums.map(m => m.count > 0 ? Math.round((m.sum / m.count) * 100) / 100 : null);
}

export function getYearMonthsList(report) {
  const months = new Set();
  if (Array.isArray(report?.dailyAvgs)) {
    for (const d of report.dailyAvgs) {
      const parts = d.date.split('-');
      if (parts.length >= 2) {
        months.add(parts[1]);
      }
    }
  }
  return Array.from(months).sort();
}

/**
 * Generates 2-3 sentence plain language explanation for PMC officers
 * (No factor attribution names, no 'caused', clean pluralization, honest confidence notes)
 */
export function generatePlainExplanation(a, b, comparison, periodType = a.periodType) {
  const delta = typeof comparison?.totalScoreChange === 'number'
    ? comparison.totalScoreChange
    : Math.round((b.avgScore - a.avgScore) * 100) / 100;
  const absDelta = Math.abs(delta);

  const aLabel = formatPeriodLabel(a.periodKey, periodType);
  const bLabel = formatPeriodLabel(b.periodKey, periodType);

  // 1. Direction and size
  let directionSentence = '';
  let headline = '';
  if (absDelta < ABOUT_THE_SAME_THRESHOLD) {
    headline = `Traffic was about the same in ${bLabel} as in ${aLabel}`;
    directionSentence = `Traffic was about the same in ${bLabel} as in ${aLabel} (difference of ${absDelta.toFixed(1)} points).`;
  } else if (delta < 0) {
    const pct = a.avgScore > 0 ? Math.abs(Math.round((delta / a.avgScore) * 1000) / 10) : 0;
    headline = `Traffic was lower in ${bLabel} than in ${aLabel}`;
    directionSentence = `Traffic was lower in ${bLabel} than in ${aLabel} by ${absDelta.toFixed(1)} points (-${pct}%).`;
  } else {
    const pct = a.avgScore > 0 ? Math.round((delta / a.avgScore) * 1000) / 10 : 0;
    headline = `Traffic was higher in ${bLabel} than in ${aLabel}`;
    directionSentence = `Traffic was higher in ${bLabel} than in ${aLabel} by ${absDelta.toFixed(1)} points (+${pct}%).`;
  }

  // 2. Part of day / month with largest difference
  let differenceSentence = '';
  if (periodType === 'day' || periodType === 'month') {
    let maxBucketDelta = 0;
    let maxBucket = null;

    for (const bucket of TIME_OF_DAY_BUCKETS) {
      let sumA = 0, countA = 0;
      let sumB = 0, countB = 0;
      for (const slot of bucket.slots) {
        for (let w = 0; w < 7; w++) {
          const cellA = a.grid?.[w]?.[slot];
          if (cellA && cellA.count > 0) {
            sumA += cellA.scoreSum;
            countA += cellA.count;
          }
          const cellB = b.grid?.[w]?.[slot];
          if (cellB && cellB.count > 0) {
            sumB += cellB.scoreSum;
            countB += cellB.count;
          }
        }
      }
      if (countA > 0 && countB > 0) {
        const avgA = sumA / countA;
        const avgB = sumB / countB;
        const bDelta = avgB - avgA;
        if (Math.abs(bDelta) > Math.abs(maxBucketDelta)) {
          maxBucketDelta = bDelta;
          maxBucket = bucket;
        }
      }
    }

    if (maxBucket && Math.abs(maxBucketDelta) >= 0.5) {
      const shiftDesc = maxBucketDelta >= 0 ? 'higher' : 'lower';
      differenceSentence = `The largest difference occurred during the ${maxBucket.label}, when traffic was ${Math.abs(maxBucketDelta).toFixed(1)} points ${shiftDesc} in ${bLabel}.`;
    }
  } else if (periodType === 'year') {
    const monthScoresA = getYearMonthlyAverages(a);
    const monthScoresB = getYearMonthlyAverages(b);

    let maxMonthDelta = 0;
    let maxMonthIdx = null;

    for (let m = 0; m < 12; m++) {
      if (monthScoresA[m] !== null && monthScoresB[m] !== null) {
        const mDelta = monthScoresB[m] - monthScoresA[m];
        if (Math.abs(mDelta) > Math.abs(maxMonthDelta)) {
          maxMonthDelta = mDelta;
          maxMonthIdx = m;
        }
      }
    }

    if (maxMonthIdx !== null && Math.abs(maxMonthDelta) >= 0.5) {
      const monthName = MONTH_NAMES[maxMonthIdx];
      const shiftDesc = maxMonthDelta >= 0 ? 'higher' : 'lower';
      differenceSentence = `The largest difference occurred in ${monthName}, when traffic was ${Math.abs(maxMonthDelta).toFixed(1)} points ${shiftDesc} in ${bLabel}.`;
    }
  }

  // 3. Level change sentence
  const levelA = getTrafficLevelName(a.avgScore);
  const levelB = getTrafficLevelName(b.avgScore);
  let levelSentence = '';
  if (levelA !== levelB) {
    levelSentence = `Overall congestion level shifted from ${levelA} to ${levelB}.`;
  } else {
    levelSentence = `Overall congestion remained in the ${levelA} band.`;
  }

  // 4. Confidence note
  let confidenceNote = '';
  const startA = new Date(a.start).getTime();
  const endA = new Date(a.end).getTime();
  const weeksA = (endA - startA) / (1000 * 60 * 60 * 24 * 7);

  const startB = new Date(b.start).getTime();
  const endB = new Date(b.end).getTime();
  const weeksB = (endB - startB) / (1000 * 60 * 60 * 24 * 7);

  const hasWeekdayMismatch = periodType === 'day' && (new Date(a.start).getUTCDay() !== new Date(b.start).getUTCDay());
  const hasMonthMismatch = periodType === 'year' && (getYearMonthsList(a).join(',') !== getYearMonthsList(b).join(','));

  if (periodType === 'day') {
    confidenceNote = 'Note: Single-day comparisons have lower confidence because day-to-day factors like weather and localized incidents cause short-term variance.';
  } else if (a.coveragePct < 80 || b.coveragePct < 80) {
    confidenceNote = 'Note: Data coverage is below 80% for this observation period.';
  } else if ((periodType !== 'day' && weeksA < 8) || (periodType !== 'day' && weeksB < 8)) {
    confidenceNote = 'Note: Observation period has fewer than 8 weeks of data.';
  } else if (hasWeekdayMismatch || hasMonthMismatch) {
    confidenceNote = 'Note: The compared periods have differing day-of-week or calendar mix.';
  }

  const sentences = [directionSentence];
  if (differenceSentence) sentences.push(differenceSentence);
  if (levelSentence) sentences.push(levelSentence);
  if (confidenceNote) sentences.push(confidenceNote);

  const changeLine = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points (${delta >= 0 ? '+' : ''}${a.avgScore > 0 ? ((delta / a.avgScore) * 100).toFixed(1) : '0.0'}%)  |  ${levelA} -> ${levelB}`;

  return {
    headline,
    changeLine,
    explanation: sentences.join(' '),
    confidenceNote
  };
}

/**
 * Restricts Year mode comparison to shared months
 */
export function filterSharedMonths(reportA, reportB) {
  const monthsA = new Set(getYearMonthsList(reportA));
  const monthsB = new Set(getYearMonthsList(reportB));
  const shared = new Set([...monthsA].filter(m => monthsB.has(m)));

  function filterReport(rep) {
    const filteredDaily = (rep.dailyAvgs || []).filter(d => {
      const m = d.date.split('-')[1];
      return shared.has(m);
    });
    const totalCount = filteredDaily.reduce((acc, d) => acc + d.count, 0);
    const totalSum = filteredDaily.reduce((acc, d) => acc + d.avgScore * d.count, 0);
    const avgScore = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : rep.avgScore;
    return {
      ...rep,
      dailyAvgs: filteredDaily,
      recordCount: totalCount,
      avgScore,
      isRestrictedShared: true,
      sharedMonths: Array.from(shared).sort()
    };
  }

  return {
    reportA: filterReport(reportA),
    reportB: filterReport(reportB),
    sharedMonths: Array.from(shared).sort()
  };
}
