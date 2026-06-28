import dotenv from 'dotenv';
dotenv.config();

export const config = {
    facebook: {
        accessToken: process.env.FB_ACCESS_TOKEN,
        pageId: process.env.FB_PAGE_ID,
        appSecret: process.env.FB_APP_SECRET,
    },
    admin: {
        activationKey: "chaouni_x_2013-2",
    },
    database: {
        path: './src/database/okami.db',
    },
    scraping: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeout: 30000,
    },
    queue: {
        redisHost: process.env.REDIS_HOST || '127.0.0.1',
        redisPort: process.env.REDIS_PORT || 6379,
    }
};
