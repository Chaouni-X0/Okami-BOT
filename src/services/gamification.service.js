import { User } from '../database/mongo.js';
import logger from '../utils/logger.js';

export class GamificationService {
    static getRankTitle(level) {
        if (level < 5) return 'Otaku Beginner';
        if (level < 15) return 'Shadow Reader';
        if (level < 30) return 'Manga Explorer';
        if (level < 50) return 'Okami Warrior';
        return 'Okami King 🐺';
    }

    static async addUserActivity(fbId, xpGain, pointsGain) {
        try {
            let user = await User.findOne({ fb_id: fbId });
            if (!user) {
                user = await User.create({ fb_id: fbId, points: pointsGain, xp: xpGain, level: 1 });
            } else {
                user.xp += xpGain;
                user.points += pointsGain;
                
                const xpNeeded = user.level * 100;
                if (user.xp >= xpNeeded) {
                    user.level++;
                    user.xp -= xpNeeded;
                    logger.info(`User ${fbId} leveled up to ${user.level}!`);
                }
                await user.save();
            }
        } catch (error) {
            logger.error(`Error adding activity for ${fbId}: ${error.message}`);
        }
    }

    static async updateStreak(fbId) {
        try {
            const user = await User.findOne({ fb_id: fbId });
            if (!user) return;

            const now = new Date();
            const lastActive = new Date(user.last_active);
            const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                user.streak += 1;
            } else if (diffDays > 1) {
                user.streak = 1;
            }
            user.last_active = now;
            await user.save();
        } catch (error) {
            logger.error(`Error updating streak for ${fbId}: ${error.message}`);
        }
    }

    // Leaderboard generated only on demand
    static async getLeaderboard() {
        return await User.find().sort({ points: -1 }).limit(10);
    }
}
