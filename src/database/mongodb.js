import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Robust MongoDB Connection with Auto-Sanitization
 */
export const connectDB = async () => {
    // 1. Force Clean URI (remove any spaces or quotes)
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    const MONGODB_URI = rawUri.replace(/['"]/g, '').trim();

    // 2. Validate Protocol
    if (!MONGODB_URI) {
        logger.error('❌ [ERROR] MONGODB_URI is not defined in environment variables.');
        return false;
    }

    if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
        logger.error(`❌ [ERROR] Invalid MongoDB Scheme. URI starts with: "${MONGODB_URI.substring(0, 15)}..."`);
        return false;
    }

    try {
        logger.info('⏳ Attempting to connect to MongoDB...');
        
        // Disable buffering to prevent operations from hanging if DB is down
        mongoose.set('bufferCommands', false);
        
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        
        logger.info('✅ MongoDB Connected Successfully');
        return true;
    } catch (error) {
        logger.error(`❌ MongoDB Connection Failed: ${error.message}`);
        return false; // Return false instead of process.exit to keep the server alive for healthchecks
    }
};

// Monitor Runtime Errors
mongoose.connection.on('error', err => {
    logger.error(`❌ MongoDB Runtime Error: ${err.message}`);
});

// Schemas
const userSchema = new mongoose.Schema({ fb_id: { type: String, unique: true }, name: String });
const mangaSchema = new mongoose.Schema({ title: String, slug: { type: String, unique: true } });

export const User = mongoose.model('User', userSchema);
export const Manga = mongoose.model('Manga', mangaSchema);
