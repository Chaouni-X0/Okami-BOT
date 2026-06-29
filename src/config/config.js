import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

// Persistent Storage path (Important for Hugging Face /data)
const DATA_DIR = process.env.DATA_DIR || './data';

export const config = {
    port: process.env.PORT || 7860,
    facebook: {
        accessToken: process.env.FB_ACCESS_TOKEN,
        pageId: process.env.FB_PAGE_ID,
        appSecret: process.env.FB_APP_SECRET,
        verifyToken: process.env.FACEBOOK_VERIFY_TOKEN
    },
    admin: {
        activationKey: process.env.ADMIN_ACTIVATION_KEY,
        password: process.env.ADMIN_PASSWORD
    },
    mongodb: {
        uri: process.env.MONGODB_URI
    },
    database: {
        path: path.join(DATA_DIR, 'okami.db'),
    },
    scraping: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeout: 30000,
    },
    sources: [
        { id: 'mangaarab', name: 'Manga Arab', url: 'https://mangaarab.com' },
        { id: 'mangalek', name: 'Manga Lek', url: 'https://mangalek.com' },
        { id: 'mangaswat', name: 'Manga Swat', url: 'https://swatmanga.me' },
        { id: 'gmanga', name: 'G-Manga', url: 'https://gmanga.me' },
        { id: 'azoramanga', name: 'Azora Manga', url: 'https://azoramanga.com' },
        { id: 'mangatime', name: 'Manga Time', url: 'https://mangatime.us' },
        { id: 'mangaonlineteam', name: 'Manga Online Team', url: 'https://mangaonlineteam.com' },
        { id: 'teamx', name: 'Team X', url: 'https://team1x1.com' },
        { id: 'mangaspark', name: 'Manga Spark', url: 'https://mangaspark.com' },
        { id: 'mangalord', name: 'Manga Lord', url: 'https://mangalord.com' }
    ],
    settings: {
        maxImageHeight: 1500,
        cleanupAfterPost: true,
        tempDir: path.join(DATA_DIR, 'temp')
    }
};

export default config;
