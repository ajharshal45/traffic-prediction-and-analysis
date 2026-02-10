import mongoose from 'mongoose';

const metroStationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    line: {
        type: String, // 'Purple', 'Aqua', 'Pink'
        required: true
    },
    type: {
        type: String, // 'Terminal', 'Interchange', 'Regular'
        default: 'Regular'
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    // Crowd factor represents typical busy-ness (1-10)
    crowdFactor: {
        type: Number,
        default: 5
    }
}, { timestamps: true });

// Index for geospatial queries if needed, but for now simple distance calc is fine
metroStationSchema.index({ name: 'text' });

export const MetroStation = mongoose.model('MetroStation', metroStationSchema);
