import mongoose from "mongoose";

const roadSchema = new mongoose.Schema(
  {
    roadId: {
      type: String,
      required: true,
      unique: true, // e.g., "Hinjewadi-Swargate"
    },
    name: {
      type: String,
      required: true, // e.g., "Baner Road"
    },
    type: {
      type: String,
      enum: ["arterial", "collector", "highway", "local"],
      default: "arterial",
    },
    widthMeters: {
      type: Number,
      required: true,
    },
    lanes: {
      type: Number,
      required: true, // Total number of lanes
    },
    hasMedian: {
      type: Boolean,
      default: true,
    },
    hasBusLane: {
      type: Boolean,
      default: false,
    },
    speedLimitKmh: {
      type: Number,
      default: 40,
    },
    surfaceCondition: {
      type: String,
      enum: ["good", "fair", "poor"],
      default: "fair",
    },
    capacityVehiclesPerHour: {
      type: Number,
      required: true, // Crucial for simulation/bottleneck calculation
    },
    zone: {
      type: String,
      required: true, // e.g., "IT Corridor", "Central"
    },
    coordinates: [
      {
        lat: Number,
        lng: Number,
      },
    ],
  },
  { timestamps: true }
);

const Road = mongoose.model("Road", roadSchema);
export default Road;
