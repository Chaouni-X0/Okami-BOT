import express from 'express';
import { ChatService } from '../services/chat.service.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

const router = express.Router();
const chatService = new ChatService();

// 🎯 Verification Route (GET)
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.facebook.verifyToken) {
            logger.info('✅ Webhook Verified Successfully');
            res.status(200).send(challenge);
        } else {
            logger.warn('❌ Webhook Verification Failed: Invalid Token');
            res.sendStatus(403);
        }
    }
});

// 📩 Message Handling Route (POST)
router.post('/', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async (entry) => {
            const webhookEvent = entry.messaging[0];
            const senderPsid = webhookEvent.sender.id;

            if (webhookEvent.message && webhookEvent.message.text) {
                logger.info(`📩 Received message from ${senderPsid}: ${webhookEvent.message.text}`);
                try {
                    await chatService.handleMessage(senderPsid, webhookEvent.message.text);
                } catch (error) {
                    logger.error(`❌ ChatService Error: ${error.message}`);
                }
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

export default router;
