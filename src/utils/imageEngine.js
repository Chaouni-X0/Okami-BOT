import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '../../assets/templates');

export class ImageEngine {
    static async createProfileCard(userData) {
        logger.info('[AI Studio] ImageEngine: Creating profile card (mocked)');
        try {
            return fs.readFileSync(path.join(TEMPLATE_DIR, 'base_profile.png'));
        } catch (e) {
            logger.error(`[AI Studio] Failed to read base_profile template: ${e.message}`);
            return Buffer.alloc(0);
        }
    }

    static async createRewardNotice(points, username) {
        logger.info('[AI Studio] ImageEngine: Creating reward notice (mocked)');
        try {
            return fs.readFileSync(path.join(TEMPLATE_DIR, 'base_reward.png'));
        } catch (e) {
            logger.error(`[AI Studio] Failed to read base_reward template: ${e.message}`);
            return Buffer.alloc(0);
        }
    }
}

