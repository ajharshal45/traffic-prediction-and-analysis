import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { readOnlyDb, disconnectReadOnlyDB } from '../db/readOnlyDb.js';
import { buildDayReport, mergeReports } from '../services/reportMath.js';
import defaultReportStore from '../store/reportStore.js';

const DEFAULT_EXPORT_PATH = 'C:\\college\\EDI Project\\2nd sem-1\\traffic prediction\\mongodb_export\\trafficanalysis\\pathinfos.json';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    route: null,
    from: null,
    to: null,
    file: null,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--route=')) {
      options.route = arg.split('=')[1].trim();
    } else if (arg.startsWith('--from=')) {
      options.from = arg.split('=')[1].trim();
    } else if (arg.startsWith('--to=')) {
      options.to = arg.split('=')[1].trim();
    } else if (arg.startsWith('--file=')) {
      options.file = arg.split('=')[1].trim();
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function formatDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

async function loadRecordsFromFile(filePath, targetRoute, fromDate, toDate) {
  console.log(`Reading records from offline read-only export: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const all = JSON.parse(raw);

  return all.filter(r => {
    if (targetRoute && r.pathId !== targetRoute) return false;
    const dStr = formatDateStr(r.date);
    if (fromDate && dStr < fromDate) return false;
    if (toDate && dStr > toDate) return false;
    return true;
  });
}

async function runBuild() {
  const options = parseArgs();
  console.log('--- Period Reports Build CLI ---');
  console.log(`Route: ${options.route || 'ALL routes'}`);
  console.log(`From: ${options.from || 'Beginning'}`);
  console.log(`To: ${options.to || 'Present'}`);
  console.log(`Dry Run: ${options.dryRun ? 'YES (no files will be written)' : 'NO'}`);

  const exportFilePath = options.file || (fs.existsSync(DEFAULT_EXPORT_PATH) ? DEFAULT_EXPORT_PATH : null);
  const useExport = !process.env.MONGO_URI_READONLY && exportFilePath;

  if (!process.env.MONGO_URI_READONLY && !useExport) {
    console.error(
      '\n\x1b[31m[ERROR] SAFETY RULE D1: MONGO_URI_READONLY is missing.\x1b[0m\n' +
      'New code connects ONLY through env var MONGO_URI_READONLY (a read-only DB user).\n' +
      'Please configure MONGO_URI_READONLY before running the build CLI.'
    );
    process.exit(1);
  }

  let dbClientActive = false;

  try {
    let targetRoutes = [];
    let allExportRecords = null;

    if (useExport) {
      console.log(`[INFO] Using verified read-only exported dataset: ${exportFilePath}`);
      const raw = fs.readFileSync(exportFilePath, 'utf8');
      allExportRecords = JSON.parse(raw);
      if (options.route) {
        targetRoutes = [options.route];
      } else {
        const routeSet = new Set(allExportRecords.map(r => r.pathId).filter(Boolean));
        targetRoutes = Array.from(routeSet).sort();
      }
    } else {
      const pathInfoCollection = await readOnlyDb.getPathInfoCollection();
      dbClientActive = true;
      if (options.route) {
        targetRoutes = [options.route];
      } else {
        targetRoutes = await pathInfoCollection.distinct('pathId');
      }
    }

    console.log(`Found ${targetRoutes.length} route(s) to process:`, targetRoutes);

    for (const route of targetRoutes) {
      console.log(`\n==================================================`);
      console.log(`Processing route: "${route}"`);
      console.log(`==================================================`);

      let records = [];
      if (useExport) {
        records = allExportRecords.filter(r => {
          if (r.pathId !== route) return false;
          const dStr = formatDateStr(r.date);
          if (options.from && dStr < options.from) return false;
          if (options.to && dStr > options.to) return false;
          return true;
        });
      } else {
        const pathInfoCollection = await readOnlyDb.getPathInfoCollection();
        const query = { pathId: route };
        if (options.from || options.to) {
          query.date = {};
          if (options.from) query.date.$gte = new Date(`${options.from}T00:00:00.000Z`);
          if (options.to) query.date.$lte = new Date(`${options.to}T23:59:59.999Z`);
        }
        records = await pathInfoCollection.find(query).lean ? 
          await pathInfoCollection.find(query).lean() : 
          await pathInfoCollection.find(query);
      }

      console.log(`Retrieved ${records.length} records for route "${route}".`);
      if (records.length === 0) {
        console.log('No records found for specified window. Skipping.');
        continue;
      }

      // Group records by YYYY-MM-DD
      const recordsByDate = new Map();
      for (const rec of records) {
        const dStr = formatDateStr(rec.date);
        if (!recordsByDate.has(dStr)) {
          recordsByDate.set(dStr, []);
        }
        recordsByDate.get(dStr).push(rec);
      }

      const sortedDates = Array.from(recordsByDate.keys()).sort();
      console.log(`Discovered ${sortedDates.length} distinct day(s). Building daily reports...`);

      const dayReports = [];
      for (const dStr of sortedDates) {
        const dayRecs = recordsByDate.get(dStr);
        const dayReport = buildDayReport(dayRecs, { pathId: route, dateStr: dStr });
        dayReports.push(dayReport);

        if (!options.dryRun) {
          await defaultReportStore.saveReport(dayReport);
        }
      }
      console.log(`Built ${dayReports.length} day reports.`);

      // Group day reports by Month (YYYY-MM)
      const dayReportsByMonth = new Map();
      for (const dr of dayReports) {
        const monthKey = dr.periodKey.slice(0, 7);
        if (!dayReportsByMonth.has(monthKey)) {
          dayReportsByMonth.set(monthKey, []);
        }
        dayReportsByMonth.get(monthKey).push(dr);
      }

      const monthReports = [];
      for (const [monthKey, days] of dayReportsByMonth.entries()) {
        const monthReport = mergeReports(days, 'month', monthKey, { pathId: route });
        monthReports.push(monthReport);

        if (!options.dryRun) {
          await defaultReportStore.saveReport(monthReport);
        }
      }
      console.log(`Built ${monthReports.length} month reports.`);

      // Group month reports by Year (YYYY)
      const monthReportsByYear = new Map();
      for (const mr of monthReports) {
        const yearKey = mr.periodKey.slice(0, 4);
        if (!monthReportsByYear.has(yearKey)) {
          monthReportsByYear.set(yearKey, []);
        }
        monthReportsByYear.get(yearKey).push(mr);
      }

      const yearReports = [];
      for (const [yearKey, months] of monthReportsByYear.entries()) {
        const yearReport = mergeReports(months, 'year', yearKey, { pathId: route });
        yearReports.push(yearReport);

        if (!options.dryRun) {
          await defaultReportStore.saveReport(yearReport);
        }
      }
      console.log(`Built ${yearReports.length} year reports.`);
    }

    console.log('\n\x1b[32m[SUCCESS] Period reports build complete!\x1b[0m');
  } catch (err) {
    console.error('\n\x1b[31m[BUILD FAILED]\x1b[0m', err);
    process.exit(1);
  } finally {
    if (dbClientActive) {
      await disconnectReadOnlyDB();
    }
  }
}

runBuild();
