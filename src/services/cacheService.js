import mongoose from 'mongoose';
import { Cache } from '../models/Cache.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class CacheService {
    constructor() {
        this.isConnected = false;
        this.init();
    }

    async init() {
        if (!config.database.mongoUri) {
            logger.warn('MongoDB URI not found. Caching is disabled.');
            return;
        }

        try {
            await mongoose.connect(config.database.mongoUri);
            this.isConnected = true;
            logger.info('Connected to MongoDB for caching.');
        } catch (error) {
            logger.error('MongoDB connection error:', error.message);
        }
    }

    async get(key) {
        if (!this.isConnected) return null;
        try {
            const cached = await Cache.findOne({ key });
            return cached ? cached.data : null;
        } catch (error) {
            logger.error(`Cache Get Error [${key}]:`, error.message);
            return null;
        }
    }

    async set(key, data, source) {
        if (!this.isConnected) return;
        try {
            await Cache.findOneAndUpdate(
                { key },
                { data, source, createdAt: new Date() },
                { upsert: true }
            );
        } catch (error) {
            logger.error(`Cache Set Error [${key}]:`, error.message);
        }
    }
}

export default new CacheService();
