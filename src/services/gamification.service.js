import db from '../database/db.js';
import logger from '../utils/logger.js';
import { EventService } from './event.service.js';

export class GamificationService {
    static getRankTitle(level) {
        if (level < 5) return 'Otaku Beginner';
        if (level < 15) return 'Shadow Reader';
        if (level < 30) return 'Manga Explorer';
        if (level < 50) return 'Okami Warrior';
        return 'Okami King 🐺';
    }

    static async addUserActivity(fbId, xpGain, pointsGain) {
        let user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(fbId);
        
        if (!user) {
            db.prepare('INSERT INTO users (fb_id, points, xp, level) VALUES (?, ?, ?, ?)').run(fbId, pointsGain, xpGain, 1);
            user = { fb_id: fbId, points: pointsGain, xp: xpGain, level: 1 };
        } else {
            // التحقق من الفعاليات النشطة (مثل مضاعفة النقاط)
            const activeEvent = EventService.getActiveEvent();
            let finalPoints = pointsGain;
            if (activeEvent && activeEvent.type === 'DOUBLE_POINTS') {
                finalPoints *= 2;
            }

            const newXp = user.xp + xpGain;
            const newPoints = user.points + finalPoints;
            let newLevel = user.level;

            // نظام ترقية المستوى (Level Up)
            const xpNeeded = newLevel * 100;
            if (newXp >= xpNeeded) {
                newLevel++;
                const newTitle = this.getRankTitle(newLevel);
                db.prepare('UPDATE users SET level = ?, rank_title = ? WHERE fb_id = ?').run(newLevel, newTitle, fbId);
                logger.info(`User ${fbId} leveled up to ${newLevel}!`);
            }

            db.prepare('UPDATE users SET xp = ?, points = ? WHERE fb_id = ?').run(newXp, newPoints, fbId);

            // إضافة النقاط للقبيلة إذا كان المستخدم ينتمي لواحدة
            if (user.guild_id) {
                db.prepare('UPDATE guilds SET total_points = total_points + ? WHERE id = ?').run(finalPoints, user.guild_id);
            }
        }
    }

    static async dailyCheckIn(fbId) {
        const user = db.prepare('SELECT last_login, streak FROM users WHERE fb_id = ?').get(fbId);
        const now = new Date();
        
        if (user && user.last_login) {
            const lastLogin = new Date(user.last_login);
            const diffDays = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                const newStreak = user.streak + 1;
                const bonus = 10 * newStreak;
                await this.addUserActivity(fbId, 20, bonus);
                db.prepare('UPDATE users SET streak = ?, last_login = ? WHERE fb_id = ?').run(newStreak, now.toISOString(), fbId);
                return { success: true, streak: newStreak, bonus };
            } else if (diffDays > 1) {
                db.prepare('UPDATE users SET streak = 1, last_login = ? WHERE fb_id = ?').run(now.toISOString(), fbId);
                return { success: true, streak: 1, bonus: 10 };
            }
        } else {
            db.prepare('INSERT OR REPLACE INTO users (fb_id, streak, last_login) VALUES (?, 1, ?)').run(fbId, now.toISOString());
            return { success: true, streak: 1, bonus: 10 };
        }
        return { success: false, message: 'Already checked in today.' };
    }
}
