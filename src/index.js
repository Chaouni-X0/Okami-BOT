import express from 'express';
import { initDb } from './database/db.js';
import { AdminService } from './services/admin.service.js';
import logger from './utils/logger.js';
import { config } from './config/config.js';
import db from './database/db.js';
import chatService from './services/chat.service.js';
import { FacebookPublisher } from './modules/publisher.js';
import scraperEngine from './modules/scraper.js';
import { QueueSystem } from './modules/queue.js';
import { UserService } from './services/user.service.js';
import { NotificationService } from './services/notification.service.js';

const app = express();
app.use(express.json());

const adminService = new AdminService();

// تهيئة قاعدة البيانات
initDb();
logger.info('Database initialized.');

// تشغيل نظام التحديث التلقائي
adminService.initAutoUpdate();
logger.info('Auto-update system started.');

// --- نظام المحادثة التفاعلي (Interactive Chat Webhook) ---

app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === 'okami_bot_verify_token') {
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
            const webhookEvent = entry.messaging[0];
            if (webhookEvent.message && webhookEvent.message.text) {
                const response = await chatService.handleMessage(webhookEvent.sender.id, webhookEvent.message.text);
                
                // إرسال الرد للمستخدم عبر فيسبوك
                const publisher = new FacebookPublisher();
                await publisher.sendDirectMessage(webhookEvent.sender.id, response);
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// --- أوامر المطور (Developer Commands) ---

app.post('/admin/dev-command', async (req, res) => {
    const { activationKey, command, params } = req.body;
    if (activationKey !== config.admin.activationKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        let result;
        switch (command) {
            case 'START_EVENT':
                // import { EventService } from './services/event.service.js';
                // await EventService.startEvent(params.name, params.type, params.hours);
                result = { success: true, message: `Event ${params.name} started.` };
                break;

            case 'PUBLISH_LEADERBOARD':
                // import { ContentEngine } from './services/content.service.js';
                // const content = new ContentEngine();
                // await content.publishWeeklyLeaderboard();
                result = { success: true, message: 'Leaderboard published.' };
                break;

            case 'CREATE_GUILD':
                db.prepare('INSERT INTO guilds (name) VALUES (?)').run(params.name);
                result = { success: true, message: `Guild ${params.name} created.` };
                break;

            case 'REWARD_GUILD':
                const members = db.prepare('SELECT fb_id FROM users WHERE guild_id = ?').all(params.guildId);
                for (const member of members) {
                    db.prepare('UPDATE users SET points = points + ? WHERE fb_id = ?').run(params.amount, member.fb_id);
                }
                result = { success: true, message: `Rewarded ${members.length} members.` };
                break;

            case 'BAN_USER':
                db.prepare('DELETE FROM users WHERE fb_id = ?').run(params.fbId);
                result = { success: true, message: `User ${params.fbId} banned.` };
                break;

            case 'WARN_USER':
                db.prepare(`
                    INSERT INTO user_warnings (user_fb_id, warning_count, last_warning_reason)
                    VALUES (?, 1, ?)
                    ON CONFLICT(user_fb_id) DO UPDATE SET
                        warning_count = warning_count + 1,
                        last_warning_reason = excluded.last_warning_reason,
                        updated_at = CURRENT_TIMESTAMP
                `).run(params.fbId, params.reason);
                result = { success: true, message: `User ${params.fbId} warned.` };
                break;

            case 'QUICK_ADD':
                const mangaInfo = await scraperEngine.parseManga(params.source, params.slug);
                if (mangaInfo && mangaInfo.chapters.length > 0) {
                    const lastChapter = mangaInfo.chapters[mangaInfo.chapters.length - 1];
                    await QueueSystem.addChapterToQueue(null, {
                        number: lastChapter.number,
                        chapterUrl: lastChapter.url,
                        sourceKey: params.source
                    });
                    result = { success: true, message: `Manga ${mangaInfo.title} added.` };
                } else {
                    result = { success: false, message: 'Manga not found.' };
                }
                break;

            case 'GET_STATS':
                const totalManga = db.prepare('SELECT COUNT(*) as count FROM manga').get().count;
                const totalChapters = db.prepare('SELECT COUNT(*) as count FROM chapters').get().count;
                result = { totalManga, totalChapters };
                break;

            case 'BROADCAST':
                const count = await NotificationService.broadcast(params.message);
                result = { success: true, message: `Broadcast sent to ${count} users.` };
                break;

            default:
                return res.status(400).json({ error: 'Unknown command' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- واجهات المستخدم (User APIs) ---

app.get('/user/profile/:fbId', async (req, res) => {
    const profile = await UserService.getProfile(req.params.fbId);
    if (profile) res.json(profile);
    else res.status(404).json({ error: 'User not found' });
});

app.get('/user/missions/:fbId', async (req, res) => {
    const missions = await UserService.getMissions(req.params.fbId);
    res.json(missions);
});

app.post('/user/read', async (req, res) => {
    const { fbId, mangaId, chapterNumber } = req.body;
    const result = await UserService.recordReading(fbId, mangaId, chapterNumber);
    res.json(result);
});

app.get('/status', (req, res) => {
    res.json({ status: 'online', project: '🐺 Okami Bot', version: '3.5.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Okami Bot API running on port ${PORT}`);
});
