import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export class VisualEngine {
    constructor() {
        this.assetsDir = path.resolve('./src/assets');
        if (!fs.existsSync(this.assetsDir)) fs.mkdirSync(this.assetsDir, { recursive: true });
    }

    async generateUserProfileCard(userData) {
        const width = 800;
        const height = 400;

        // خلفية سوداء بأسلوب Okami (Dark Mode)
        const svgImage = `
        <svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="#0a0a0a"/>
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff4d4d;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#b30000;stop-opacity:1" />
                </linearGradient>
            </defs>
            <text x="50" y="80" font-family="Arial" font-size="40" fill="url(#grad)" font-weight="bold">🐺 OKAMI PROFILE</text>
            
            <text x="50" y="150" font-family="Arial" font-size="25" fill="#ffffff">User ID: ${userData.fb_id}</text>
            <text x="50" y="200" font-family="Arial" font-size="30" fill="#ff4d4d" font-weight="bold">Rank: ${userData.rank_title}</text>
            
            <rect x="50" y="250" width="700" height="30" rx="15" fill="#333"/>
            <rect x="50" y="250" width="${Math.min((userData.xp / (userData.level * 100)) * 700, 700)}" height="30" rx="15" fill="url(#grad)"/>
            
            <text x="50" y="320" font-family="Arial" font-size="20" fill="#aaa">Level: ${userData.level}</text>
            <text x="250" y="320" font-family="Arial" font-size="20" fill="#aaa">Points: ${userData.points}</text>
            <text x="450" y="320" font-family="Arial" font-size="20" fill="#aaa">Streak: 🔥 ${userData.streak} Days</text>
            
            <circle cx="700" cy="100" r="50" fill="#1a1a1a" stroke="#ff4d4d" stroke-width="3"/>
            <text x="685" y="115" font-family="Arial" font-size="40" fill="#ff4d4d">🐺</text>
        </svg>
        `;

        const outputPath = path.join(this.assetsDir, `profile-${userData.fb_id}.png`);
        await sharp(Buffer.from(svgImage))
            .png()
            .toFile(outputPath);

        return outputPath;
    }

    async generateDailyMissionCard(missions) {
        const width = 600;
        const height = 400;

        const missionList = missions.map((m, i) => `
            <text x="50" y="${150 + (i * 60)}" font-family="Arial" font-size="20" fill="#ffffff">🔹 ${m.title} (+${m.reward_points} pts)</text>
        `).join('');

        const svgImage = `
        <svg width="${width}" height="${height}">
            <rect width="100%" height="100%" fill="#1a1a1a" rx="20"/>
            <text x="50" y="80" font-family="Arial" font-size="35" fill="#ff4d4d" font-weight="bold">🎯 DAILY MISSIONS</text>
            <line x1="50" y1="100" x2="550" y2="100" stroke="#333" stroke-width="2"/>
            ${missionList}
            <text x="50" y="360" font-family="Arial" font-size="15" fill="#666">🐺 Okami Bot - Challenge Yourself!</text>
        </svg>
        `;

        const outputPath = path.join(this.assetsDir, `missions-${Date.now()}.png`);
        await sharp(Buffer.from(svgImage))
            .png()
            .toFile(outputPath);

        return outputPath;
    }
}
