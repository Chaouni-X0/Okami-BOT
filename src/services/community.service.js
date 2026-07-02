import db from '../database/db.js';
import { GamificationService } from './gamification.service.js';

export class CommunityService {
    static async createRequest(userFbId, mangaTitle) {
        const stmt = db.prepare('INSERT INTO requests (user_fb_id, manga_title) VALUES (?, ?)');
        const result = stmt.run(userFbId, mangaTitle);
        await GamificationService.addUserActivity(userFbId, 10, 5); // مكافأة على الطلب
        return result.lastInsertRowid;
    }

    static async voteForRequest(userFbId, requestId) {
        try {
            db.prepare('INSERT INTO votes (user_fb_id, request_id) VALUES (?, ?)').run(userFbId, requestId);
            db.prepare('UPDATE requests SET votes = votes + 1 WHERE id = ?').run(requestId);
            
            const request = db.prepare('SELECT votes, manga_title FROM requests WHERE id = ?').get(requestId);
            
            // إذا وصل التصويت لـ 100، يتم تنبيه المطور (أو النشر التلقائي إذا كان مدعوماً)
            if (request.votes >= 100) {
                // منطق التنبيه هنا
            }
            
            await GamificationService.addUserActivity(userFbId, 5, 2); // مكافأة على التصويت
            return { success: true, currentVotes: request.votes };
        } catch (error) {
            return { success: false, message: 'Already voted for this request.' };
        }
    }

    static getTopRequests() {
        return db.prepare('SELECT * FROM requests WHERE status = "pending" ORDER BY votes DESC LIMIT 10').all();
    }
}
