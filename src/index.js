import express from 'express';
import { config } from './config/config.js';
import db from './database/db.js';
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
    // Keep the process alive for Hugging Face container stability
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the process alive
});

const app = express();
app.use(express.json());

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

// --- Optimized Facebook Webhook Handling (Asynchronous) ---
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        // 1. Respond immediately to Facebook within 1 second
        res.status(200).send('EVENT_RECEIVED');

        // 2. Process heavy operations in the background
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

app.get('/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: '🐺 Okami Bot (Hugging Face Optimized)', 
        version: '5.0.0' 
    });
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
}, 60 * 60 * 1000); // Run hourly check

// --- Resilient Server Entry-Point Binding ---
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
                startServer(0); // Bind to random available port
            }, 1000);
        } else {
            logger.error(`Server Error: ${err.message}`);
        }
    });
};

const PORT = process.env.PORT || 7860;
startServer(PORT);
