import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema({
  segmentIndex: Number,
  fromLabel: String,
  toLabel: String,
  fromLat: Number,
  fromLng: Number,
  toLat: Number,
  toLng: Number,
  distanceM: Number,
  durationNormal: Number,   // seconds free-flow
  durationTraffic: Number,  // seconds with traffic
  congestionScore: Number,  // % extra time
  level: String,            // low/medium/high/very high
  cause: { type: String, default: 'Normal Flow' },          // e.g. 'Metro Line 3 Pier Work', 'Road Widening Excavation', 'Market Rush'
  causeCategory: { type: String, default: 'regular' },      // 'construction', 'bottleneck', 'market_junction', 'protest', 'regular'
  delaySeconds: { type: Number, default: 0 }
}, { _id: false });

const routeSegmentLogSchema = new mongoose.Schema({
  pathId: { type: String, required: true },
  date: { type: Date, required: true },
  timeRange: { type: String, required: true },
    totalDurationNormal: Number,
  totalDurationTraffic: Number,
  overallCongestionScore: Number,
  segments: [segmentSchema]
}, { timestamps: false });

routeSegmentLogSchema.index({ pathId: 1, date: 1, timeRange: 1 }, { unique: true });

export default mongoose.model('RouteSegmentLog', routeSegmentLogSchema);
