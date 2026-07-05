import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

/**
 * Strict MongoDB Connection
 */
export const connectDB = async () => {
    if (!MONGODB_URI) {
        logger.error('❌ [CRITICAL] MONGODB_URI is missing!');
        process.exit(1);
    }

    try {
        // Disable buffering to prevent "buffering timed out" errors
        mongoose.set('bufferCommands', false);
        
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4
        });
        
        logger.info('✅ MongoDB Connected Successfully');
    } catch (error) {
        logger.error(`❌ MongoDB Connection Failed: ${error.message}`);
        process.exit(1);
    }
};

// Runtime Monitoring
mongoose.connection.on('error', err => {
    logger.error(`❌ MongoDB Runtime Error: ${err.message}`);
});

// Schemas
const userSchema = new mongoose.Schema({
    fb_id: { type: String, unique: true, required: true },
    name: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    last_active: Date,
    created_at: { type: Date, default: Date.now }
});

const mangaSchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    cover_url: String,
    source_url: String,
    auto_update: { type: Boolean, default: false },
    updated_at: { type: Date, default: Date.now }
});

const chapterSchema = new mongoose.Schema({
    manga_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Manga' },
    chapter_number: Number,
    chapter_url: String,
    is_published: { type: Boolean, default: false }
});
chapterSchema.index({ manga_id: 1, chapter_number: 1 }, { unique: true });

const queueSchema = new mongoose.Schema({
    manga_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Manga' },
    chapter_number: Number,
    status: { type: String, default: 'pending' },
    created_at: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const Manga = mongoose.model('Manga', mangaSchema);
export const Chapter = mongoose.model('Chapter', chapterSchema);
export const Queue = mongoose.model('Queue', queueSchema);
