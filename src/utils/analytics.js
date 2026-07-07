import { execSync } from 'child_process';
import logger from './logger.js';

export class Analytics {
    static async getDomainStats(domain) {
        try {
            logger.info(`[Analytics] Fetching SimilarWeb stats for: ${domain}`);
            
            // Execute the Python bridge script
            const scriptPath = '/home/ubuntu/Okami-BOT/scripts/similarweb_bridge.py';
            const output = execSync(`python3 ${scriptPath} ${domain}`).toString();
            return JSON.parse(output);
        } catch (error) {
            logger.error(`[Analytics] SimilarWeb fetch failed: ${error.message}`);
            return { error: 'Failed to fetch analytics', domain };
        }
    }
}
