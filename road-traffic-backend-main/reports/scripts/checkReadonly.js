import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.resolve(__dirname, '..');

// List of forbidden patterns and method names on database collections/models
const FORBIDDEN_PATTERNS = [
  { pattern: /\b(insertMany|insertOne)\b/g, name: 'insert operation' },
  { pattern: /\b(updateMany|updateOne)\b/g, name: 'update operation' },
  { pattern: /\b(replaceOne)\b/g, name: 'replace operation' },
  { pattern: /\b(deleteMany|deleteOne)\b/g, name: 'delete operation' },
  { pattern: /\.(save)\s*\(/g, name: 'model.save() call' },
  { pattern: /\bModel\.create\b/g, name: 'Model.create() call' },
  { pattern: /\b(bulkWrite)\b/g, name: 'bulkWrite operation' },
  { pattern: /\b(findOneAndUpdate|findOneAndReplace|findOneAndDelete)\b/g, name: 'findAndModify operation' },
  { pattern: /\b(dropDatabase|dropCollection)\b/g, name: 'drop database/collection' },
  { pattern: /\b(createIndex|ensureIndex)\b/g, name: 'index creation' },
  { pattern: /['"]\$out['"]/g, name: '$out aggregation stage' },
  { pattern: /['"]\$merge['"]/g, name: '$merge aggregation stage' }
];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(REPORTS_DIR, fullPath);
    // Ignore node_modules, .git, data directory, and this script itself
    if (file === 'node_modules' || file === '.git' || file === 'data') continue;
    if (fullPath === __filename) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function runCheck() {
  console.log(`[check:readonly] Scanning ${REPORTS_DIR} for forbidden write operations...`);
  const files = getAllFiles(REPORTS_DIR);
  let violationsCount = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      for (const rule of FORBIDDEN_PATTERNS) {
        // Reset regex state
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(line)) {
          // If in readOnlyDb.js, allow definitions inside the security validator itself
          if (filePath.endsWith('readOnlyDb.js') && (line.includes('VIOLATION') || line.includes('throw new Error') || line.includes('ALLOWED_METHODS'))) {
            continue;
          }
          console.error(
            `\x1b[31m[VIOLATION]\x1b[0m ${path.relative(REPORTS_DIR, filePath)}:${index + 1} - Found forbidden ${rule.name}: "${line.trim()}"`
          );
          violationsCount++;
        }
      }
    });
  }

  if (violationsCount > 0) {
    console.error(`\x1b[31mFAILED: Found ${violationsCount} forbidden write pattern(s) in reports code.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mPASSED: All ${files.length} scanned files are strictly read-only.\x1b[0m`);
    process.exit(0);
  }
}

runCheck();
