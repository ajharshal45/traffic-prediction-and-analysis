import mongoose from "mongoose";

const pmpmlSchema = new mongoose.Schema(
  {
    routeNumber: {
      type: String,
      required: true, // e.g., "151", "11", "B-3"
    },
    routeName: {
      type: String,
      required: true, // e.g., "Hinjewadi to Swargate"
    },
    stops: [
      {
        stopName: String,
        lat: Number,
        lng: Number,
      },
    ],
    schedule: [
      {
        departureTime: String, // "07:30"
        frequencyMinutes: Number, // 15
        peakHours: [String], // ["08:00-10:00", "17:00-20:00"]
      },
    ],
    passengerCapacity: {
      type: Number,
      default: 50,
    },
    dailyRidership: {
      type: Number,
    },
    overlappingCorridor: {
      type: String, // Which traffic pathId it primarily affects
    },
  },
  { timestamps: true }
);

const PMPML = mongoose.model("PMPML", pmpmlSchema);
export default PMPML;
