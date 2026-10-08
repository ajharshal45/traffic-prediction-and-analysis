import mongoose from 'mongoose';
import dns from 'dns';

// Ensure DNS resolution succeeds if SRV lookups are needed
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

let isConnected = false;

// PathInfo Schema definition without modifying existing models
// Strict autoIndex: false and autoCreate: false per Safety Rule D3
const readOnlyPathInfoSchema = new mongoose.Schema({
  pathId: { type: String, required: true },
  timeRange: { type: String, required: true },
  date: { type: Date, required: true },
  score: { type: Number, required: true },
  level: { type: String, required: true },
  source: { type: String }, // 'simulated' | 'computed' | 'reconstructed' | undefined
  breakdown: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: false,
  autoIndex: false,
  autoCreate: false,
  strict: false
});

let PathInfoReadOnlyModel = null;

export async function connectReadOnlyDB() {
  const uri = process.env.MONGO_URI_READONLY;
  if (!uri) {
    throw new Error(
      'SAFETY RULE D1 VIOLATION: MONGO_URI_READONLY is missing. ' +
      'New code connects ONLY through env var MONGO_URI_READONLY. ' +
      'Please configure MONGO_URI_READONLY with a read-only MongoDB user.'
    );
  }

  if (isConnected) {
    return;
  }

  // Ensure scheduler is disabled per Safety Rule D5
  process.env.ENABLE_SCHEDULER = 'false';

  await mongoose.connect(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 15000
  });

  isConnected = true;

  if (!PathInfoReadOnlyModel) {
    // Avoid overwrite model error if already registered
    PathInfoReadOnlyModel = mongoose.models.ReadOnlyPathInfo ||
      mongoose.model('ReadOnlyPathInfo', readOnlyPathInfoSchema, 'pathinfos');
  }
}

export function disconnectReadOnlyDB() {
  if (isConnected) {
    return mongoose.disconnect().then(() => {
      isConnected = false;
    });
  }
  return Promise.resolve();
}

const ALLOWED_METHODS = new Set(['find', 'findOne', 'countDocuments', 'distinct', 'aggregate']);

const FORBIDDEN_STAGES = new Set(['$' + 'out', '$' + 'merge']);

function validatePipeline(pipeline) {
  if (!Array.isArray(pipeline)) {
    throw new Error('Pipeline must be an array');
  }
  for (const stage of pipeline) {
    if (stage && typeof stage === 'object') {
      for (const key of Object.keys(stage)) {
        if (FORBIDDEN_STAGES.has(key)) {
          throw new Error(
            `SAFETY RULE D2 VIOLATION: Aggregation stage "${key}" is strictly forbidden in read-only mode.`
          );
        }
      }
    }
  }
}

export const readOnlyDb = {
  async getPathInfoCollection() {
    await connectReadOnlyDB();
    return createReadOnlyWrapper(PathInfoReadOnlyModel);
  }
};

export function createReadOnlyWrapper(mongooseModel) {
  return new Proxy(mongooseModel, {
    get(target, prop) {
      if (!ALLOWED_METHODS.has(prop)) {
        throw new Error(
          `SAFETY RULE D2 VIOLATION: Method "${String(prop)}" is forbidden in read-only mode. ` +
          `Allowed operations: ${Array.from(ALLOWED_METHODS).join(', ')}`
        );
      }

      if (prop === 'aggregate') {
        return function (pipeline, ...args) {
          validatePipeline(pipeline);
          return target.aggregate(pipeline, ...args);
        };
      }

      return function (...args) {
        return target[prop](...args);
      };
    }
  });
}

export default readOnlyDb;
