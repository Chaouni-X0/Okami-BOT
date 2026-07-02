import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

// تحديد مسار التخزين الدائم (Persistent Storage)
// في Render، سنقوم بربط هذا المسار بـ Persistent Disk
const DATA_DIR = process.env.DATA_DIR || './data';

export const config = {
    port: process.env.PORT || 3000,
    facebook: {
        accessToken: process.env.PAGE_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN,
        pageId: process.env.FB_PAGE_ID,
        appSecret: process.env.FB_APP_SECRET,
        verifyToken: process.env.VERIFY_TOKEN || 'OKAMI_BOT_VERIFY_TOKEN'
    },
    admin: {
        activationKey: process.env.ACTIVATION_KEY || "chaouni_x_2013-2",
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
        { id: 'mangaarab', name: 'مانجا عرب', url: 'https://mangaarab.com', type: 'wp-manga' },
        { id: 'mangalek', name: 'مانجا ليك', url: 'https://mangalek.com', type: 'wp-manga' },
        { id: 'mangaswat', name: 'مانجا سوات', url: 'https://swatmanga.me', type: 'wp-manga' },
        { id: 'asurascans', name: 'Asura Scans', url: 'https://asuracomics.gg', type: 'custom' },
        { id: 'reaperscans', name: 'Reaper Scans', url: 'https://reaperscans.com', type: 'custom' },
        { id: 'mangadex', name: 'MangaDex', url: 'https://mangadex.org', type: 'api' },
        { id: 'mangakakalot', name: 'MangaKakalot', url: 'https://mangakakalot.com', type: 'custom' }
    ],
    settings: {
        maxImageHeight: 1500,
        cleanupAfterPost: true,
        tempDir: path.join(DATA_DIR, 'temp')
    }
};

export default config;
