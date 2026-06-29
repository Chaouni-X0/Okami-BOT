import { User } from '../database/mongo.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import { GamificationService } from './gamification.service.js';

export class UserService {
    static async getProfile(fbId) {
        try {
            let user = await User.findOne({ fb_id: fbId });
            if (!user) {
                user = await User.create({ fb_id: fbId });
            }
            return user;
        } catch (error) {
            logger.error(`Error getting profile for ${fbId}: ${error.message}`);
            return null;
        }
    }

    // Triggered on user interaction
    static async onInteraction(fbId, type) {
        logger.info(`Interaction event: ${type} from ${fbId}`);
        const xpGain = type === 'comment' ? 15 : 5;
        const pointsGain = type === 'comment' ? 10 : 2;
        await GamificationService.addUserActivity(fbId, xpGain, pointsGain);
    }

    static async recordReading(fbId, mangaSlug, chapterNumber) {
        try {
            // User XP/Points logic via Gamification
            await GamificationService.addUserActivity(fbId, 20, 10);
            
            // Streak logic is now inside Gamification or event-driven
            await GamificationService.updateStreak(fbId);

            return { success: true };
        } catch (error) {
            logger.error(`Error recording reading for ${fbId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
