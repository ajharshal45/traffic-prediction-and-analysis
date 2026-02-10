import mongoose from 'mongoose';
const { Schema } = mongoose;

const bmsEventSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    locationStr: {
        type: String, 
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    price: {
        type: String, 
        default: "0"
    },
    popularityScore: {
        type: Number,
        default: 50
    },
    isFillingFast: {
        type: Boolean,
        default: false
    },
    // ✅ GEOSPATIAL DATA SCHEMA
    // This is critical for your "Distance Calculation" in prediction
    eventPoints: [{
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    }],
    
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    url: {
        type: String,
        default: ""
    }
}, { timestamps: true });

// Create text index for better search
bmsEventSchema.index({ name: 'text', locationStr: 'text' });

export const BMSEvent = mongoose.model("BMSEvent", bmsEventSchema); 