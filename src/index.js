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
app.use(express.urlencoded({ extended: true }));

// --- Global Error Handling ---
process.on('uncaughtException', (error) => {
    logger.error(`[CRITICAL] Uncaught Exception: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// --- Dashboard HTML (Professional Pro Edition) ---
app.get('/', async (req, res) => {
    try {
        const userCount = await User.countDocuments().catch(() => 0);
        const mangaCount = await Manga.countDocuments().catch(() => 0);
        const activeTasks = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending' OR status = 'processing'").get().count;
        const mangas = await Manga.find().sort({ updated_at: -1 }).limit(10).catch(() => []);
        
        const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Okami Bot | Command Center 🐺</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;700&display=swap');
                body { background-color: #080808; color: #f3f4f6; font-family: 'Tajawal', sans-serif; }
                .neon-border { border: 1px solid rgba(191, 0, 255, 0.3); box-shadow: 0 0 10px rgba(191, 0, 255, 0.1); }
                .neon-text { color: #bf00ff; text-shadow: 0 0 10px rgba(191, 0, 255, 0.5); }
                .sidebar { background: #0c0c0c; border-left: 1px solid #1f2937; }
                .card { background: #111111; border: 1px solid #1f2937; transition: all 0.3s; }
                .card:hover { border-color: #bf00ff; transform: translateY(-2px); }
                .btn-primary { background: #bf00ff; transition: all 0.2s; }
                .btn-primary:hover { background: #9d00d1; transform: scale(1.02); }
                .log-container { background: #000; font-family: 'Courier New', monospace; font-size: 12px; }
            </style>
        </head>
        <body class="flex h-screen overflow-hidden">
            <!-- Sidebar -->
            <aside class="w-64 sidebar p-6 flex flex-col hidden md:flex">
                <div class="mb-10 text-center">
                    <h1 class="text-3xl font-bold neon-text">OKAMI 🐺</h1>
                    <p class="text-[10px] text-gray-500 tracking-widest mt-1 uppercase">Advanced Control System</p>
                </div>
                <nav class="flex-1 space-y-2">
                    <button onclick="showSection('stats')" class="w-full flex items-center p-3 text-gray-400 hover:text-white hover:bg-zinc-900 rounded-xl transition"><i class="fas fa-chart-pie ml-3"></i> الإحصائيات</button>
                    <button onclick="showSection('manga')" class="w-full flex items-center p-3 text-gray-400 hover:text-white hover:bg-zinc-900 rounded-xl transition"><i class="fas fa-book ml-3"></i> إدارة المانهوا</button>
                    <button onclick="showSection('logs')" class="w-full flex items-center p-3 text-gray-400 hover:text-white hover:bg-zinc-900 rounded-xl transition"><i class="fas fa-terminal ml-3"></i> السجلات الحية</button>
                    <button onclick="showSection('settings')" class="w-full flex items-center p-3 text-gray-400 hover:text-white hover:bg-zinc-900 rounded-xl transition"><i class="fas fa-cog ml-3"></i> الإعدادات</button>
                </nav>
                <div class="mt-auto pt-6 border-t border-zinc-800">
                    <div class="flex items-center space-x-3 space-x-reverse">
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span class="text-xs text-gray-400">السيرفر يعمل بكفاءة</span>
                    </div>
                </div>
            </aside>

            <!-- Main Content -->
            <main class="flex-1 flex flex-col overflow-hidden bg-[#080808]">
                <header class="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/20 backdrop-blur-md">
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <h2 id="sectionTitle" class="text-lg font-bold">لوحة القيادة</h2>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <input id="quickSearch" type="text" placeholder="بحث سريع..." class="bg-zinc-900 border border-zinc-800 rounded-full py-1.5 px-4 pr-10 text-xs focus:outline-none focus:border-purple-600 transition w-64">
                            <i class="fas fa-search absolute right-3 top-2 text-gray-600"></i>
                        </div>
                    </div>
                </header>

                <div class="flex-1 overflow-y-auto p-8" id="mainContent">
                    <!-- Stats Section -->
                    <section id="stats-section">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                            <div class="card p-6 rounded-2xl">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="p-3 bg-purple-900/20 rounded-xl text-purple-500"><i class="fas fa-users"></i></div>
                                    <span class="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">+12%</span>
                                </div>
                                <p class="text-gray-500 text-xs">إجمالي المستخدمين</p>
                                <h3 class="text-2xl font-bold mt-1">${userCount}</h3>
                            </div>
                            <div class="card p-6 rounded-2xl">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="p-3 bg-blue-900/20 rounded-xl text-blue-500"><i class="fas fa-book-open"></i></div>
                                </div>
                                <p class="text-gray-500 text-xs">المانهوا المسجلة</p>
                                <h3 class="text-2xl font-bold mt-1">${mangaCount}</h3>
                            </div>
                            <div class="card p-6 rounded-2xl border-purple-900/50">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="p-3 bg-orange-900/20 rounded-xl text-orange-500"><i class="fas fa-tasks"></i></div>
                                </div>
                                <p class="text-gray-500 text-xs">مهام قيد النشر</p>
                                <h3 class="text-2xl font-bold mt-1">${activeTasks}</h3>
                            </div>
                            <div class="card p-6 rounded-2xl">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="p-3 bg-green-900/20 rounded-xl text-green-500"><i class="fas fa-microchip"></i></div>
                                </div>
                                <p class="text-gray-500 text-xs">استهلاك الذاكرة</p>
                                <h3 class="text-2xl font-bold mt-1">${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</h3>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div class="card p-6 rounded-2xl">
                                <h4 class="font-bold mb-6 flex items-center"><i class="fas fa-history ml-2 text-purple-500"></i> آخر الأعمال المضافة</h4>
                                <div class="space-y-4">
                                    ${mangas.map(m => `
                                        <div class="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                                            <div class="flex items-center">
                                                <img src="${m.cover_url}" class="w-10 h-14 rounded-md object-cover ml-3 border border-zinc-700">
                                                <div>
                                                    <p class="text-sm font-bold">${m.title}</p>
                                                    <p class="text-[10px] text-gray-500">${m.source_site_key} • ${m.status}</p>
                                                </div>
                                            </div>
                                            <button class="text-xs text-purple-400 hover:underline">إدارة</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="card p-6 rounded-2xl">
                                <h4 class="font-bold mb-6 flex items-center"><i class="fas fa-bolt ml-2 text-yellow-500"></i> إجراءات سريعة</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <button onclick="executeAction('cleanup')" class="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-center border border-zinc-800 transition">
                                        <i class="fas fa-broom text-xl mb-2 text-gray-400"></i>
                                        <p class="text-xs">تنظيف الذاكرة</p>
                                    </button>
                                    <button onclick="executeAction('restart-queue')" class="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-center border border-zinc-800 transition">
                                        <i class="fas fa-sync text-xl mb-2 text-gray-400"></i>
                                        <p class="text-xs">إعادة تشغيل الطابور</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Logs Section -->
                    <section id="logs-section" class="hidden h-full flex flex-col">
                        <div class="flex-1 log-container p-4 rounded-xl overflow-y-auto border border-zinc-800 text-green-400" id="logOutput">
                            [System] Initializing Live Log Stream...<br>
                            [System] Monitoring Webhook Traffic...<br>
                        </div>
                    </section>
                </div>
            </main>

            <script>
                function showSection(id) {
                    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
                    document.getElementById(id + '-section').classList.remove('hidden');
                    document.getElementById('sectionTitle').innerText = 
                        id === 'stats' ? 'لوحة القيادة' : 
                        id === 'manga' ? 'إدارة المانهوا' : 
                        id === 'logs' ? 'السجلات الحية' : 'الإعدادات';
                }

                async function executeAction(action) {
                    const res = await fetch('/api/admin/action', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action })
                    });
                    const data = await res.json();
                    alert(data.message);
                }

                // Simple log polling (mockup for now)
                setInterval(async () => {
                    if (!document.getElementById('logs-section').classList.contains('hidden')) {
                        // In a real scenario, fetch logs from server
                        const logEl = document.getElementById('logOutput');
                        // logEl.innerHTML += "[Log] " + new Date().toLocaleTimeString() + " - Webhook Heartbeat OK<br>";
                    }
                }, 3000);
            </script>
        </body>
        </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send("Error loading dashboard: " + error.message);
    }
});

// --- Admin API ---
app.post('/api/admin/action', async (req, res) => {
    const { action } = req.body;
    try {
        switch(action) {
            case 'cleanup':
                // Implement cleanup logic
                res.json({ message: 'تم بدء عملية تنظيف الملفات المؤقتة بنجاح.' });
                break;
            case 'restart-queue':
                await QueueSystem.resumeQueue();
                res.json({ message: 'تمت إعادة تشغيل طابور النشر.' });
                break;
            default:
                res.status(400).json({ message: 'إجراء غير معروف.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'خطأ: ' + error.message });
    }
});

// --- Webhook (GET) ---
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            logger.info('Webhook Verified Successfully');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else res.sendStatus(400);
});

// --- Webhook (POST) ---
app.post('/webhook', (req, res) => {
    const body = req.body;
    logger.info(`[Webhook] Incoming Event: ${body.object}`);

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED');
        (async () => {
            for (const entry of body.entry) {
                try {
                    if (!entry.messaging) continue;
                    const webhook_event = entry.messaging[0];
                    const sender_id = webhook_event.sender.id;

                    if (webhook_event.message?.text) {
                        const incomingText = webhook_event.message.text;
                        logger.info(`[Webhook] Message from ${sender_id}: ${incomingText}`);
                        
                        const responseText = await DialogueService.handleMessage(sender_id, incomingText);
                        if (responseText) {
                            await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                        }
                    }
                } catch (error) {
                    logger.error(`[Webhook Error]: ${error.message}`);
                }
            }
        })();
    } else res.sendStatus(404);
});

// --- Server Boot ---
const startServer = (port) => {
    app.listen(port, async () => {
        logger.info(`Okami Pro Dashboard running on port ${port}`);
        try {
            await QueueSystem.resumeQueue();
        } catch (e) {
            logger.error(`Queue Resume Error: ${e.message}`);
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            setTimeout(() => startServer(0), 1000);
        }
    });
};

startServer(config.port);
