import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import scraperRoutes from './routes/scraperRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();

/**
 * 1. التكوين الديناميكي للمنفذ (CRITICAL FOR RAILWAY)
 */
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 2. مسارات التطبيق
app.use('/api/scraper', scraperRoutes);
app.use('/api/admin', adminRoutes);

// 3. مسار اختبار الصحة (Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        dbStatus: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED'
    });
});

app.get('/', (req, res) => res.send('🚀 Okami Bot Production API is ONLINE'));

/**
 * 4. تشغيل الخادم مع الربط بـ 0.0.0.0
 */
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is listening on port ${PORT}`);
});

/**
 * 5. الاتصال بقاعدة البيانات في الخلفية
 */
const connectDatabase = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!uri) {
            console.error('❌ MONGODB_URI is missing!');
            return;
        }
        
        // Sanitize URI
        const sanitizedUri = uri.replace(/['"]/g, '').trim();
        
        await mongoose.connect(sanitizedUri, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('🍃 MongoDB Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
    }
};

connectDatabase();

/**
 * 6. معالجة الإغلاق الآمن (Graceful Shutdown)
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

    setTimeout(() => {
        console.error('Forceful shutdown');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
