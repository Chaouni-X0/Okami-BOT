import db from '../database/db.js';
import logger from '../utils/logger.js';

export class EventService {
    static async startEvent(name, type, durationHours) {
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + durationHours);

        db.prepare('UPDATE events SET is_active = 0').run(); // إيقاف أي فعالية سابقة
        db.prepare('INSERT INTO events (name, type, start_date, end_date, is_active) VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)')
            .run(name, type, endDate.toISOString());
        
        logger.info(`Event ${name} started until ${endDate.toISOString()}`);
    }

    static getActiveEvent() {
        return db.prepare('SELECT * FROM events WHERE is_active = 1 AND end_date > CURRENT_TIMESTAMP').get();
    }

    static async joinGuild(userFbId, guildName) {
        const guild = db.prepare('SELECT id FROM guilds WHERE name = ?').get(guildName);
        if (!guild) throw new Error('Guild not found');

        db.prepare('UPDATE users SET guild_id = ? WHERE fb_id = ?').run(guild.id, userFbId);
        db.prepare('UPDATE guilds SET member_count = member_count + 1 WHERE id = ?').run(guild.id);
        
        return { success: true, guildName };
    }

    static getGuildLeaderboard() {
        return db.prepare('SELECT name, total_points, member_count FROM guilds ORDER BY total_points DESC').all();
    }
}
