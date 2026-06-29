import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';

const connectWithRetry = () => {
    if (!config.mongodb.uri) {
        logger.warn('MONGODB_URI is not defined. Persistent data features will be limited.');
        return;
    }

    mongoose.connect(config.mongodb.uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    })
    .then(() => logger.info('Connected to MongoDB Atlas'))
    .catch(err => {
        logger.error(`MongoDB connection error: ${err.message}. Retrying in 5 seconds...`);
        setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

const userSchema = new mongoose.Schema({
    fb_id: { type: String, unique: true, required: true, index: true },
    name: String,
    xp: { type: Number, default: 0, index: true },
    level: { type: Number, default: 1 },
    points: { type: Number, default: 0, index: true },
    streak: { type: Number, default: 0 },
    last_active: { type: Date, default: Date.now },
    guild_id: String,
    created_at: { type: Date, default: Date.now }
});

const mangaSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, unique: true, required: true, index: true },
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
