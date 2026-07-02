import { User } from '../database/mongodb.js';
import logger from '../utils/logger.js';

export class UserService {
    static async getProfile(fbId) {
        try {
            let user = await User.findOne({ fb_id: fbId });
            if (!user) {
                user = new User({ fb_id: fbId, name: 'User' });
                await user.save();
            }
            return user;
        } catch (error) {
            logger.error(`Error getting profile for ${fbId}: ${error.message}`);
            return null;
        }
    }

    static async recordReading(fbId, mangaId, chapterNumber) {
        try {
            const user = await this.getProfile(fbId);
            
            // Points and XP logic
            const pointsToAdd = 10;
            const xpToAdd = 20;

            user.points += pointsToAdd;
            user.xp += xpToAdd;

            // Level Up logic
            const nextLevelXp = user.level * 100;
            if (user.xp >= nextLevelXp) {
                user.level += 1;
                user.xp -= nextLevelXp;
            }

            // Update Streak
            await this.updateStreak(user);

            await user.save();
            return { success: true, pointsAdded: pointsToAdd, xpAdded: xpToAdd };
        } catch (error) {
            logger.error(`Error recording reading for ${fbId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    static async updateStreak(user) {
        const today = new Date().toISOString().split('T')[0];
        const lastActive = user.last_active ? user.last_active.toISOString().split('T')[0] : null;

        if (!lastActive) {
            user.streak = 1;
        } else if (lastActive !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (lastActive === yesterdayStr) {
                user.streak += 1;
            } else {
                user.streak = 1;
            }
        }
        user.last_active = new Date();
    }
}
