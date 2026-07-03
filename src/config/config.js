import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const DATA_DIR = process.env.DATA_DIR || './data';

export const config = {
    facebook: {
        accessToken: process.env.FB_ACCESS_TOKEN || 'EAAVfEISz5KkBRZBWnJrC3EZCbuIISxhIZAx6hsX2wzaZC7U2ob94pdufWJeeogfkKsbnzE5w5ecBWc9YuqFihNEDNNXHTMxZBNyNgmKvRmxZBDyMMWVZBfIS1RqA1ejkKYleuZCzY4FZAZBwTIoWLuDeEbnNEjmyaUJZC98kvKXW4r8ITP8uAWEUGMafuhoGeqZA8ZCdBwoFp9qoq',
        pageId: process.env.FB_PAGE_ID || '1211757672016850',
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
