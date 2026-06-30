import express from 'express';
import axios from 'axios';
import https from 'https';
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

// --- سجل شامل لجميع الطلبات الواردة للتشخيص ---
app.use((req, res, next) => {
    // طباعة كل الطلبات التي تصل للمسارات المتعلقة بالـ Webhook للتشخيص
    if (req.path.includes('webhook')) {
        logger.info(`[DEBUG-ROUTER] Request Received: ${req.method} ${req.url}`);
        logger.info(`[DEBUG-ROUTER] Headers: ${JSON.stringify(req.headers)}`);
    }
    next();
});

// 3. Webhook فيسبوك (التحقق)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        logger.info(`[DEBUG-VERIFY] Mode: ${mode}, Received Token: "${token}", Expected Token: "${config.facebook.verifyToken}"`);
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            logger.info('[DEBUG-VERIFY] Success! Tokens match.');
            res.status(200).send(challenge);
        } else {
            logger.warn('[DEBUG-VERIFY] Failed! Tokens do NOT match.');
            res.sendStatus(403);
        }
    }
});

// 4. معالجة رسائل Webhook (بشكل غير متزامن)
app.post('/webhook', (req, res) => {
    const body = req.body;

    // --- DEBUG: طباعة محتوى الـ Webhook الوارد لمراقبة الرسائل في السجلات ---
    logger.info(`[WEBHOOK] Received event: ${JSON.stringify(body)}`);

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED');

        (async () => {
            try {
                for (const entry of body.entry) {
                    if (!entry.messaging) {
                        logger.warn(`[WEBHOOK] Entry received but no messaging data found.`);
                        continue;
                    }
                    
                    for (const webhook_event of entry.messaging) {
                        const sender_id = webhook_event.sender.id;
                        logger.info(`[WEBHOOK] Message from sender: ${sender_id}`);

                        if (webhook_event.message && webhook_event.message.text) {
                            const incomingText = webhook_event.message.text;
                            logger.info(`[WEBHOOK] Text received: "${incomingText}"`);

                            const responseText = await DialogueServiceEnhanced.handleMessage(sender_id, incomingText);
                            
                            if (responseText) {
                                logger.info(`[WEBHOOK] Sending response to ${sender_id}...`);
                                const result = await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                                logger.info(`[WEBHOOK] Response sent successfully. Result: ${JSON.stringify(result)}`);
                            } else {
                                logger.warn(`[WEBHOOK] No response text generated for message.`);
                            }
                        } else {
                            logger.warn(`[WEBHOOK] Received event is not a text message.`);
                        }
                    }
                }
            } catch (error) {
                logger.error(`[WEBHOOK] Background Error: ${error.message}`);
                logger.error(error.stack);
            }
        })();
    } else {
        logger.warn(`[WEBHOOK] Object is not 'page': ${body.object}`);
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
        
        // --- اختبار ذاتي للـ Facebook Token (نسخة ULTRA) ---
        (async () => {
            const versions = ['v25.0', 'v22.0', 'v21.0', 'v19.0'];
            const cleanToken = config.facebook.accessToken.trim();
            const agent = new https.Agent({ rejectUnauthorized: false });
            
            for (const v of versions) {
                try {
                    logger.info(`[ULTRA-CHECK] Testing via ${v}...`);
                    const response = await axios.get(`https://graph.facebook.com/${v}/me`, {
                        params: { access_token: cleanToken },
                        httpsAgent: agent,
                        timeout: 10000
                    });
                    logger.info(`[ULTRA-CHECK] Success via ${v}! Connected as: ${response.data.name}`);
                    return;
                } catch (e) {
                    logger.warn(`[ULTRA-CHECK] ${v} failed: ${e.message}`);
                }
            }
            logger.error('[ULTRA-CHECK] ALL VERSIONS FAILED. Check network/token.');
        })();

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
