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

console.log('\nALL 5 REPORT MATH TESTS PASSED SUCCESSFULLY!');
