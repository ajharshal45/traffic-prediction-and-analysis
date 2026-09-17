import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// All 7 routes
const ALL_ROUTES = [
  { id: 'Hinjewadi-Swargate',  baseScore: 42, peakMorn: ['08-10','10-12'], peakEve: ['16-18','18-20'] },
  { id: 'Katraj-Kondhwa',       baseScore: 38, peakMorn: ['08-10','10-12'], peakEve: ['18-20','20-22'] },
  { id: 'Kondhwa-Hinjewadi',    baseScore: 40, peakMorn: ['08-10','10-12'], peakEve: ['16-18','18-20'] },
  { id: 'Kothrud-Shivajinagar', baseScore: 36, peakMorn: ['08-10','10-12'], peakEve: ['18-20','20-22'] },
  { id: 'Swargate-Katraj',      baseScore: 35, peakMorn: ['08-10','10-12'], peakEve: ['16-18','18-20'] },
  { id: 'Swargate-Hadapsar',    baseScore: 40, peakMorn: ['08-10','10-12'], peakEve: ['16-18','18-20'], hasConstruction: true, hasDiversion: true },
  { id: 'Hadapsar-Kharadii',    baseScore: 45, peakMorn: ['08-10','10-12'], peakEve: ['18-20','20-22'], hasConstruction: true, hasHotspot: true },
];

// All 12 time slots in order
const ALL_SLOTS = ['00-02','02-04','04-06','06-08','08-10','10-12','12-14','14-16','16-18','18-20','20-22','22-24'];

// Sep 1 slots ONLY up to 08-10
const SEP1_SLOTS = ['00-02','02-04','04-06','06-08','08-10'];

function getLevel(score) {
  if (score <= 15) return 'very low';
  if (score <= 35) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'very high';
}

function seededRand(seed) {
  let s = (Math.abs(seed) % 2147483647) || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function calcScore(route, slot, dateObj) {
  const seed = parseInt(`${dateObj.getDate()}${dateObj.getMonth()}${slot.replace('-', '')}${route.id.length}`);
  const rand = seededRand(seed);
  
  let score = route.baseScore;
  const isPeakMorn = route.peakMorn.includes(slot);
  const isPeakEve  = route.peakEve?.includes(slot);
  const isNight    = ['00-02','02-04','04-06'].includes(slot);

  if (isPeakMorn || isPeakEve) score += 20 + rand() * 15;
  else if (isNight)            score = 8 + rand() * 8;
  else                         score += rand() * 8 - 4;

  // Monsoon chance (Aug/Sep)
  const isRaining = rand() > 0.75;
  if (isRaining) score += 18;

  score = Math.max(2, Math.min(100, score));
  return { score: Math.round(score * 100) / 100, isRaining };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');
  const db = mongoose.connection.db;
  const piCol  = db.collection('pathinfos');
  const plCol  = db.collection('predictionlogs');

  // Fetch real factors
  const constructions = await db.collection('constructions').find().limit(2).toArray();
  const diversions    = await db.collection('diversions').find().limit(2).toArray();
  const hotspots      = await db.collection('nearbyhotspots').find().limit(2).toArray();

  // Check existing PathInfo dates to avoid duplicates
  const existingPI = await piCol.aggregate([
    { $group: { _id: { pathId: '$pathId', date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, timeRange: '$timeRange' } } }
  ]).toArray();
  const existingPISet = new Set(existingPI.map(e => `${e._id.pathId}||${e._id.date}||${e._id.timeRange}`));

  // Dates to fill: Sep 1 remaining slots, Sep 2-6 all slots, Sep 7 up to 14-16
  const datesToFill = [
    { date: '2026-09-01', slots: ['10-12','12-14','14-16','16-18','18-20','20-22','22-24'] },
    { date: '2026-09-02', slots: ALL_SLOTS },
    { date: '2026-09-03', slots: ALL_SLOTS },
    { date: '2026-09-04', slots: ALL_SLOTS },
    { date: '2026-09-05', slots: ALL_SLOTS },
    { date: '2026-09-06', slots: ALL_SLOTS },
    { date: '2026-09-07', slots: ['00-02','02-04','04-06','06-08','08-10','10-12','12-14','14-16'] },
  ];

  let piOps = [], plOps = [];
  let piSkipped = 0;

  for (const { date, slots } of datesToFill) {
    const dateObj = new Date(date + 'T00:00:00.000Z');

    for (const route of ALL_ROUTES) {
      for (const slot of slots) {
        const key = `${route.id}||${date}||${slot}`;

        // PathInfo — generate for ALL routes (skip if already exists)
        if (!existingPISet.has(key)) {
          const { score, isRaining } = calcScore(route, slot, dateObj);

          const breakdown = {
            construction: route.hasConstruction && constructions.length ? 25 : 0,
            diversion:    route.hasDiversion    && diversions.length    ? 15 : 0,
            hotspot:      route.hasHotspot      && hotspots.length      ? 12 : 0,
            event: 0, pothole: 0, complaint: 0, festival: 0,
            weather:  isRaining ? 35 : 0,
            transit:  10,
            metro:    0,
            constructionCount: route.hasConstruction && constructions.length ? 1 : 0,
            diversionCount:    route.hasDiversion    && diversions.length    ? 1 : 0,
            hotspotCount:      route.hasHotspot      && hotspots.length      ? 1 : 0,
            eventCount: 0,
            weatherCondition: isRaining ? 'Rain' : 'Clear',
          };

          piOps.push({
            insertOne: {
              document: {
                pathId: route.id,
                date:   dateObj,
                timeRange: slot,
                score,
                level: getLevel(score),
                breakdown,
              }
            }
          });
        } else {
          piSkipped++;
        }

        // PredictionLog — generate for ALL routes for Sep 2-7
        const existing = await plCol.countDocuments({
          pathId: route.id,
          predictedDate: { $gte: new Date(date + 'T00:00:00.000Z'), $lte: new Date(date + 'T23:59:59.999Z') },
          timeRange: slot
        });
        if (existing === 0) {
          const { score: actualScore } = calcScore(route, slot, dateObj);
          const errorSeed = parseInt(`${dateObj.getDate()}${slot.replace('-','')}${route.id.charCodeAt(0)}`);
          const rand2 = seededRand(errorSeed);
          const error = (rand2() * 10) - 5;
          let predScore = actualScore + error - 15;
          if (predScore < 15) predScore = 2;

          plOps.push({
            insertOne: {
              document: {
                pathId: route.id,
                predictedDate: dateObj,
                timeRange: slot,
                predictedScore: Math.round(predScore * 100) / 100,
                actualScore,
                accuracy: Math.round(Math.max(0, 100 - Math.abs(predScore - actualScore)) * 100) / 100,
                isVerified: true,
                predictedAt: new Date(dateObj.getTime() - 24 * 60 * 60 * 1000),
                breakdown: {},
              }
            }
          });
        }
      }
    }
  }

  console.log(`PathInfo: ${piOps.length} to insert, ${piSkipped} already existed`);
  if (piOps.length > 0) {
    await piCol.bulkWrite(piOps, { ordered: false });
    console.log('PathInfo inserted ✅');
  }

  console.log(`PredictionLog (new routes): ${plOps.length} to insert`);
  if (plOps.length > 0) {
    await plCol.bulkWrite(plOps, { ordered: false });
    console.log('PredictionLog inserted ✅');
  }

  // Final verification
  console.log('\n--- Final last dates per route ---');
  const finalPI = await piCol.aggregate([
    { $group: { _id: '$pathId', lastDate: { $max: '$date' } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  finalPI.forEach(r => console.log(`  PathInfo   | ${r._id}: ${r.lastDate?.toISOString().split('T')[0]}`));

  const finalPL = await plCol.aggregate([
    { $group: { _id: '$pathId', lastDate: { $max: '$predictedDate' } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  finalPL.forEach(r => console.log(`  PredLogLog | ${r._id}: ${r.lastDate?.toISOString().split('T')[0]}`));

  process.exit(0);
}
run().catch(console.error);
