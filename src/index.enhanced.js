
import express from 'express';
import http from 'http';
import net from 'net';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import { sendMessage } from './services/messenger.js';
import { FacebookPublisher } from './modules/publisher.js';
import logger from './utils/logger.js';
import metrics from './utils/metrics.js';
import aiDebugger from './utils/debugger.js';
import { Manga, Chapter } from './database/mongodb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 7860;
const STREAMLIT_PORT = 8501;
const VERIFY_TOKEN = (process.env.VERIFY_TOKEN || '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'OKAMI-BOT__START').trim();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/okami';

// Global Error Handlers to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('CRITICAL: Uncaught Exception', { stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection', { message: reason.toString(), stack: reason.stack });
});

// Connect to MongoDB with optimized settings
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
}).then(() => {
    logger.info('system_boot | Connected to MongoDB (Optimized)', { event: 'system_boot' });
}).catch(err => {
    logger.error('db_connection_failure | Failed to connect to MongoDB', { error_message: err.message, stack: err.stack });
});

// Monitoring Endpoints
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'utils', 'dashboard.html')));
app.get('/api/logs', (req, res) => res.json(logger.getLogs()));
app.get('/api/metrics', (req, res) => res.json(metrics.getMetrics()));
app.get('/api/debugger', (req, res) => res.json(aiDebugger.getInfo()));

// ✅ Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('webhook_verified | Facebook Webhook Verified', { event: 'webhook_verified' });
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ✅ Webhook receive
app.post('/webhook', express.json(), (req, res) => {
  // Acknowledge receipt instantly to prevent Facebook timeout
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object !== 'page') return;

  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      if (event.message && event.message.text) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        // Process asynchronously to avoid blocking
        handleMessage(event.sender.id, event.message.text, requestId).catch(err => {
            logger.error(`handleMessage_error | user: ${event.sender.id} | ${err.message}`, { stack: err.stack });
        });
      }
    });
  });
});

// 🎯 MAIN FLOW
async function handleMessage(senderId, text, requestId) {
  const cleanText = text.trim().toLowerCase();
  
  logger.info(`message_received | user: ${senderId} | text: ${cleanText}`, { 
    event: 'message_received', 
    userId: senderId, 
    message: cleanText, 
    requestId 
  });

  // RESET FLOW SUPPORT
  if (['مرحبا', 'start', 'ابدأ', 'restart'].includes(cleanText)) {
    userStates.set(senderId, { step: 'START' });
  }

  let currentState = userStates.get(senderId) || { step: 'START' };
  let responseText = "";

  switch (currentState.step) {
    case 'START':
      responseText = '👋 أهلاً بك في أوكامي بوت!\n\nاختر الوضع:\n1. وضع المستخدم 👤\n2. وضع المطور 🛠️';
      userStates.set(senderId, { step: 'CHOOSE_MODE' });
      break;

    case 'CHOOSE_MODE':
      if (cleanText === '1' || cleanText.includes('مستخدم')) {
        responseText = '👤 أنت الآن في وضع المستخدم. قريباً ستتمكن من تصفح المانجا.';
        userStates.set(senderId, { step: 'USER_MODE' });
      } else if (cleanText === '2' || cleanText.includes('مطور')) {
        responseText = '🛠️ أدخل كلمة السر:';
        userStates.set(senderId, { step: 'AWAITING_PASSWORD' });
      } else {
        responseText = '❗ اختر 1 أو 2.';
      }
      break;

    case 'AWAITING_PASSWORD':
      if (cleanText === ADMIN_PASSWORD.toLowerCase()) {
        responseText = '✅ أهلاً مطور!\n\nالخيارات:\n👉 نشر\n👉 تجميع';
        userStates.set(senderId, { step: 'ADMIN_PANEL' });
      } else {
        responseText = '❌ كلمة سر خاطئة.';
      }
      break;

    case 'ADMIN_PANEL':
      if (cleanText === 'نشر') {
        responseText = 'أرسل اسم المانجا:';
        userStates.set(senderId, { step: 'AWAITING_MANGA_NAME' });
      } else if (cleanText === 'تجميع') {
        try {
            const mangas = await Manga.find().limit(10);
            if (mangas.length === 0) {
                responseText = '❌ لا توجد مانجا في Mongo.';
            } else {
                responseText = `اختر مانجا للتجميع:\n` + mangas.map((m, i) => `${i + 1}. ${m.title}`).join('\n');
                userStates.set(senderId, { step: 'SELECTING_MANGA_FOR_AGGREGATION', mangas });
            }
        } catch (e) {
            responseText = '❌ خطأ في Mongo.';
        }
      } else {
        responseText = '❗ اختر: نشر أو تجميع.';
      }
      break;

    case 'SELECTING_MANGA_FOR_AGGREGATION':
      const idx = parseInt(cleanText) - 1;
      const mangas = currentState.mangas;
      if (mangas && mangas[idx]) {
          const selected = mangas[idx];
          try {
              const chapters = await Chapter.find({ manga_id: selected._id, is_published: true }).sort({ chapter_number: 1 });
              if (chapters.length === 0) {
                  responseText = '❌ لا فصول منشورة.';
              } else {
                  await FacebookPublisher.publishAggregation(selected, chapters);
                  responseText = `✅ تم نشر تجميع "${selected.title}" بنجاح!`;
              }
          } catch (e) {
              responseText = '❌ خطأ في التجميع.';
          }
          userStates.set(senderId, { step: 'ADMIN_PANEL' });
      } else {
          responseText = '❌ اختيار خاطئ.';
      }
      break;

    case 'AWAITING_MANGA_NAME':
      responseText = `🔍 جاري معالجة "${text}"...`;
      userStates.set(senderId, { step: 'ADMIN_PANEL' });
      break;

    default:
      responseText = 'أرسل "مرحبا" للبدء.';
      userStates.set(senderId, { step: 'START' });
      break;
  }

  // Final delivery using the enhanced sendMessage with retries
  await sendMessage(senderId, responseText, requestId);
}

// Global user state
const userStates = new Map();

// 🌐 Streamlit proxy
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook') || req.path.startsWith('/api') || req.path.startsWith('/dashboard')) return next();
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: STREAMLIT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  req.pipe(proxyReq);
});

// 🔌 WebSocket
const server = http.createServer(app);
server.on('upgrade', (req, socket, head) => {
  const target = net.connect(STREAMLIT_PORT, '127.0.0.1', () => {
    socket.pipe(target).pipe(socket);
  });
});

// 🚀 Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`server_start | Okami Bot running on ${PORT}`, { event: 'server_start' });
});
