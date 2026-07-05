import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './utils/logger.js';
import { connectDB } from './database/mongodb.js';
import automationService from './services/automationService.js';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health Check Endpoint (Immediate response)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 8080;

/**
 * STARTUP SEQUENCE
 * 1. Connect to MongoDB
 * 2. Start Express Server
 * 3. Initialize Background Services
 */
const startServer = async () => {
    try {
        // Step 1: Strict MongoDB Connection
        await connectDB();

        // Step 2: Start Express Server only if DB is ready
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Okami Bot API is ONLINE on port ${PORT}`);
        });

        // Step 3: Initialize background services
        setImmediate(async () => {
            try {
                await automationService.init();
                logger.info('✅ Background Automation Services started.');
            } catch (e) {
                logger.error(`⚠️ Automation Service failed to start: ${e.message}`);
            }
        });

        // Graceful Shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                import('mongoose').then(m => m.default.connection.close(false, () => {
                    logger.info('MongoDB connection closed. Process terminated.');
                    process.exit(0);
                }));
            });
        });

    } catch (error) {
        logger.error(`[FATAL] Startup failed: ${error.message}`);
        process.exit(1);
    }
};

startServer();
