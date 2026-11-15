import mongoose from 'mongoose';
import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('[ERROR] MONGODB_URI is not defined in .env');
  process.exit(1);
}

// Format timestamp: YYYY-MM-DD_HH-mm-ss
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

const backupBaseDir = path.join(__dirname, '..', 'backups');
const targetBackupDir = path.join(backupBaseDir, `backup_${timestamp}`);

if (!fs.existsSync(targetBackupDir)) {
  fs.mkdirSync(targetBackupDir, { recursive: true });
}

console.log('====================================================');
console.log('📦 MONGODB OFFLINE LOCAL BACKUP UTILITY');
console.log(`📁 Destination: ${targetBackupDir}`);
console.log(`⏰ Started: ${now.toISOString()}`);
console.log('====================================================\n');

console.log('[1/4] Connecting to MongoDB Atlas...');
await mongoose.connect(mongoUri);
const db = mongoose.connection.db;

console.log('[2/4] Discovering all collections in database...');
const collectionList = await db.listCollections().toArray();
const collectionNames = collectionList.map(c => c.name).sort();

console.log(`Found ${collectionNames.length} collection(s):`, collectionNames.join(', '));

const summary = {
  timestamp: now.toISOString(),
  database: db.databaseName,
  backupDirectory: targetBackupDir,
  totalCollections: collectionNames.length,
  collections: []
};

console.log('\n[3/4] Exporting collections to offline JSON files...');

for (let i = 0; i < collectionNames.length; i++) {
  const colName = collectionNames[i];
  const col = db.collection(colName);
  const totalDocs = await col.countDocuments();
  const filePath = path.join(targetBackupDir, `${colName}.json`);

  console.log(`\n  [${i + 1}/${collectionNames.length}] Exporting "${colName}" (${totalDocs.toLocaleString()} documents)...`);

  const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  writeStream.write('[\n');

  let exportedCount = 0;
  const cursor = col.find({}).batchSize(1000);

  let isFirst = true;
  for await (const doc of cursor) {
    if (!isFirst) {
      writeStream.write(',\n');
    }
    writeStream.write(JSON.stringify(doc));
    isFirst = false;
    exportedCount++;

    if (exportedCount % 5000 === 0 || exportedCount === totalDocs) {
      process.stdout.write(`    ↳ Processed ${exportedCount.toLocaleString()} / ${totalDocs.toLocaleString()} docs...\r`);
    }
  }

  writeStream.write('\n]\n');
  await new Promise((resolve, reject) => {
    writeStream.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`    ✅ Completed: ${colName}.json (${sizeMB} MB, ${exportedCount.toLocaleString()} docs)`);

  summary.collections.push({
    name: colName,
    documentCount: exportedCount,
    file: `${colName}.json`,
    sizeBytes: stats.size,
    sizeFormatted: `${sizeMB} MB`
  });
}

// Write summary file
const summaryPath = path.join(targetBackupDir, 'backup_summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

console.log('\n====================================================');
console.log('🎉 OFFLINE LOCAL BACKUP COMPLETED SUCCESSFULLY!');
console.log(`📁 Saved in: ${targetBackupDir}`);
console.log(`📋 Summary manifest: ${summaryPath}`);
console.log('====================================================');

await mongoose.disconnect();
process.exit(0);
