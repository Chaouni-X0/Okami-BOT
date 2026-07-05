import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { connectDB } from './database/mongodb.js';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check (Immediate)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 8080;

/**
 * PRODUCTION READY STARTUP
 */
async function start() {
    try {
        // 1. Force MongoDB Connection First
        await connectDB();

        // 2. Start Server only after DB is ready
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Okami Bot Production Server running on port ${PORT}`);
        });

        // 3. Graceful Shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received. Closing server...');
            server.close(() => {
                import('mongoose').then(m => m.default.connection.close(false, () => {
                    logger.info('Process terminated safely.');
                    process.exit(0);
                }));
            });
        });

    } catch (err) {
        logger.error(`❌ Fatal Startup Error: ${err.message}`);
        process.exit(1);
    }
}

start();
