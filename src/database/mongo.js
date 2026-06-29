import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    logger.warn('MONGODB_URI not found in environment variables. MongoDB features will be disabled.');
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => logger.info('Connected to MongoDB (Cloud)'))
        .catch(err => logger.error('MongoDB connection error:', err));
}

// User Schema
const userSchema = new mongoose.Schema({
    fb_id: { type: String, unique: true, required: true },
    name: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    last_active: { type: Date, default: Date.now },
    guild_id: String,
    created_at: { type: Date, default: Date.now }
});

// Manga Metadata Schema
const mangaSchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    cover_url: String,
    status: String,
    source_site_key: String,
    source_url: String,
    auto_update: { type: Boolean, default: false },
    aggregation_post_id: String,
    rating: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const Manga = mongoose.model('Manga', mangaSchema);
export default mongoose;
