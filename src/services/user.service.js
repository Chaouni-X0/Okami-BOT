import db from '../database/db.js';
import logger from '../utils/logger.js';

export class UserService {
    static async getProfile(fbId) {
        try {
            let user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(fbId);
            if (!user) {
                // إنشاء مستخدم جديد إذا لم يكن موجوداً
                db.prepare('INSERT INTO users (fb_id) VALUES (?)').run(fbId);
                user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(fbId);
            }
            
            const streak = db.prepare('SELECT * FROM user_streaks WHERE user_fb_id = ?').get(fbId);
            const guild = user.guild_id ? db.prepare('SELECT name FROM guilds WHERE id = ?').get(user.guild_id) : null;

            return {
                ...user,
                streak: streak ? streak.current_streak : 0,
                guild_name: guild ? guild.name : 'بدون قبيلة'
            };
        } catch (error) {
            logger.error(`Error getting profile for ${fbId}: ${error.message}`);
            return null;
        }
    }

    static async recordReading(fbId, mangaId, chapterNumber) {
        try {
            // 1. تحديث تاريخ القراءة
            db.prepare(`
                INSERT INTO reading_history (user_fb_id, manga_id, last_chapter)
                VALUES (?, ?, ?)
                ON CONFLICT(user_fb_id, manga_id) DO UPDATE SET
                    last_chapter = MAX(last_chapter, excluded.last_chapter),
                    updated_at = CURRENT_TIMESTAMP
            `).run(fbId, mangaId, chapterNumber);

            // 2. منح نقاط و XP
            const pointsMultiplier = parseInt(db.prepare('SELECT value FROM settings WHERE key = "points_multiplier"').get().value) || 1;
            const pointsToAdd = 10 * pointsMultiplier;
            const xpToAdd = 20 * pointsMultiplier;

            db.prepare(`
                UPDATE users 
                SET points = points + ?, xp = xp + ?
                WHERE fb_id = ?
            `).run(pointsToAdd, xpToAdd, fbId);

            // 3. التحقق من رفع المستوى (Level Up)
            const user = db.prepare('SELECT xp, level FROM users WHERE fb_id = ?').get(fbId);
            const nextLevelXp = user.level * 100;
            if (user.xp >= nextLevelXp) {
                db.prepare('UPDATE users SET level = level + 1, xp = xp - ? WHERE fb_id = ?').run(nextLevelXp, fbId);
            }

            // 4. تحديث الـ Streak
            this.updateStreak(fbId);

            return { success: true, pointsAdded: pointsToAdd, xpAdded: xpToAdd };
        } catch (error) {
            logger.error(`Error recording reading for ${fbId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    static async updateStreak(fbId) {
        const today = new Date().toISOString().split('T')[0];
        let streak = db.prepare('SELECT * FROM user_streaks WHERE user_fb_id = ?').get(fbId);

        if (!streak) {
            db.prepare('INSERT INTO user_streaks (user_fb_id, current_streak, highest_streak, last_activity_date) VALUES (?, 1, 1, ?)').run(fbId, today);
        } else if (streak.last_activity_date !== today) {
            const lastDate = new Date(streak.last_activity_date);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (streak.last_activity_date === yesterdayStr) {
                const newStreak = streak.current_streak + 1;
                db.prepare('UPDATE user_streaks SET current_streak = ?, highest_streak = MAX(highest_streak, ?), last_activity_date = ? WHERE user_fb_id = ?')
                    .run(newStreak, newStreak, today, fbId);
            } else {
                db.prepare('UPDATE user_streaks SET current_streak = 1, last_activity_date = ? WHERE user_fb_id = ?').run(today, fbId);
            }
        }
    }

    static async getMissions(fbId) {
        // جلب المهام اليومية (تبسيط: مهام ثابتة حالياً)
        const missions = db.prepare('SELECT * FROM missions').all();
        const userMissions = db.prepare('SELECT * FROM user_missions WHERE user_fb_id = ?').all(fbId);
        
        return missions.map(m => {
            const progress = userMissions.find(um => um.mission_id === m.id);
            return {
                ...m,
                status: progress ? progress.status : 'not_started',
                progress: progress ? progress.progress : 0
            };
        });
    }
}
