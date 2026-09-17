import mongoose from "mongoose";

const signalSchema = new mongoose.Schema(
  {
    signalId: {
      type: String,
      required: true,
      unique: true, // e.g., "wakad-chowk-01"
    },
    junctionName: {
      type: String,
      required: true, // e.g., "Wakad Chowk"
    },
    location: {
      lat: Number,
      lng: Number,
    },
    cycleSeconds: {
      type: Number,
      required: true, // e.g., 120, 150 (Total time for all phases)
    },
    phases: [
      {
        direction: String, // e.g., "North-South", "East-West"
        greenSeconds: Number,
        redSeconds: Number,
        peakGreenSeconds: Number, // Adjusted green time during rush hour
      },
    ],
    isAdaptive: {
      type: Boolean,
      default: false, // true if it uses sensors to change timing automatically
    },
    zone: {
      type: String,
    },
  },
  { timestamps: true }
);

const Signal = mongoose.model("Signal", signalSchema);
export default Signal;
