import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Resolve .env relative to THIS file, not the CWD, so the script works
// regardless of which directory you run it from.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import connectDB from '../../mongoose/connection.js';
import PathInfo from '../../models/pathinfo.model.js';
import PredictionLog from '../../models/predictionLog.model.js';
import Predicted from '../../models/predicted.model.js';
import { normalizePathId } from '../../utils/normalizePathId.js';

const runMigration = async () => {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  
  if (isDryRun) {
    console.log('🚀 [DRY RUN] Starting pathId en-dash normalization migration...');
    console.log('No changes will be saved to the database.\n');
  } else {
    console.log('🚀 [LIVE] Starting pathId en-dash normalization migration...');
  }
  
  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB');

    const collections = [
      { name: 'PathInfo', model: PathInfo },
      { name: 'PredictionLog', model: PredictionLog },
      { name: 'Predicted', model: Predicted },
    ];

    for (const coll of collections) {
      console.log(`\n--- Scanning Collection: ${coll.name} ---`);
      
      const docs = await coll.model.find({ pathId: { $regex: /–/ } });
      console.log(`Found ${docs.length} documents with en-dash in pathId.`);

      let updatedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;

      for (const doc of docs) {
        const oldPathId = doc.pathId;
        const newPathId = normalizePathId(oldPathId);
        
        try {
          if (!isDryRun) {
            doc.pathId = newPathId;
            await doc.save();
          }
          updatedCount++;
        } catch (err) {
          if (err.code === 11000) {
            // Collision detected! A hyphenated record already exists.
            // Let's compare data quality to decide which one to keep.
            
            // Re-fetch the conflicting hyphenated document
            const filter = { ...doc.toObject() };
            delete filter._id;
            delete filter.pathId;
            delete filter.createdAt;
            delete filter.updatedAt;
            delete filter.__v;
            
            // Construct exact match filter based on collection keys
            const query = { pathId: newPathId };
            if (doc.timeRange) query.timeRange = doc.timeRange;
            if (doc.predictedDate) query.predictedDate = doc.predictedDate;
            if (doc.date) query.date = doc.date;
            
            const existingDoc = await coll.model.findOne(query);
            
            if (existingDoc) {
              let keepEnDash = false;
              let decisionReason = 'No superior data found, keeping Hyphenated by default.';
              
              // 1. If en-dash is verified but hyphenated is not
              if (doc.isVerified === true && existingDoc.isVerified === false) {
                keepEnDash = true;
                decisionReason = 'Rule 1: En-dash is verified, Hyphenated is not.';
              }
              // 2. If en-dash has an actualScore but hyphenated does not
              else if (doc.actualScore !== null && existingDoc.actualScore === null) {
                keepEnDash = true;
                decisionReason = 'Rule 2: En-dash has actualScore, Hyphenated does not.';
              }
              // 3. Fallback to newest updated record
              else if (doc.updatedAt > existingDoc.updatedAt) {
                 if (doc.isVerified === existingDoc.isVerified) {
                   keepEnDash = true;
                   decisionReason = 'Rule 3: Both have same verification status, but En-dash is newer (updatedAt).';
                 }
              }

              if (keepEnDash) {
                if (!isDryRun) {
                  await coll.model.deleteOne({ _id: existingDoc._id });
                  doc.pathId = newPathId;
                  await doc.save();
                }
                updatedCount++;
                deletedCount++;
                console.log(`   [Collision Resolution] Kept En-Dash data for ${newPathId} | Reason: ${decisionReason}`);
              } else {
                if (!isDryRun) {
                  await coll.model.deleteOne({ _id: doc._id });
                }
                deletedCount++;
                console.log(`   [Collision Resolution] Discarded En-Dash data for ${newPathId} | Reason: ${decisionReason}`);
              }
            } else {
              // Somehow couldn't find the duplicate despite E11000
              console.error(`❌ Collision mystery for doc ${doc._id}`);
              errorCount++;
            }
          } else {
            console.error(`❌ Failed to update doc ${doc._id} (${oldPathId}): ${err.message}`);
            errorCount++;
          }
        }
      }

      console.log(`✅ ${coll.name}: Updated ${updatedCount} | Deleted (duplicates) ${deletedCount} | Errors ${errorCount}`);
    }

    console.log('\n🎉 Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('💥 Fatal error in migration:', err);
    process.exit(1);
  }
};

runMigration();
