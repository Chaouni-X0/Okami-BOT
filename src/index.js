import express from 'express';
import { config } from './config/config.js';
import db from './database/db.js';
import { DialogueService } from './services/dialogue.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.json());

// Webhook لفيسبوك (نقطة دخول الأحداث)
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

app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            const webhook_event = entry.messaging[0];
            const sender_id = webhook_event.sender.id;

            if (webhook_event.message && webhook_event.message.text) {
                // معالجة الرسائل الواردة عبر نظام الحوار (Event-Driven)
                const responseText = await DialogueService.handleMessage(sender_id, webhook_event.message.text);
                if (responseText) {
                    await FacebookPublisher.sendDirectMessage(sender_id, responseText);
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// إلغاء نظام cron jobs المستمر واستبداله بنقاط دخول (Endpoints) للتحكم اليدوي أو عبر Webhooks
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online', 
        project: '🐺 Okami Bot (Event-Driven)', 
        version: '4.0.0' 
    });
});

const PORT = config.port || 3000;
app.listen(PORT, () => {
    logger.info(`Okami Bot API running on port ${PORT} in Event-Driven mode`);
});
