import mongoose from 'mongoose';

const pathInfoSchema = new mongoose.Schema({
  pathId: {
    type: String,
    required: true,
  },
  timeRange: {
    type: String,
    required: true,
    enum: [
      '00-02', '02-04', '04-06', '06-08', '08-10', '10-12', 
      '12-14', '14-16', '16-18', '18-20', '20-22', '22-24',
    ],
  },
  date: {
    type: Date,
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0, 
  },
  level: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high','very high','very low'], 
  },
  // NEW: Store root cause breakdown for each record
  breakdown: {
    type: {
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
      // Counts
      constructionCount: { type: Number, default: 0 },
      diversionCount: { type: Number, default: 0 },
      eventCount: { type: Number, default: 0 },
      hotspotCount: { type: Number, default: 0 },
      potholeCount: { type: Number, default: 0 },
      complaintCount: { type: Number, default: 0 },
      metroCount: { type: Number, default: 0 },
      weatherCondition: { type: String, default: '' },
      festivalName: { type: String, default: '' },
      // Individual hotspot type breakdown
      schoolScore: { type: Number, default: 0 },
      schoolCount: { type: Number, default: 0 },
      hospitalScore: { type: Number, default: 0 },
      hospitalCount: { type: Number, default: 0 },
      mallScore: { type: Number, default: 0 },
      mallCount: { type: Number, default: 0 },
      hotelScore: { type: Number, default: 0 },
      hotelCount: { type: Number, default: 0 },
      gardenScore: { type: Number, default: 0 },
      gardenCount: { type: Number, default: 0 },
      banquetHallScore: { type: Number, default: 0 },
      banquetHallCount: { type: Number, default: 0 },
      parkingBuildingScore: { type: Number, default: 0 },
      parkingBuildingCount: { type: Number, default: 0 }
    },
    required: false
  }
}, {
  timestamps: false, 
});

const PathInfo = mongoose.model('PathInfo', pathInfoSchema);

export default PathInfo;
