import assert from 'assert';
import {
  buildDayReport,
  mergeReports,
  compareReports,
  TIME_SLOTS,
  OBSTACLE_WEIGHT,
  getTimeMultiplier,
  FORMULA_VERSION
} from '../services/reportMath.js';

console.log('Running pure in-memory test suite for reportMath...');

function makeDayRecords(dateStr, baseScore = 30, constructionVal = 0, source = 'computed') {
  return TIME_SLOTS.map(slot => ({
    pathId: 'Route-A',
    timeRange: slot,
    date: new Date(`${dateStr}T12:00:00.000Z`),
    score: baseScore,
    level: baseScore > 50 ? 'high' : 'medium',
    source,
    breakdown: {
      construction: constructionVal,
      diversion: 0,
      event: 0,
      hotspot: 5,
      pothole: 2,
      complaint: 1,
      weather: 0,
      transit: 0,
      metro: 0,
      festival: 0,
      googleScore: 40,
      historyScore: 35,
      constructionCount: constructionVal > 0 ? 1 : 0
    }
  }));
}

// Test 1: Self-comparison gives zeros
{
  console.log('Test 1: Comparing report with itself gives zeros...');
  const records = makeDayRecords('2026-01-01', 40, 10);
  const reportA = buildDayReport(records);
  const comp = compareReports(reportA, reportA);

  assert.strictEqual(comp.totalScoreChange, 0, 'Total score change must be 0');
  assert.strictEqual(comp.googleContribution, 0, 'Google contribution must be 0');
  assert.strictEqual(comp.historicalContribution, 0, 'Historical contribution must be 0');
  assert.strictEqual(comp.remainder, 0, 'Remainder must be 0');

  for (const [factor, val] of Object.entries(comp.factorContributions)) {
    assert.strictEqual(val, 0, `Factor ${factor} must be 0`);
  }
  console.log('  PASSED: All deltas and contributions are 0.');
}

// Test 2: Factor lines plus remainder equal the total change
{
  console.log('Test 2: Factor lines plus remainder equal the total change...');
  const recordsA = makeDayRecords('2026-01-01', 30, 5);
  const recordsB = makeDayRecords('2026-01-02', 45, 15);
  const reportA = buildDayReport(recordsA);
  const reportB = buildDayReport(recordsB);
  const comp = compareReports(reportA, reportB);

  const linesSum = comp.lines.reduce((acc, l) => acc + l.contribution, 0);
  const diff = Math.abs(linesSum - comp.totalScoreChange);
  assert(diff < 0.02, `Lines sum (${linesSum}) must equal total change (${comp.totalScoreChange})`);
  console.log(`  PASSED: Lines sum (${linesSum.toFixed(2)}) == Total Change (${comp.totalScoreChange.toFixed(2)}).`);
}

// Test 3: Planted +25 construction effect is recovered
{
  console.log('Test 3: Planted +25 construction effect is recovered...');
  const recordsA = makeDayRecords('2026-01-01', 30, 0);
  const recordsB = makeDayRecords('2026-01-02', 30, 25);
  const reportA = buildDayReport(recordsA);
  const reportB = buildDayReport(recordsB);
  const comp = compareReports(reportA, reportB);

  // Compute expected average construction contribution across the 12 shared slots:
  const expectedContribution = TIME_SLOTS.reduce((acc, slot) => {
    return acc + (getTimeMultiplier(slot) * 25 * OBSTACLE_WEIGHT);
  }, 0) / TIME_SLOTS.length;

  const roundedExpected = Math.round(expectedContribution * 100) / 100;
  assert.strictEqual(
    comp.factorContributions.construction,
    roundedExpected,
    `Construction contribution ${comp.factorContributions.construction} must match expected ${roundedExpected}`
  );
  console.log(`  PASSED: Planted +25 construction effect recovered exactly (${comp.factorContributions.construction} pts).`);
}

// Test 4: Sums merge exactly from days to month to year
{
  console.log('Test 4: Sums merge exactly from days to month to year...');
  const month1Days = [];
  const month2Days = [];

  let grandExpectedRecordCount = 0;
  let grandExpectedScoreSum = 0;

  for (let d = 1; d <= 15; d++) {
    const dayStr = `2026-01-${String(d).padStart(2, '0')}`;
    const score = 20 + d;
    const recs = makeDayRecords(dayStr, score, d);
    const dayRep = buildDayReport(recs);
    month1Days.push(dayRep);
    grandExpectedRecordCount += recs.length;
    grandExpectedScoreSum += score * recs.length;
  }

  for (let d = 1; d <= 15; d++) {
    const dayStr = `2026-02-${String(d).padStart(2, '0')}`;
    const score = 30 + d;
    const recs = makeDayRecords(dayStr, score, d + 2);
    const dayRep = buildDayReport(recs);
    month2Days.push(dayRep);
    grandExpectedRecordCount += recs.length;
    grandExpectedScoreSum += score * recs.length;
  }

  const monthReport1 = mergeReports(month1Days, 'month', '2026-01', { pathId: 'Route-A' });
  const monthReport2 = mergeReports(month2Days, 'month', '2026-02', { pathId: 'Route-A' });

  assert.strictEqual(monthReport1.recordCount, 15 * 12, 'Month 1 recordCount matches');
  assert.strictEqual(monthReport2.recordCount, 15 * 12, 'Month 2 recordCount matches');

  const yearReport = mergeReports([monthReport1, monthReport2], 'year', '2026', { pathId: 'Route-A' });

  assert.strictEqual(yearReport.recordCount, grandExpectedRecordCount, 'Year recordCount must equal sum of all days');
  
  // Verify cell sums across grid match exactly
  for (let w = 0; w < 7; w++) {
    for (const slot of TIME_SLOTS) {
      const expectedCellSum = [...month1Days, ...month2Days].reduce(
        (sum, d) => sum + (d.grid[w][slot].scoreSum || 0), 0
      );
      assert.strictEqual(
        yearReport.grid[w][slot].scoreSum,
        expectedCellSum,
        `Grid cell [${w}][${slot}] scoreSum must match exactly`
      );
    }
  }

  console.log(`  PASSED: Exact sum and record preservation verified across days -> month -> year (${grandExpectedRecordCount} records).`);
}

// Test 5: Rejects comparison of different formula versions
{
  console.log('Test 5: Formula version mismatch rejection...');
  const repA = buildDayReport(makeDayRecords('2026-01-01', 30, 0));
  const repB = { ...repA, formulaVersion: 'v0.9-legacy' };
  assert.throws(
    () => compareReports(repA, repB),
    /Cannot compare reports with different formula versions/,
    'Must refuse comparison of differing formula versions'
  );
  console.log('  PASSED: Formula version check rejects mismatch.');
}

// Test 6: Slot grouping
{
  console.log('Test 6: Slot grouping across 12 two-hourly intervals...');
  const recs = makeDayRecords('2026-01-01', 25, 0);
  const rep = buildDayReport(recs);
  assert.strictEqual(Object.keys(rep.grid[recs[0].date.getUTCDay()]).length, 12, 'Must have 12 slots');
  assert.strictEqual(rep.grid[recs[0].date.getUTCDay()]['08-10'].count, 1, 'Slot 08-10 count must be 1');
  console.log('  PASSED: 12 slot grouping verified.');
}

// Test 7: Weekday grouping
{
  console.log('Test 7: Weekday grouping across 7 days...');
  const dayReps = [];
  for (let d = 1; d <= 7; d++) {
    const dayStr = `2026-01-${String(d).padStart(2, '0')}`;
    dayReps.push(buildDayReport(makeDayRecords(dayStr, 20 + d, 0)));
  }
  const monthRep = mergeReports(dayReps, 'month', '2026-01', { pathId: 'Route-A' });
  for (let w = 0; w < 7; w++) {
    const slotCount = TIME_SLOTS.reduce((sum, s) => sum + monthRep.grid[w][s].count, 0);
    assert(slotCount > 0, `Weekday ${w} must have records`);
  }
  console.log('  PASSED: 7-day weekday grouping verified.');
}

// Test 8: 'About the same' threshold
{
  console.log('Test 8: "About the same" threshold (change < 2 points)...');
  const { ABOUT_THE_SAME_THRESHOLD, generatePlainExplanation } = await import('../services/reportMath.js');
  const repA = buildDayReport(makeDayRecords('2026-01-01', 30.0));
  const repB = buildDayReport(makeDayRecords('2026-01-02', 31.5)); // +1.5 pts (< 2)
  const comp = compareReports(repA, repB);
  const plain = generatePlainExplanation(repA, repB, comp, 'day');
  assert(comp.totalScoreChange < ABOUT_THE_SAME_THRESHOLD, 'Change is below threshold');
  assert(plain.headline.includes('about the same'), 'Headline must state "about the same"');
  console.log(`  PASSED: Threshold <= 2.0 correctly labeled as "${plain.headline}".`);
}

// Test 9: Weekday mismatch warning on Day mode
{
  console.log('Test 9: Weekday mismatch warning on Day mode...');
  const { generatePlainExplanation } = await import('../services/reportMath.js');
  const repA = buildDayReport(makeDayRecords('2026-01-03', 30)); // Saturday (getUTCDay() === 6)
  const repB = buildDayReport(makeDayRecords('2026-01-06', 40)); // Tuesday (getUTCDay() === 2)
  const comp = compareReports(repA, repB);
  const plain = generatePlainExplanation(repA, repB, comp, 'day');
  assert(plain.explanation.includes('Single-day comparisons have lower confidence'), 'Must include day confidence warning');
  console.log('  PASSED: Day mode confidence warning triggered.');
}

// Test 10: Shared-months restriction in Year mode
{
  console.log('Test 10: Shared-months restriction in Year mode...');
  const { filterSharedMonths, getYearMonthsList } = await import('../services/reportMath.js');
  const year2025 = {
    periodType: 'year',
    periodKey: '2025',
    avgScore: 35,
    dailyAvgs: [
      { date: '2025-11-01', avgScore: 32, count: 12 },
      { date: '2025-12-01', avgScore: 36, count: 12 }
    ]
  };
  const year2026 = {
    periodType: 'year',
    periodKey: '2026',
    avgScore: 40,
    dailyAvgs: [
      { date: '2026-01-01', avgScore: 38, count: 12 },
      { date: '2026-11-01', avgScore: 41, count: 12 },
      { date: '2026-12-01', avgScore: 42, count: 12 }
    ]
  };
  const { reportA, reportB, sharedMonths } = filterSharedMonths(year2025, year2026);
  assert.deepStrictEqual(sharedMonths, ['11', '12'], 'Shared months must be November and December');
  assert.strictEqual(reportA.dailyAvgs.length, 2, '2025 must keep 2 months');
  assert.strictEqual(reportB.dailyAvgs.length, 2, '2026 must be restricted to 2 months');
  console.log('  PASSED: Shared-months correctly restricted to [11, 12].');
}

// Test 11: Confidence-note triggers
{
  console.log('Test 11: Confidence-note triggers...');
  const { generatePlainExplanation } = await import('../services/reportMath.js');
  // Trigger 1: Coverage < 80%
  const repLowCoverage = {
    ...buildDayReport(makeDayRecords('2026-01-01', 30)),
    periodType: 'month',
    coveragePct: 65,
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-03-01T00:00:00.000Z'
  };
  const repNormal = {
    ...buildDayReport(makeDayRecords('2026-02-01', 30)),
    periodType: 'month',
    coveragePct: 90,
    start: '2026-02-01T00:00:00.000Z',
    end: '2026-04-01T00:00:00.000Z'
  };
  const comp = compareReports(repLowCoverage, repNormal);
  const plain = generatePlainExplanation(repLowCoverage, repNormal, comp, 'month');
  assert(plain.confidenceNote.includes('coverage is below 80%'), 'Must flag low coverage');
  console.log('  PASSED: Low coverage confidence note triggered.');
}

// Test 12: Toggle rule for simulated vs verified data
{
  console.log('Test 12: Toggle rule for simulated vs verified data...');
  // Case A: simulated >= 20%
  const repSim = buildDayReport(makeDayRecords('2026-01-01', 30, 5, 'simulated'));
  const repSim2 = buildDayReport(makeDayRecords('2026-01-02', 35, 10, 'simulated'));
  const compSim = compareReports(repSim, repSim2);
  assert.strictEqual(compSim.bothLowSimulated, false, 'Simulated >= 20% must set bothLowSimulated to false');

  // Case B: simulated < 20% (computed/verified)
  const repComp1 = buildDayReport(makeDayRecords('2026-01-01', 30, 5, 'computed'));
  const repComp2 = buildDayReport(makeDayRecords('2026-01-02', 35, 10, 'computed'));
  const compVerified = compareReports(repComp1, repComp2);
  assert.strictEqual(compVerified.bothLowSimulated, true, 'Verified data must set bothLowSimulated to true');
  console.log('  PASSED: Simulated vs verified toggle rule validated.');
}

// Test 13: Plural wording helper
{
  console.log('Test 13: Plural wording helper...');
  const { pluralize } = await import('../services/reportMath.js');
  assert.strictEqual(pluralize(1, 'rainy day'), '1 rainy day');
  assert.strictEqual(pluralize(2, 'rainy day'), '2 rainy days');
  assert.strictEqual(pluralize(0, 'rainy day'), '0 rainy days');
  assert.strictEqual(pluralize(1, 'active construction site'), '1 active construction site');
  assert.strictEqual(pluralize(3, 'active construction site'), '3 active construction sites');
  console.log('  PASSED: Plural wording helper correctly pluralizes nouns.');
}

// Test 14: typicalProfile on fixtures
{
  console.log('Test 14: typicalProfile on fixtures...');
  const { typicalProfile } = await import('../services/reportMath.js');
  const rep1 = buildDayReport(makeDayRecords('2026-01-01', 20));
  const rep2 = buildDayReport(makeDayRecords('2026-01-02', 40));
  const typicalDay = typicalProfile([rep1, rep2], 'day');
  assert.strictEqual(typeof typicalDay, 'object');
  assert.strictEqual(typicalDay['08-10'], 30, 'Typical slot average for 20 and 40 must be 30');

  const typicalMonth = typicalProfile([rep1, rep2], 'month');
  assert.strictEqual(typeof typicalMonth, 'object');
  console.log('  PASSED: typicalProfile pure in-memory calculation validated.');
}

console.log('\nALL 14 REPORT MATH TESTS PASSED SUCCESSFULLY!');
