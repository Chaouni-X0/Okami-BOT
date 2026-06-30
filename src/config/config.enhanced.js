import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * إعدادات محسّنة لبوت أوكامي
 * تحسين الأمان والبيئة والمرونة
 */
export const config = {
    // ===== معلومات التطبيق =====
    app: {
        name: '🐺 Okami Bot',
        version: '5.0.0',
        environment: process.env.NODE_ENV || 'production',
        port: process.env.PORT || 7860,
        isDevelopment: process.env.NODE_ENV === 'development'
    },

    // ===== Facebook API =====
    facebook: {
        accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
        verifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
        pageId: process.env.FACEBOOK_PAGE_ID,
        apiVersion: 'v18.0'
    },

    // ===== المصادقة والأمان =====
    admin: {
        password: process.env.ADMIN_PASSWORD,
        activationKey: process.env.ADMIN_ACTIVATION_KEY,
        allowedAdmins: (process.env.ALLOWED_ADMINS || '').split(',').filter(Boolean)
    },

    // ===== قاعدة البيانات =====
    database: {
        // SQLite (محلي - للعمليات المؤقتة)
        sqlite: {
            path: process.env.SQLITE_PATH || path.resolve('./src/database/okami.db')
        },
        
        // MongoDB (سحابي - للبيانات الدائمة)
        mongodb: {
            uri: process.env.MONGODB_URI,
            enabled: !!process.env.MONGODB_URI,
            options: {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                retryWrites: true,
                w: 'majority'
            }
        }
    },

    // ===== مواقع الويب المدعومة =====
    sources: [
        {
            id: 'mangadex',
            name: 'MangaDex',
            url: 'https://mangadex.org',
            enabled: true
        },
        {
            id: 'manganato',
            name: 'MangaNato',
            url: 'https://manganato.com',
            enabled: true
        },
        {
            id: 'webtoon',
            name: 'Webtoon',
            url: 'https://www.webtoons.com',
            enabled: true
        },
        {
            id: 'tapas',
            name: 'Tapas',
            url: 'https://tapas.io',
            enabled: true
        }
    ],

    // ===== معالجة الفصول =====
    processing: {
        delayBetweenChapters: 5 * 60 * 1000, // 5 دقائق
        batchSize: 5, // معالجة وحذف كل 5 فصول
        maxRetries: 3, // عدد محاولات إعادة المحاولة
        retryDelay: 60 * 1000, // 1 دقيقة بين المحاولات
        timeout: 30 * 1000 // 30 ثانية timeout للعمليات
    },

    // ===== تخزين الملفات =====
    storage: {
        dataDir: process.env.DATA_DIR || path.resolve('./src/data'),
        tempDir: process.env.TEMP_DIR || path.resolve('./src/temp'),
        logsDir: process.env.LOGS_DIR || path.resolve('./src/logs'),
        maxTempAge: 10 * 60 * 1000, // حذف الملفات المؤقتة بعد 10 دقائق
        cleanupInterval: 60 * 60 * 1000 // فحص التنظيف كل ساعة
    },

    // ===== السجلات =====
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        maxSize: '20m',
        maxFiles: 5,
        colorize: !process.env.NODE_ENV === 'production'
    },

    // ===== الحدود والقيود =====
    limits: {
        maxChaptersPerRequest: 100,
        maxMangaPerUser: 50,
        maxQueueSize: 1000,
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 دقيقة
            maxRequests: 100
        }
    },

    // ===== الميزات =====
    features: {
        enableDashboard: true,
        enableAutoUpdate: true,
        enableNotifications: true,
        enableGamification: true,
        enableCommunity: true
    },

    // ===== المعالجات المتقدمة =====
    advanced: {
        enableAsyncProcessing: true,
        enableCaching: true,
        enableCompression: true,
        enableLoadBalancing: false
    }
};

/**
 * التحقق من الإعدادات الحرجة
 */
export function validateConfig() {
    const errors = [];

    // التحقق من Facebook
    if (!config.facebook.accessToken) {
        errors.push('❌ FACEBOOK_ACCESS_TOKEN غير محدد');
    }
    if (!config.facebook.verifyToken) {
        errors.push('❌ FACEBOOK_VERIFY_TOKEN غير محدد');
    }

    // التحقق من كلمة السر
    if (!config.admin.password) {
        errors.push('⚠️ ADMIN_PASSWORD غير محدد (استخدام القيمة الافتراضية)');
    }

    // التحقق من قاعدة البيانات
    if (!config.database.sqlite.path) {
        errors.push('❌ SQLITE_PATH غير محدد');
    }

    if (errors.length > 0) {
        console.error('⚠️ تحذيرات الإعدادات:');
        errors.forEach(err => console.error(err));
    }

    return errors.length === 0;
}

export default config;
