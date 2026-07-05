import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Strict MongoDB Connection with URI Sanitization
 */
export const connectDB = async () => {
    // 1. Get and sanitize the URI (handle both common names)
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    const MONGODB_URI = rawUri.trim();

    // 2. Strict Protocol Validation
    if (!MONGODB_URI) {
        logger.error('❌ [FATAL] MongoDB Connection String is missing!');
        process.exit(1);
    }

    if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
        logger.error(`❌ [FATAL] Invalid MongoDB Scheme. Received: "${MONGODB_URI.substring(0, 20)}..."`);
        logger.error('Ensure MONGODB_URI starts with mongodb:// or mongodb+srv:// and has no quotes or spaces.');
        process.exit(1);
    }

    try {
        logger.info('Connecting to MongoDB...');
        
        // Disable buffering to prevent hanging operations
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

// Monitor Connection
mongoose.connection.on('error', err => {
    logger.error(`❌ MongoDB Runtime Error: ${err.message}`);
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
    created_at: { type: Date, default: Date.now }
});

// Manga Schema
const mangaSchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    cover_url: String,
    source_url: String,
    auto_update: { type: Boolean, default: false },
    updated_at: { type: Date, default: Date.now }
});

// Chapter Schema
const chapterSchema = new mongoose.Schema({
    manga_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Manga' },
    chapter_number: Number,
    chapter_url: String,
    is_published: { type: Boolean, default: false }
});
chapterSchema.index({ manga_id: 1, chapter_number: 1 }, { unique: true });

// Queue Schema
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
