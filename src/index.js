import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { connectDB } from './database/mongodb.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// 🎯 Railway Healthcheck Route (MUST BE ACCESSIBLE IMMEDIATELY)
app.get('/', (req, res) => res.status(200).send('🚀 Okami Bot API is ONLINE'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

// Global Error Handlers
process.on('uncaughtException', (err) => {
    logger.error(`❌ Uncaught Exception: ${err.message}`);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`❌ Unhandled Rejection: ${reason}`);
});

/**
 * PRODUCTION STARTUP SEQUENCE
 */
async function bootstrap() {
    // 1. START SERVER IMMEDIATELY (Crucial for Railway Healthcheck)
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`✅ Server is listening on port ${PORT}`);
        logger.info(`🔗 Healthcheck active at: http://0.0.0.0:${PORT}/health`);
    });

    // 2. CONNECT TO DATABASE IN BACKGROUND
    const dbConnected = await connectDB();
    if (!dbConnected) {
        logger.warn('⚠️ Server started without MongoDB. Some features may be limited.');
    }

    // 3. Graceful Shutdown
    const shutdown = () => {
        logger.info('SIGTERM received. Cleaning up...');
        server.close(async () => {
            const mongoose = await import('mongoose');
            await mongoose.default.connection.close();
            process.exit(0);
        });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

bootstrap();
