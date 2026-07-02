import db from '../database/db.js';
import logger from '../utils/logger.js';

export class UserService {
    static async getProfile(fbId) {
        try {
            let user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(fbId);
            if (!user) {
                db.prepare('INSERT INTO users (fb_id, name, level, xp, points, streak) VALUES (?, ?, ?, ?, ?, ?)').run(fbId, 'User', 1, 0, 0, 0);
                user = db.prepare('SELECT * FROM users WHERE fb_id = ?').get(fbId);
            }
            
            // Add rank_title logic
            user.rank_title = this.getRankTitle(user.level);
            return user;
        } catch (error) {
            logger.error(`Error getting profile for ${fbId}: ${error.message}`);
            return { fb_id: fbId, name: 'User', level: 1, points: 0, streak: 0, rank_title: 'مبتدئ' };
        }
    }

    static getRankTitle(level) {
        if (level >= 50) return "إمبراطور الأوكامي 👑";
        if (level >= 30) return "جنرال القطيع ⚔️";
        if (level >= 15) return "صياد محترف 🏹";
        if (level >= 5) return "عضو نشط 🐺";
        return "مبتدئ 🌱";
    }

    static async recordReading(fbId, mangaId, chapterNumber) {
        try {
            const user = await this.getProfile(fbId);
            
            const pointsToAdd = 10;
            const xpToAdd = 20;

            let newPoints = user.points + pointsToAdd;
            let newXp = user.xp + xpToAdd;
            let newLevel = user.level;

            const nextLevelXp = newLevel * 100;
            if (newXp >= nextLevelXp) {
                newLevel += 1;
                newXp -= nextLevelXp;
            }

            db.prepare('UPDATE users SET points = ?, xp = ?, level = ? WHERE fb_id = ?').run(newPoints, newXp, newLevel, fbId);
            
            return { success: true, pointsAdded: pointsToAdd, xpAdded: xpToAdd };
        } catch (error) {
            logger.error(`Error recording reading for ${fbId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

export default UserService;
