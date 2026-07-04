import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const DATA_DIR = process.env.DATA_DIR || './data';

export const config = {
    facebook: {
        // SECURITY: never hardcode real tokens here. These must come from
        // Railway/host environment variables only. If missing, the bot will
        // fail loudly at startup instead of silently using a stale/leaked token.
        accessToken: process.env.FB_ACCESS_TOKEN || '',
        pageId: process.env.FB_PAGE_ID || '',
        appSecret: process.env.FB_APP_SECRET,
        verifyToken: process.env.FB_VERIFY_TOKEN || 'okami_verify_token'
    },
    admin: {
        activationKey: "chaouni_x_2013-2",
        password: process.env.ADMIN_PASSWORD || 'OKAMI-BOT__START'
    },
    database: {
        path: path.join(DATA_DIR, 'okami.db'),
    },
    scraping: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeout: 30000,
    },
    sources: [
        { id: 'mangaswat', name: 'مانجا سوات', url: 'https://meshmanga.com' },
        { id: 'asura', name: 'اسورا', url: 'https://asurascans.com' },
        { id: 'teamx', name: 'تيم اكس', url: 'https://olympustaff.com' },
        { id: 'azora', name: 'Azora', url: 'https://azorafly.com' }
    ],
    settings: {
        maxImageHeight: 1500,
        cleanupAfterPost: true,
        tempDir: path.join(DATA_DIR, 'temp')
    }
};

export default config;
