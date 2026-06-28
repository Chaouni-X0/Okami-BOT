import db from '../database/db.js';
import { GamificationService } from './gamification.service.js';

export class MissionService {
    static async generateDailyMissions(userFbId) {
        // التحقق مما إذا كان لدى المستخدم مهام اليوم
        const existing = db.prepare('SELECT * FROM user_missions WHERE user_fb_id = ? AND status = "ongoing"').all(userFbId);
        if (existing.length > 0) return existing;

        // اختيار مهام عشوائية من النظام
        const missions = db.prepare('SELECT * FROM missions ORDER BY RANDOM() LIMIT 3').all();
        for (const mission of missions) {
            db.prepare('INSERT INTO user_missions (user_fb_id, mission_id) VALUES (?, ?)').run(userFbId, mission.id);
        }
        return missions;
    }

    static async updateMissionProgress(userFbId, type) {
        // تحديث التقدم في مهام معينة (مثلاً: قراءة فصل، تصويت، إلخ)
        const ongoing = db.prepare(`
            SELECT um.*, m.reward_points 
            FROM user_missions um
            JOIN missions m ON um.mission_id = m.id
            WHERE um.user_fb_id = ? AND um.status = "ongoing" AND m.type = ?
        `).all(userFbId, type);

        for (const mission of ongoing) {
            const newProgress = mission.progress + 1;
            if (newProgress >= 1) { // لنفترض أن كل مهمة تتطلب خطوة واحدة حالياً
                db.prepare('UPDATE user_missions SET status = "completed", progress = ? WHERE user_fb_id = ? AND mission_id = ?')
                    .run(newProgress, userFbId, mission.mission_id);
                
                await GamificationService.addUserActivity(userFbId, 50, mission.reward_points);
            } else {
                db.prepare('UPDATE user_missions SET progress = ? WHERE user_fb_id = ? AND mission_id = ?')
                    .run(newProgress, userFbId, mission.mission_id);
            }
        }
    }
}
