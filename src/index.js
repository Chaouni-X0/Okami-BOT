import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();

/**
 * 🛠️ 1. التكوين الديناميكي للمنفذ (CRITICAL FOR RAILWAY)
 * Railway sets process.env.PORT dynamically. NEVER hardcode 8080.
 */
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 2. مسارات التطبيق
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

/**
 * 🎯 3. مسار اختبار الصحة (Health Check)
 * Railway requires a fast 200 OK response to avoid SIGTERM.
 */
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/healthz', (req, res) => res.status(200).send('OK'));

app.get('/status', (req, res) => {
    res.status(200).json({
        status: 'UP',
        db: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => res.send('🚀 Okami Bot Production API is ONLINE'));

/**
 * 🌐 4. تشغيل الخادم مع الربط بـ 0.0.0.0
 * Binding to 0.0.0.0 is mandatory for container visibility.
 */
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is listening on dynamic port: ${PORT}`);
});

/**
 * 🍃 5. الاتصال بقاعدة البيانات في الخلفية
 * We start listening first, then connect to DB to pass health checks faster.
 */
const connectDatabase = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!uri) {
            console.error('❌ MONGODB_URI is missing from environment variables!');
            return;
        }
        
        // Sanitize URI (remove quotes/spaces)
        const sanitizedUri = uri.replace(/['"]/g, '').trim();
        
        await mongoose.connect(sanitizedUri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('🍃 MongoDB Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
    }
};

connectDatabase();

/**
 * 🛡️ 6. معالجة الإغلاق الآمن (Graceful Shutdown)
 * Handle Railway's SIGTERM signal to close connections properly.
 */
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('📡 HTTP server closed.');
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('🍃 MongoDB connection closed.');
        }
        process.exit(0);
    });

    // Force exit after 10s if connections hang
    setTimeout(() => {
        console.error('Forceful shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
