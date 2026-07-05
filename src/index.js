import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { connectDB } from './database/mongodb.js';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// 🎯 Railway Healthcheck Routes (Instant Response)
app.get('/', (req, res) => res.status(200).send('🚀 Okami Bot API is ONLINE'));
app.get('/health', async (req, res) => {
    let dbStatus = 'unknown';
    try {
        const mongoose = await import('mongoose');
        dbStatus = mongoose.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    } catch (e) {
        dbStatus = 'error';
    }
    
    res.status(200).json({ 
        status: 'ok', 
        database: dbStatus,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handlers
process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught Exception: ${err.message}`);
    // Graceful exit after logging
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`❌ Unhandled Rejection: ${reason}`);
});

/**
 * PRODUCTION BOOTSTRAP
 */
async function bootstrap() {
    // 1. OPEN PORT IMMEDIATELY (Prevents Railway Healthcheck Timeout)
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`✅ Server is listening on port ${PORT}`);
        logger.info(`🔗 Healthcheck URL: http://0.0.0.0:${PORT}/health`);
    });

    // 2. CONNECT TO DATABASE (Background)
    try {
        await connectDB();
    } catch (err) {
        logger.error('⚠️ Database connection failed during bootstrap.');
    }

    // 3. GRACEFUL SHUTDOWN (Handles SIGTERM/SIGINT correctly)
    const handleShutdown = (signal) => {
        logger.info(`${signal} received. Closing server gracefully...`);
        server.close(async () => {
            try {
                const mongoose = await import('mongoose');
                if (mongoose.default.connection.readyState !== 0) {
                    await mongoose.default.connection.close();
                    logger.info('MongoDB connection closed.');
                }
            } catch (e) {
                // Ignore close errors
            }
            logger.info('Safe shutdown complete.');
            process.exit(0);
        });
        
        // Force exit after 10s if graceful shutdown fails
        setTimeout(() => {
            logger.error('Could not close connections in time, forceful shutdown.');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrap();
