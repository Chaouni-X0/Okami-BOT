import db from '../database/db.js';
import { GamificationService } from './gamification.service.js';

export class ReadingService {
    static async updateProgress(userFbId, mangaId, chapterNumber) {
        // تحديث تاريخ القراءة
        db.prepare(`
            INSERT INTO reading_history (user_fb_id, manga_id, last_chapter, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_fb_id, manga_id) DO UPDATE SET
                last_chapter = excluded.last_chapter,
                updated_at = CURRENT_TIMESTAMP
        `).run(userFbId, mangaId, chapterNumber);

        // إضافة نقاط ونشاط للمستخدم
        await GamificationService.addUserActivity(userFbId, 5, 2);
        
        // تحديث الـ Streak الخاص بالقراءة
        this.updateReadingStreak(userFbId);
    }

    static async getContinueReading(userFbId) {
        return db.prepare(`
            SELECT h.*, m.title, m.cover_url 
            FROM reading_history h
            JOIN manga m ON h.manga_id = m.id
            WHERE h.user_fb_id = ?
            ORDER BY h.updated_at DESC
            LIMIT 5
        `).all(userFbId);
    }

    static async getSmartRecommendations(userFbId) {
        // توصيات بسيطة بناءً على الأعمال التي لم يقرأها المستخدم ولكنها مشهورة
        return db.prepare(`
            SELECT m.* FROM manga m
            WHERE m.id NOT IN (SELECT manga_id FROM reading_history WHERE user_fb_id = ?)
            ORDER BY (SELECT COUNT(*) FROM reading_history WHERE manga_id = m.id) DESC
            LIMIT 3
        `).all(userFbId);
    }

    static updateReadingStreak(userFbId) {
        const today = new Date().toISOString().split('T')[0];
        const streak = db.prepare('SELECT * FROM user_streaks WHERE user_fb_id = ?').get(userFbId);

        if (!streak) {
            db.prepare('INSERT INTO user_streaks (user_fb_id, current_streak, last_activity_date) VALUES (?, 1, ?)').run(userFbId, today);
        } else if (streak.last_activity_date !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (streak.last_activity_date === yesterdayStr) {
                const newStreak = streak.current_streak + 1;
                db.prepare('UPDATE user_streaks SET current_streak = ?, last_activity_date = ?, highest_streak = MAX(highest_streak, ?) WHERE user_fb_id = ?')
                    .run(newStreak, today, newStreak, userFbId);
            } else {
                // انقطع الـ Streak
                db.prepare('UPDATE user_streaks SET current_streak = 1, last_activity_date = ? WHERE user_fb_id = ?').run(today, userFbId);
            }
        }
    }
}
