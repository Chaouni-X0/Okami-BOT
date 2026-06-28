import express from 'express';
import { initDb } from './database/db.js';
import { AdminService } from './services/admin.service.js';
import logger from './utils/logger.js';
import { config } from './config/config.js';

const app = express();
app.use(express.json());

const adminService = new AdminService();

// تهيئة قاعدة البيانات
initDb();
logger.info('Database initialized.');

// تشغيل نظام التحديث التلقائي
adminService.initAutoUpdate();
logger.info('Auto-update system started.');

// API لإضافة مشروع جديد (Admin Mode)
app.post('/admin/add-manga', async (req, res) => {
    const { activationKey, url } = req.body;
    if (activationKey !== config.admin.activationKey) return res.status(403).json({ error: 'Unauthorized' });
    
    try {
        const result = await adminService.startNewProject(activationKey, url);
        res.json(result);
    } catch (error) {
        logger.error(`Admin action failed: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// أوامر المطور (Developer Commands)
app.post('/admin/dev-command', async (req, res) => {
    const { activationKey, command, params } = req.body;
    if (activationKey !== config.admin.activationKey) return res.status(403).json({ error: 'Unauthorized' });

    try {
        let result;
        switch (command) {
            case 'START_EVENT':
                import { EventService } from './services/event.service.js';
                await EventService.startEvent(params.name, params.type, params.hours);
                result = { success: true, message: `Event ${params.name} started.` };
                break;

            case 'PUBLISH_LEADERBOARD':
                import { ContentEngine } from './services/content.service.js';
                const content = new ContentEngine();
                await content.publishWeeklyLeaderboard();
                result = { success: true, message: 'Leaderboard published.' };
                break;

            case 'CREATE_GUILD':
                db.prepare('INSERT INTO guilds (name) VALUES (?)').run(params.name);
                result = { success: true, message: `Guild ${params.name} created.` };
                break;

            case 'REWARD_GUILD':
                // توزيع مكافآت لجميع أعضاء قبيلة معينة
                const members = db.prepare('SELECT fb_id FROM users WHERE guild_id = ?').all(params.guildId);
                for (const member of members) {
                    db.prepare('UPDATE users SET points = points + ? WHERE fb_id = ?').run(params.amount, member.fb_id);
                }
                result = { success: true, message: `Rewarded ${members.length} members of guild ${params.guildId}.` };
                break;

            case 'SET_GUILD_LEVEL':
                // تعديل مستوى أو نقاط قبيلة يدوياً
                db.prepare('UPDATE guilds SET total_points = ? WHERE id = ?').run(params.points, params.guildId);
                result = { success: true, message: `Guild ${params.guildId} updated.` };
                break;

            case 'BAN_USER':
                // حظر مستخدم من النظام
                db.prepare('DELETE FROM users WHERE fb_id = ?').run(params.fbId);
                // يمكن إضافة جدول خاص بالمحظورين لاحقاً
                result = { success: true, message: `User ${params.fbId} banned and data cleared.` };
                break;

            case 'WARN_USER':
                // إضافة تحذير لمستخدم
                db.prepare(`
                    INSERT INTO user_warnings (user_fb_id, warning_count, last_warning_reason)
                    VALUES (?, 1, ?)
                    ON CONFLICT(user_fb_id) DO UPDATE SET
                        warning_count = warning_count + 1,
                        last_warning_reason = excluded.last_warning_reason,
                        updated_at = CURRENT_TIMESTAMP
                `).run(params.fbId, params.reason);
                
                const warnData = db.prepare('SELECT warning_count FROM user_warnings WHERE user_fb_id = ?').get(params.fbId);
                if (warnData.warning_count >= 3) {
                    // حظر تلقائي بعد 3 تحذيرات
                    db.prepare('DELETE FROM users WHERE fb_id = ?').run(params.fbId);
                    result = { success: true, message: `User ${params.fbId} reached 3 warnings and was BANNED.` };
                } else {
                    result = { success: true, message: `User ${params.fbId} warned (${warnData.warning_count}/3). Reason: ${params.reason}` };
                }
                break;

            case 'SCHEDULE_EVENT':
                // جدولة فعالية مستقبلية
                db.prepare('INSERT INTO events (name, type, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 0)')
                    .run(params.name, params.type, params.startDate, params.endDate);
                result = { success: true, message: `Event ${params.name} scheduled.` };
                break;

            case 'CANCEL_EVENT':
                // إلغاء فعالية نشطة
                db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(params.eventId);
                result = { success: true, message: `Event ${params.eventId} cancelled.` };
                break;

            case 'ADJUST_POINTS_MULTIPLIER':
                // تغيير مضاعف النقاط للفعالية الحالية
                db.prepare('UPDATE settings SET value = ? WHERE key = "points_multiplier"').run(params.multiplier);
                result = { success: true, message: `Points multiplier set to x${params.multiplier}.` };
                break;
            case 'DELETE_MANGA':
                // حذف عمل بالكامل مع فصوله
                db.prepare('DELETE FROM manga WHERE id = ?').run(params.mangaId);
                result = { success: true, message: `Manga ${params.mangaId} deleted.` };
                break;
            
            case 'GET_STATS':
                // إحصائيات عامة
                const totalManga = db.prepare('SELECT COUNT(*) as count FROM manga').get().count;
                const totalChapters = db.prepare('SELECT COUNT(*) as count FROM chapters').get().count;
                const totalFollowers = db.prepare('SELECT COUNT(*) as count FROM followers').get().count;
                result = { totalManga, totalChapters, totalFollowers };
                break;

            case 'CLEAR_LOGS':
                // مسح السجلات
                import fs from 'fs';
                fs.writeFileSync('./src/logs/combined.log', '');
                fs.writeFileSync('./src/logs/error.log', '');
                result = { success: true, message: 'Logs cleared.' };
                break;

            case 'BROADCAST':
                // إرسال رسالة لجميع المتابعين (إعلان)
                const allFollowers = db.prepare('SELECT DISTINCT user_fb_id FROM followers').all();
                for (const f of allFollowers) {
                    db.prepare('INSERT INTO notifications (user_fb_id, message) VALUES (?, ?)').run(f.user_fb_id, params.message);
                }
                result = { success: true, count: allFollowers.length };
                break;

            case 'GIVE_POINTS':
                // توزيع نقاط لمستخدم معين أو للجميع
                if (params.fbId === 'ALL') {
                    db.prepare('UPDATE users SET points = points + ?').run(params.amount);
                } else {
                    db.prepare('UPDATE users SET points = points + ? WHERE fb_id = ?').run(params.amount, params.fbId);
                }
                result = { success: true, message: `Points distributed: ${params.amount}` };
                break;

            case 'RESET_USER':
                // تصفير بيانات مستخدم
                db.prepare('DELETE FROM users WHERE fb_id = ?').run(params.fbId);
                result = { success: true, message: `User ${params.fbId} reset.` };
                break;

            case 'ADD_MISSION':
                // إضافة مهمة جديدة للنظام
                db.prepare('INSERT INTO missions (title, reward_points, type) VALUES (?, ?, ?)').run(params.title, params.reward, params.type);
                result = { success: true, message: 'Mission added.' };
                break;

            default:
                return res.status(400).json({ error: 'Unknown command' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ميزة المتابعة للمستخدمين
app.post('/user/follow', async (req, res) => {
    const { userFbId, mangaId } = req.body;
    try {
        import { NotificationService } from './services/notification.service.js';
        await NotificationService.followManga(userFbId, mangaId);
        // إضافة نقاط للمستخدم عند المتابعة
        import { GamificationService } from './services/gamification.service.js';
        await GamificationService.addUserActivity(userFbId, 15, 10);
        res.json({ success: true, message: 'Followed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// نظام النقاط والرتب
app.get('/user/profile/:fbId', async (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(req.params.fbId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // توليد صورة الملف الشخصي ديناميكياً
        import { VisualEngine } from './modules/visual.js';
        const visual = new VisualEngine();
        const imagePath = await visual.generateUserProfileCard(user);
        
        res.json({ ...user, profile_card: imagePath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// نظام تاريخ القراءة "أكمل القراءة"
app.post('/user/read', async (req, res) => {
    const { fbId, mangaId, chapter } = req.body;
    try {
        import { ReadingService } from './services/reading.service.js';
        import { MissionService } from './services/mission.service.js';
        
        await ReadingService.updateProgress(fbId, mangaId, chapter);
        await MissionService.updateMissionProgress(fbId, 'READ');
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/user/continue/:fbId', async (req, res) => {
    try {
        import { ReadingService } from './services/reading.service.js';
        const history = await ReadingService.getContinueReading(req.params.fbId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// نظام المهام اليومية
app.get('/user/missions/:fbId', async (req, res) => {
    try {
        import { MissionService } from './services/mission.service.js';
        import { VisualEngine } from './modules/visual.js';
        
        const missions = await MissionService.generateDailyMissions(req.params.fbId);
        const visual = new VisualEngine();
        const cardPath = await visual.generateDailyMissionCard(missions);
        
        res.json({ missions, card: cardPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/user/daily-checkin', async (req, res) => {
    const { fbId } = req.body;
    try {
        import { GamificationService } from './services/gamification.service.js';
        const result = await GamificationService.dailyCheckIn(fbId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// نظام الطلبات والتصويت
app.post('/user/request', async (req, res) => {
    const { fbId, title } = req.body;
    try {
        import { CommunityService } from './services/community.service.js';
        const requestId = await CommunityService.createRequest(fbId, title);
        res.json({ success: true, requestId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/user/vote', async (req, res) => {
    const { fbId, requestId } = req.body;
    try {
        import { CommunityService } from './services/community.service.js';
        const result = await CommunityService.voteForRequest(fbId, requestId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// واجهة مراقبة بسيطة
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        project: '🐺 Okami Bot',
        version: '1.0.0'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Okami Bot API running on port ${PORT}`);
});
