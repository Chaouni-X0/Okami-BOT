import express from 'express';
import { config } from './config/config.js';
import db from './database/db.js';
import { User, Manga } from './database/mongo.js';
import { DialogueService } from './services/dialogue.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import { QueueSystem } from './modules/queue.js';
import scraperEngine from './modules/scraper.js';
import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// --- Global Error Handling (Zero-Failure Architecture) ---
process.on('uncaughtException', (error) => {
    logger.error(`[CRITICAL] Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async () => {
    logger.warn('Initiating graceful shutdown...');
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            logger.info('MongoDB connection closed.');
        }
        logger.info('Graceful shutdown complete. Exiting.');
        process.exit(0);
    } catch (err) {
        logger.error(`Error during shutdown: ${err.message}`);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// --- Dashboard HTML ---
app.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments().catch(() => 0);
        const mangaCount = await Manga.countDocuments().catch(() => 0);
        
        const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Okami Bot Pro Dashboard 🐺</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                body { background-color: #050505; color: #e5e7eb; font-family: 'Inter', sans-serif; }
                .neon-glow { box-shadow: 0 0 15px rgba(191, 0, 255, 0.4); border: 1px solid #bf00ff; }
                .neon-text { color: #bf00ff; text-shadow: 0 0 8px rgba(191, 0, 255, 0.6); }
                .command-input:focus { outline: none; border-color: #bf00ff; box-shadow: 0 0 10px rgba(191, 0, 255, 0.5); }
                .sidebar { background: #0a0a0a; border-left: 1px solid #1f2937; }
                .card { background: #0d0d0d; border: 1px solid #1f2937; transition: all 0.3s; }
                .card:hover { border-color: #bf00ff; transform: translateY(-2px); }
            </style>
        </head>
        <body class="flex h-screen overflow-hidden">
            <aside class="w-64 sidebar p-6 flex flex-col">
                <div class="mb-10 text-center">
                    <h1 class="text-3xl font-bold neon-text">OKAMI 🐺</h1>
                    <p class="text-xs text-gray-500 mt-1">v5.2.1 Resilience Edition</p>
                </div>
                <nav class="flex-1 space-y-4">
                    <a href="#" class="flex items-center p-3 text-purple-400 bg-purple-900/10 rounded-lg"><i class="fas fa-chart-line ml-3"></i> الإحصائيات</a>
                </nav>
            </aside>
            <main class="flex-1 flex flex-col overflow-hidden">
                <header class="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/50">
                    <div class="relative w-96">
                        <i class="fas fa-terminal absolute right-3 top-3 text-gray-500"></i>
                        <input id="commandInput" type="text" placeholder="اكتب / للأوامر السريعة..." class="w-full bg-black border border-zinc-700 rounded-lg py-2 pr-10 pl-4 command-input text-sm">
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="flex items-center text-xs text-green-500"><i class="fas fa-circle mr-2 text-[8px]"></i> متصل</span>
                    </div>
                </header>
                <div class="flex-1 overflow-y-auto p-8">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="card p-6 rounded-2xl">
                            <p class="text-gray-500 text-sm">إجمالي المستخدمين</p>
                            <h3 class="text-3xl font-bold mt-2">${userCount}</h3>
                        </div>
                        <div class="card p-6 rounded-2xl">
                            <p class="text-gray-500 text-sm">الأعمال المسجلة</p>
                            <h3 class="text-3xl font-bold mt-2">${mangaCount}</h3>
                        </div>
                    </div>
                </div>
            </main>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send("Error loading dashboard");
    }
});

// --- Command API ---
app.post('/api/command', async (req, res) => {
    const { command } = req.body;
    try {
        if (!command) return res.status(400).json({ output: 'No command provided', type: 'error' });
        
        if (command.startsWith('/search ')) {
            const query = command.replace('/search ', '');
            const results = await scraperEngine.searchAll(query);
            const output = results.length > 0 ? results.map(r => `[${r.sourceName}] ${r.title}`).join('<br>') : 'لا توجد نتائج.';
            return res.json({ output: 'نتائج البحث:<br>' + output, type: 'success' });
        }
        
        res.json({ output: 'أمر غير معروف.', type: 'error' });
    } catch (error) {
        res.json({ output: 'خطأ: ' + error.message, type: 'error' });
    }
});

// --- Webhook Verification (GET) ---
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            logger.info('Webhook Verified Successfully');
            res.status(200).send(challenge);
        } else {
            logger.warn('Webhook verification failed - invalid token');
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// --- Webhook Event Receiver (POST) ---
app.post('/webhook', (req, res) => {
    const body = req.body;
    
    // [DIAGNOSTIC] Log incoming webhook structure
    logger.info(`[Webhook] Incoming request: ${JSON.stringify(body).substring(0, 500)}...`);

    if (body.object === 'page') {
        // Immediate response to Facebook to prevent timeouts
        res.status(200).send('EVENT_RECEIVED');

        (async () => {
            for (const entry of body.entry) {
                try {
                    if (!entry.messaging || entry.messaging.length === 0) {
                        logger.warn(`[Webhook] Entry has no messaging data: ${entry.id}`);
                        continue;
                    }

                    const webhook_event = entry.messaging[0];
                    const sender_id = webhook_event.sender?.id;

                    // Skip echo messages (messages sent by the bot itself)
                    if (webhook_event.message?.is_echo) {
                        logger.debug('[Webhook] Skipping echo message');
                        continue;
                    }

                    // [DIAGNOSTIC] Log sender info
                    logger.info(`[Webhook] Message from sender: ${sender_id}`);

                    if (webhook_event.message && webhook_event.message.text) {
                        const incomingText = webhook_event.message.text;
                        logger.info(`[Webhook] Text received: "${incomingText}"`);

                        const responseText = await DialogueService.handleMessage(sender_id, incomingText);
                        
                        if (responseText) {
                            logger.info(`[Webhook] Sending response to ${sender_id}: "${responseText.substring(0, 50)}..."`);
                            const success = await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                            if (!success) {
                                logger.error(`[Webhook] Failed to send response to ${sender_id}. Check FB_ACCESS_TOKEN and Page permissions.`);
                            }
                        }
                    } else if (webhook_event.postback) {
                        logger.info(`[Webhook] Postback received: ${JSON.stringify(webhook_event.postback)}`);
                    }
                } catch (error) {
                    logger.error(`[Webhook Critical Error]: ${error.message}`);
                    logger.error(error.stack);
                }
            }
        })();
    } else {
        logger.warn(`[Webhook] Received non-page object: ${body.object}`);
        res.sendStatus(404);
    }
});

// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Server Boot ---
const startServer = (port) => {
    const server = app.listen(port, async () => {
        logger.info(`Okami Bot Dashboard running on port ${port}`);
        try {
            await QueueSystem.resumeQueue();
        } catch (e) {
            logger.error(`Queue Resume Error: ${e.message}`);
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.warn(`Port ${port} in use, retrying on random port...`);
            setTimeout(() => startServer(0), 1000);
        }
    });
};

startServer(config.port);
