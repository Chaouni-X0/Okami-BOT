import mongoose from 'mongoose';

const cacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // search:query or details:url
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    source: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24h
});

export const Cache = mongoose.model('Cache', cacheSchema);
