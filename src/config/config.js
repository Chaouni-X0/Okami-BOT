import dotenv from 'dotenv';
dotenv.config();

export const config = {
    facebook: {
        accessToken: process.env.FB_ACCESS_TOKEN || 'EAAVfEISz5KkBRZBWnJrC3EZCbuIISxhIZAx6hsX2wzaZC7U2ob94pdufWJeeogfkKsbnzE5w5ecBWc9YuqFihNEDNNXHTMxZBNyNgmKvRmxZBDyMMWVZBfIS1RqA1ejkKYleuZCzY4FZAZBwTIoWLuDeEbnNEjmyaUJZC98kvKXW4r8ITP8uAWEUGMafuhoGeqZA8ZCdBwoFp9qoq',
        pageId: process.env.FB_PAGE_ID || '1211757672016850',
        appSecret: process.env.FB_APP_SECRET,
    },
    admin: {
        activationKey: "chaouni_x_2013-2",
        password: process.env.ADMIN_PASSWORD || 'okami2024'
    },
    database: {
        path: './src/database/okami.db',
    },
    scraping: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeout: 30000,
    },
    sources: [
        { id: 'mangaarab', name: 'Manga Arab', url: 'https://mangaarab.com' },
        { id: 'mangalek', name: 'Manga Lek', url: 'https://mangalek.com' },
        { id: 'mangaswat', name: 'Manga Swat', url: 'https://swatmanga.me' }
    ],
    settings: {
        maxImageHeight: 1500, // أقصى طول للصورة قبل التقطيع لتناسب فيسبوك
        cleanupAfterPost: true
    }
};

export default config;
