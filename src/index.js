import express from 'express';
import { config } from './config/config.js';
import { DialogueService } from './services/dialogue.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import { QueueSystem } from './modules/queue.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.send('🐺 Okami Bot Server is running perfectly on Render!');
});

// Health check route
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: '🐺 Okami Bot (Render Optimized)', 
        version: '5.0.0' 
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
        // Acknowledge receipt instantly to prevent Facebook timeout (HTTP 200)
        res.status(200).send('EVENT_RECEIVED');

        // Process events asynchronously
        body.entry.forEach(entry => {
            if (entry.messaging) {
                entry.messaging.forEach(event => {
                    if (event.message && event.message.text) {
                        // Use setImmediate to ensure non-blocking execution
                        setImmediate(async () => {
                            try {
                                const sender_id = event.sender.id;
                                const text = event.message.text;
                                
                                logger.info(`Processing message from ${sender_id}: ${text}`);
                                
                                const responseText = await DialogueService.handleMessage(sender_id, text);
                                if (responseText) {
                                    await FacebookPublisher.sendDirectMessage(sender_id, responseText);
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

const PORT = config.port;
app.listen(PORT, async () => {
    logger.info(`Okami Bot API running on port ${PORT}`);
    
    // Resume saved queue if exists
    try {
        if (QueueSystem && typeof QueueSystem.resumeQueue === 'function') {
            await QueueSystem.resumeQueue();
            logger.info('Persistent queue resumed.');
        }
    } catch (e) {
        logger.error(`Failed to resume queue: ${e.message}`);
    }
});
