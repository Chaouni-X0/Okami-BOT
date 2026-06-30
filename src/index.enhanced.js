import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config, validateConfig } from './config/config.enhanced.js';
import db from './database/db.js';
import mongoose from './database/mongo.js';
import DialogueServiceEnhanced from './services/dialogue.service.enhanced.js';
import { FacebookPublisher } from './modules/publisher.js';
import { QueueSystem } from './modules/queue.js';
import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * 🐺 Okami Bot - Main Entry Point (Enhanced)
 * النسخة المحسّنة مع دعم واجهة التحكم وقاعدة البيانات المزدوجة
 */

// 1. التحقق من الإعدادات
validateConfig();

// 2. معالجة الأخطاء العالمية ومنع الانهيار
process.on('uncaughtException', (error) => {
    logger.error(`CRITICAL: Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

// --- Proxy لإعادة توجيه واجهة التحكم إلى Streamlit (المنفذ 8501) ---
// يتم توجيه جميع الطلبات ما عدا /webhook و /status إلى Streamlit
app.use((req, res, next) => {
    if (req.path === '/webhook' || req.path === '/status') {
        return next();
    }
    // تمرير الطلبات الأخرى إلى Streamlit
    createProxyMiddleware({
        target: 'http://localhost:8501',
        changeOrigin: true,
        ws: true, // دعم WebSockets لـ Streamlit
        logLevel: 'silent'
    })(req, res, next);
});

app.use(express.json());

// 3. Webhook فيسبوك (التحقق)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            logger.info('Webhook verified successfully!');
            res.status(200).send(challenge);
        } else {
            logger.warn('Webhook verification failed: Invalid token');
            res.sendStatus(403);
        }
    }
});

// 4. معالجة رسائل Webhook (بشكل غير متزامن)
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        // الرد الفوري على فيسبوك
        res.status(200).send('EVENT_RECEIVED');

        // المعالجة في الخلفية
        (async () => {
            try {
                for (const entry of body.entry) {
                    if (!entry.messaging) continue;
                    
                    for (const webhook_event of entry.messaging) {
                        const sender_id = webhook_event.sender.id;

                        // معالجة الرسائل النصية
                        if (webhook_event.message && webhook_event.message.text) {
                            const responseText = await DialogueServiceEnhanced.handleMessage(sender_id, webhook_event.message.text);
                            
                            if (responseText) {
                                await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error(`Background Webhook Error: ${error.message}`);
            }
        })();
    } else {
        res.sendStatus(404);
    }
});

// 5. مسارات الحالة والمعلومات
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: '🐺 Okami Bot (Enhanced Edition)', 
        version: config.app.version,
        environment: config.app.environment,
        database: {
            sqlite: 'connected',
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        }
    });
});

// 6. إدارة الموارد (مهمة التنظيف)
const TEMP_DIR = config.storage.tempDir;
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

setInterval(() => {
    try {
        const now = Date.now();
        const files = fs.readdirSync(TEMP_DIR);
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);
            const ageMs = now - stats.mtimeMs;
            
            if (ageMs > config.storage.maxTempAge) {
                if (stats.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                logger.info(`[Cleanup] Deleted old temp file: ${file}`);
            }
        }
    } catch (error) {
        logger.error(`Cleanup Engine Error: ${error.message}`);
    }
}, config.storage.cleanupInterval);

// 7. تشغيل الخادم
const startServer = (port) => {
    const server = app.listen(port, async () => {
        logger.info(`Okami Bot API running on port ${port}`);
        try {
            await QueueSystem.resumeQueue();
        } catch (e) {
            logger.error(`Queue Resume Error: ${e.message}`);
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.warn(`Port ${port} is already in use. Trying a random port...`);
            setTimeout(() => {
                startServer(0);
            }, 1000);
        } else {
            logger.error(`Server Error: ${err.message}`);
        }
    });
};

const PORT = config.app.port;
startServer(PORT);
