import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', 'data');

export class ReportStoreInterface {
  async saveReport(report) { throw new Error('Not implemented'); }
  async getReport(pathId, periodType, periodKey) { throw new Error('Not implemented'); }
  async listReports(pathId, periodType) { throw new Error('Not implemented'); }
  async listRoutes() { throw new Error('Not implemented'); }
}

export class JsonFileReportStore extends ReportStoreInterface {
  constructor(baseDir = DEFAULT_DATA_DIR) {
    super();
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _getDir(pathId, periodType) {
    return path.join(this.baseDir, encodeURIComponent(pathId), periodType);
  }

  _getFilePath(pathId, periodType, periodKey) {
    // Sanitize periodKey for safe filename
    const safeKey = String(periodKey).replace(/[/\\?%*:|"<>]/g, '_');
    return path.join(this._getDir(pathId, periodType), `${safeKey}.json`);
  }

  async saveReport(report) {
    if (!report || !report.pathId || !report.periodType || !report.periodKey) {
      throw new Error('Report must contain pathId, periodType, and periodKey');
    }
    const targetDir = this._getDir(report.pathId, report.periodType);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = this._getFilePath(report.pathId, report.periodType, report.periodKey);
    const content = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
    return report;
  }

  async getReport(pathId, periodType, periodKey) {
    const filePath = this._getFilePath(pathId, periodType, periodKey);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  async listReports(pathId, periodType) {
    const targetDir = this._getDir(pathId, periodType);
    if (!fs.existsSync(targetDir)) {
      return [];
    }
    const files = fs.readdirSync(targetDir);
    const reports = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(targetDir, file), 'utf8');
          const data = JSON.parse(raw);
          reports.push({
            pathId: data.pathId,
            periodType: data.periodType,
            periodKey: data.periodKey,
            start: data.start,
            end: data.end,
            isPartial: data.isPartial,
            coveragePct: data.coveragePct,
            avgScore: data.avgScore,
            recordCount: data.recordCount,
            generatedAt: data.generatedAt
          });
        } catch {
          // Skip corrupt file
        }
      }
    }
    // Sort reports chronologically by periodKey / start
    reports.sort((a, b) => (a.start > b.start ? 1 : -1));
    return reports;
  }

  async listRoutes() {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => decodeURIComponent(e.name))
      .sort();
  }
}

export const defaultReportStore = new JsonFileReportStore();
export default defaultReportStore;
