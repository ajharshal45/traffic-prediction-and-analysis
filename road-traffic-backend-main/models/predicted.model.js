import mongoose from 'mongoose';

const predictedSchema = new mongoose.Schema({
  pathId: {
    type: String,
    required: true,
    index: true,
  },
  timeRange: {
    type: String,
    required: true,
    enum: [
      '00-02', '02-04', '04-06', '06-08', '08-10', '10-12',
      '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
    ],
  },
  predictedDate: {
    type: Date,
    required: true,
    index: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
  },
  level: {
    type: String,
    required: true,
  },
  predictedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  actualScore: {
    type: Number,
    default: null,
  },
  breakdown: {
    construction: { type: Number, default: 0 },
    diversion: { type: Number, default: 0 },
    event: { type: Number, default: 0 },
    hotspot: { type: Number, default: 0 },
    pothole: { type: Number, default: 0 },
    complaint: { type: Number, default: 0 },
    weather: { type: Number, default: 0 },
    transit: { type: Number, default: 0 },
    metro: { type: Number, default: 0 },
    festival: { type: Number, default: 0 },
    timeMultiplier: { type: Number, default: 1 },
    googleScore: { type: Number, default: 0 },
    historyScore: { type: Number, default: 0 },
    obstacleScore: { type: Number, default: 0 },
    constructionCount: { type: Number, default: 0 },
    diversionCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    hotspotCount: { type: Number, default: 0 },
    potholeCount: { type: Number, default: 0 },
    complaintCount: { type: Number, default: 0 },
    metroCount: { type: Number, default: 0 },
    weatherCondition: { type: String, default: '' },
    festivalName: { type: String, default: '' },
  }
}, {
  timestamps: true,
});

predictedSchema.index({ pathId: 1, predictedDate: 1, timeRange: 1 }, { unique: true });

const Predicted = mongoose.model('Predicted', predictedSchema);

export default Predicted;
