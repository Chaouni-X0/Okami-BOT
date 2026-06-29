import express from 'express';
import { config } from './config/config.js';
import db from './database/db.js';
import { User, Manga } from './database/mongo.js';
import { DialogueService } from './services/dialogue.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import { QueueSystem } from './modules/queue.js';
import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';

// --- Global Error Handling & Crash Prevention ---
process.on('uncaughtException', (error) => {
    logger.error(`CRITICAL: Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json());
app.use(express.static('public')); // For dashboard assets

// --- Dashboard & Stats API ---
app.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const mangaCount = await Manga.countDocuments();
        const topUsers = await User.find().sort({ points: -1 }).limit(5);
        
        const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Okami Bot Dashboard 🐺</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { background-color: #0a0a0a; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .neon-border { border: 1px solid #bf00ff; box-shadow: 0 0 10px #bf00ff; }
                .neon-text { color: #bf00ff; text-shadow: 0 0 5px #bf00ff; }
            </style>
        </head>
        <body class="p-8">
            <div class="max-w-4xl mx-auto">
                <header class="text-center mb-12">
                    <h1 class="text-5xl font-bold neon-text mb-4">Okami Bot Dashboard 🐺</h1>
                    <p class="text-gray-400">نظام إدارة ومراقبة البوت - Hugging Face Edition</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div class="bg-zinc-900 p-6 rounded-xl neon-border text-center">
                        <h2 class="text-xl text-gray-400 mb-2">عدد المستخدمين</h2>
                        <p class="text-4xl font-bold">${userCount}</p>
                    </div>
                    <div class="bg-zinc-900 p-6 rounded-xl neon-border text-center">
                        <h2 class="text-xl text-gray-400 mb-2">عدد المانهوا</h2>
                        <p class="text-4xl font-bold">${mangaCount}</p>
                    </div>
                    <div class="bg-zinc-900 p-6 rounded-xl neon-border text-center">
                        <h2 class="text-xl text-gray-400 mb-2">حالة السيرفر</h2>
                        <p class="text-4xl font-bold text-green-500">متصل</p>
                    </div>
                </div>

                <div class="bg-zinc-900 p-8 rounded-xl neon-border">
                    <h2 class="text-2xl font-bold mb-6 neon-text">أفضل 5 مستخدمين (نقابات)</h2>
                    <table class="w-full text-right">
                        <thead>
                            <tr class="border-b border-zinc-800 text-gray-400">
                                <th class="pb-4">المستخدم</th>
                                <th class="pb-4">النقاط</th>
                                <th class="pb-4">المستوى</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topUsers.map(u => `
                                <tr class="border-b border-zinc-800">
                                    <td class="py-4 font-bold">${u.name || u.fb_id}</td>
                                    <td class="py-4 text-purple-400">${u.points}</td>
                                    <td class="py-4 text-gray-400">${u.level}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <footer class="mt-12 text-center text-gray-600">
                    <p>&copy; 2026 Okami Bot System - Created for dark anime lovers</p>
                </footer>
            </div>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send("Error loading dashboard");
    }
});

// Webhook لفيسبوك
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

app.post('/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED');
        (async () => {
            try {
                for (const entry of body.entry) {
                    if (!entry.messaging) continue;
                    const webhook_event = entry.messaging[0];
                    const sender_id = webhook_event.sender.id;
                    if (webhook_event.message && webhook_event.message.text) {
                        const responseText = await DialogueService.handleMessage(sender_id, webhook_event.message.text);
                        if (responseText) {
                            await FacebookPublisher.sendDirectMessage(sender_id, responseText);
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

// --- Resource Management: Cleanup Task ---
const TEMP_DIR = path.resolve('./src/temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

setInterval(() => {
    try {
        const now = Date.now();
        const files = fs.readdirSync(TEMP_DIR);
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            const stats = fs.statSync(filePath);
            const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
            if (ageMinutes > 10) {
                if (stats.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
                else fs.unlinkSync(filePath);
            }
        }
    } catch (error) {
        logger.error(`Cleanup Engine Error: ${error.message}`);
    }
}, 60 * 60 * 1000);

// --- Server Startup ---
const startServer = (port) => {
    const server = app.listen(port, async () => {
        logger.info(`Okami Bot Dashboard running on port ${port}`);
        try {
            await QueueSystem.resumeQueue();
        } catch (e) {
            logger.error(`Queue Resume Error: ${e.message}`);
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            setTimeout(() => startServer(0), 1000);
        }
    });
};

startServer(config.port);
