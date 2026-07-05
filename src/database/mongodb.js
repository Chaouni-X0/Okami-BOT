import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

export const connectDB = async () => {
    if (!MONGODB_URI) {
        logger.error('[CRITICAL] MONGODB_URI is missing in environment variables!');
        process.exit(1);
    }

    try {
        logger.info('Attempting to connect to MongoDB...');
        
        // Disable buffering to prevent "buffering timed out" errors
        mongoose.set('bufferCommands', false);

        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000, // 10 seconds to find the server
            socketTimeoutMS: 45000,
            family: 4
        });

        logger.info('✅ Successfully connected to MongoDB.');
    } catch (error) {
        logger.error(`❌ MongoDB Connection Failed: ${error.message}`);
        // Exit process if DB connection fails - prevent inconsistent state
        process.exit(1);
    }
};

// Monitor Connection Status
mongoose.connection.on('error', (err) => {
    logger.error(`❌ MongoDB Runtime Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

// User Schema
const userSchema = new mongoose.Schema({
    fb_id: { type: String, unique: true, required: true },
    name: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    last_active: Date,
    guild_id: Number,
    created_at: { type: Date, default: Date.now }
});

// Manga Schema
const mangaSchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    cover_url: String,
    status: String,
    source_site_key: String,
    source_url: String,
    auto_update: { type: Boolean, default: false },
    aggregation_post_id: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Chapter Schema
const chapterSchema = new mongoose.Schema({
    manga_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Manga' },
    chapter_number: Number,
    chapter_url: String,
    fb_post_id: String,
    is_published: { type: Boolean, default: false },
    published_at: Date
});
chapterSchema.index({ manga_id: 1, chapter_number: 1 }, { unique: true });

// Queue Schema
const queueSchema = new mongoose.Schema({
    manga_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Manga' },
    chapter_number: Number,
    chapter_url: String,
    source_key: String,
    admin_fb_id: String,
    status: { type: String, default: 'pending' }, // pending, processing, completed, failed
    created_at: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const Manga = mongoose.model('Manga', mangaSchema);
export const Chapter = mongoose.model('Chapter', chapterSchema);
export const Queue = mongoose.model('Queue', queueSchema);
