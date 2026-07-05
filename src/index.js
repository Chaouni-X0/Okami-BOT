import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { connectDB } from './database/mongodb.js';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

// Global Error Handlers - Critical for Production
process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught Exception: ${err.message}`);
    logger.error(err.stack);
    // Give some time for logs to write
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
    // No need to exit, but logging is crucial
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 🎯 Railway Healthcheck Route (CRITICAL)
app.get('/', (req, res) => {
    res.status(200).send('🚀 Okami Bot API is ONLINE');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

// Dynamic PORT for Railway
const PORT = process.env.PORT || 8080;

/**
 * PRODUCTION STARTUP
 */
async function start() {
    try {
        // 1. Connect to Database First
        await connectDB();

        // 2. Start Listening on 0.0.0.0 (Required for Railway/Docker)
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`✅ Server is running on port ${PORT}`);
            logger.info(`🔗 Healthcheck URL: http://0.0.0.0:${PORT}/`);
        });

        // 3. Graceful Shutdown
        const shutdown = () => {
            logger.info('SIGTERM/SIGINT received. Closing server...');
            server.close(async () => {
                const mongoose = await import('mongoose');
                await mongoose.default.connection.close();
                logger.info('Safe shutdown complete.');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (err) {
        logger.error(`❌ Fatal Startup Error: ${err.message}`);
        process.exit(1);
    }
}

start();
