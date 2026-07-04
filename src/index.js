import express from 'express';
import { config } from './config/config.js';
import { ChatService } from './services/chat.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import { AutomationService } from './services/automation.service.js';
import logger from './utils/logger.js';
import scraperManager from './scraper/scraperManager.js';

// Global Error Handling to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error(`[CRITICAL] Uncaught Exception: ${err.message}`);
    logger.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[CRITICAL] Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

const chatService = new ChatService();
const automationService = new AutomationService();

const app = express();
app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: '🐺 Okami Bot is alive!' });
});

// Production-ready Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'online', 
        project: '🐺 Okami Bot', 
        version: '6.0.0 (Node-Only)',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
    });
});

// Webhook GET for verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.facebook.verifyToken) {
        logger.info('Webhook verified successfully.');
        res.status(200).send(challenge);
    } else {
        logger.warn('Webhook verification failed. Token mismatch.');
        res.sendStatus(403);
    }
});

// Webhook POST for receiving messages
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        res.status(200).send('EVENT_RECEIVED');

        body.entry.forEach(entry => {
            if (entry.messaging) {
                entry.messaging.forEach(event => {
                    if (event.message && event.message.text) {
                        setImmediate(async () => {
                            try {
                                const sender_id = event.sender.id;
                                const text = event.message.text;
                                logger.info(`Processing message from ${sender_id}: ${text}`);
                                const responseText = await chatService.handleMessage(sender_id, text);
                                if (responseText) {
                                    if (typeof responseText === 'string') {
                                        await FacebookPublisher.sendDirectMessage(sender_id, { text: responseText });
                                    } else {
                                        await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                                    }
                                }
                            } catch (error) {
                                logger.error(`Error processing webhook event: ${error.message}`);
                            }
                        });
                    }
                });
            }
        });
    } else {
        res.sendStatus(404);
    }
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    logger.info(`Okami Bot API running on port ${PORT}`);

    if (!config.facebook.accessToken || !config.facebook.pageId) {
        logger.error('⚠️ FB_ACCESS_TOKEN and/or FB_PAGE_ID not set.');
    }

    // Async init
    setImmediate(async () => {
        try {
            await automationService.init();
            logger.info('Automation Service initialized successfully.');
        } catch (e) {
            logger.error(`Failed to init automation: ${e.message}`);
        }
    });
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    await scraperManager.closeAll();
    server.close(() => {
        logger.info('Process terminated.');
        process.exit(0);
    });
});
