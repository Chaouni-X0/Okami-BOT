import axios from 'axios';
import db from '../database/db.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class NotificationService {
    static async followManga(userFbId, mangaId) {
        const stmt = db.prepare('INSERT OR IGNORE INTO followers (user_fb_id, manga_id) VALUES (?, ?)');
        return stmt.run(userFbId, mangaId);
    }

    static async unfollowManga(userFbId, mangaId) {
        const stmt = db.prepare('DELETE FROM followers WHERE user_fb_id = ? AND manga_id = ?');
        return stmt.run(userFbId, mangaId);
    }

    static async notifyFollowers(mangaId, chapterNumber, postUrl) {
        const followers = db.prepare('SELECT user_fb_id FROM followers WHERE manga_id = ?').all(mangaId);
        const manga = db.prepare('SELECT title FROM manga WHERE id = ?').get(mangaId);

        for (const follower of followers) {
            const message = `🌟 خبر سار! تم نشر الفصل ${chapterNumber} من مانهوا "${manga.title}" التي تتابعها. \n🔗 يمكنك القراءة هنا: ${postUrl}`;
            
            db.prepare('INSERT INTO notifications (user_fb_id, message) VALUES (?, ?)').run(follower.user_fb_id, message);
        }
        
        this.processNotificationQueue();
    }

    static async processNotificationQueue() {
        const pending = db.prepare('SELECT * FROM notifications WHERE is_sent = 0 LIMIT 10').all();
        
        for (const note of pending) {
            try {
                // ملاحظة: إرسال الرسائل يتطلب Messenger API و User PSID
                // هنا نقوم بمحاكاة الإرسال أو استخدام التعليقات كبديل
                await this.sendFacebookMessage(note.user_fb_id, note.message);
                db.prepare('UPDATE notifications SET is_sent = 1 WHERE id = ?').run(note.id);
                logger.info(`Notification sent to ${note.user_fb_id}`);
            } catch (error) {
                logger.error(`Failed to send notification: ${error.message}`);
            }
        }
    }

    static async sendFacebookMessage(recipientId, text) {
        // استخدام Send API الخاص بفيسبوك
        try {
            await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.facebook.accessToken}`, {
                recipient: { id: recipientId },
                message: { text: text }
            });
        } catch (error) {
            // إذا فشل الإرسال كرسالة (بسبب سياسات فيسبوك)، يمكن تسجيل ذلك
            throw new Error(`FB Send API Error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    static async broadcast(message) {
        const users = db.prepare('SELECT fb_id FROM users').all();
        let successCount = 0;
        
        for (const user of users) {
            try {
                await this.sendFacebookMessage(user.fb_id, message);
                successCount++;
            } catch (error) {
                logger.error(`Broadcast failed for ${user.fb_id}: ${error.message}`);
            }
        }
        return successCount;
    }
}
