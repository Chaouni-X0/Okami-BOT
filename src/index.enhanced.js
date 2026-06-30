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

// زيادة حد المستمعين لتجنب تحذيرات Memory Leak الناتجة عن اتصالات الـ Proxy المكثفة لـ Streamlit
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 0; // غير محدود لمنع أي ضياع للطلبات

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

// نظام استقبال الـ Webhook (نسخة نظيفة)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.facebook.verifyToken) {
        logger.info('[WEBHOOK] Verified successfully.');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        // رد فوري لفيسبوك لتجنب إعادة إرسال نفس الرسالة (Retry)
        res.status(200).send('EVENT_RECEIVED');

        // معالجة الرسائل في الخلفية لضمان السرعة
        body.entry.forEach(async (entry) => {
            if (entry.messaging) {
                for (const event of entry.messaging) {
                    const senderId = event.sender.id;
                    if (event.message && event.message.text) {
                        logger.info(`[MSG] Received from ${senderId}: "${event.message.text}"`);
                        // تنفيذ المعالجة والإرسال دون انتظار الاستجابة الكاملة للـ Webhook
                        DialogueServiceEnhanced.handleMessage(senderId, event.message.text)
                            .then(responseText => {
                                if (responseText) {
                                    FacebookPublisher.sendDirectMessage(senderId, responseText);
                                }
                            })
                            .catch(err => logger.error(`[MSG] Error handling message: ${err.message}`));
                    }
                }
            }
        });
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

// --- مسار اختبار يدوي لإرسال رسالة ترحيبية ---
app.get('/test-send', async (req, res) => {
    const sender_id = req.query.uid;
    if (!sender_id) return res.send('Please provide ?uid=YOUR_FACEBOOK_ID');
    
    logger.info(`[TEST-SEND] Attempting to send test message to ${sender_id}...`);
    const result = await FacebookPublisher.sendDirectMessage(sender_id, "🐺 أهلاً بك! أنا بوت أوكامي، وهذا اختبار إرسال يدوي بنجاح.");
    
    if (result) {
        res.send('✅ Success! Check your Facebook Messenger.');
    } else {
        res.status(500).send('❌ Failed! Check Hugging Face Logs for error details.');
    }
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
        
        // --- اختبار ذاتي للـ Facebook Token (تم إيقافه لتجنب مشاكل الشبكة في Hugging Face) ---
        /*
        (async () => {
            try {
                const cleanToken = config.facebook.accessToken.trim();
                logger.info('[CHECK] Testing Facebook Access Token via v21.0...');
                const response = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${cleanToken}`, {
                    headers: { 'User-Agent': 'OkamiBot/5.0' },
                    signal: AbortSignal.timeout(15000)
                });
                
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Facebook API Error: ${response.status} - ${errText}`);
                }

                const data = await response.json();
                logger.info(`[CHECK] Success! Connected as: ${data.name}`);
            } catch (e) {
                logger.error(`[CHECK] Failed: ${e.message}`);
            }
        })();
        */

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
