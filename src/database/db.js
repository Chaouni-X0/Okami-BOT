import Database from 'better-sqlite3';
import { config } from '../config/config.js';

const db = new Database(config.database.path);

// تهيئة الجداول
export const initDb = () => {
    // جدول الأعمال (Manga/Manhwa)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS manga (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            cover_url TEXT,
            status TEXT DEFAULT 'ongoing',
            source_site TEXT,
            source_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول الفصول (Chapters)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            manga_id INTEGER,
            chapter_number REAL NOT NULL,
            chapter_url TEXT NOT NULL,
            fb_post_id TEXT,
            published_at DATETIME,
            is_published INTEGER DEFAULT 0,
            FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
            UNIQUE(manga_id, chapter_number)
        )
    `).run();

    // جدول السجلات (Logs/Memory)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();

    // جدول المتابعين (Followers)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS followers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_fb_id TEXT NOT NULL,
            manga_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (manga_id) REFERENCES manga(id) ON DELETE CASCADE,
            UNIQUE(user_fb_id, manga_id)
        )
    `).run();

    // جدول الإشعارات (Notifications Queue)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_fb_id TEXT NOT NULL,
            message TEXT NOT NULL,
            is_sent INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول المستخدمين والبيانات التفاعلية (Users & Gamification)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            fb_id TEXT PRIMARY KEY,
            points INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak INTEGER DEFAULT 0,
            last_login DATETIME,
            rank_title TEXT DEFAULT 'Otaku Beginner',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول طلبات المانهوا (Requests)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_fb_id TEXT,
            manga_title TEXT NOT NULL,
            votes INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول التصويت (Votes)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS votes (
            user_fb_id TEXT,
            request_id INTEGER,
            PRIMARY KEY(user_fb_id, request_id)
        )
    `).run();

    // جدول المهام (Missions)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            reward_points INTEGER,
            type TEXT, -- daily/weekly
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // جدول تقدم المهام (User Missions Progress)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS user_missions (
            user_fb_id TEXT,
            mission_id INTEGER,
            status TEXT DEFAULT 'ongoing',
            progress INTEGER DEFAULT 0,
            PRIMARY KEY(user_fb_id, mission_id)
        )
    `).run();

    // جدول تاريخ القراءة (Reading History)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS reading_history (
            user_fb_id TEXT,
            manga_id INTEGER,
            last_chapter REAL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_fb_id, manga_id)
        )
    `).run();

    // جدول الإنجازات (Achievements)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            xp_reward INTEGER
        )
    `).run();

    // جدول إنجازات المستخدم (User Achievements)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            user_fb_id TEXT,
            achievement_id INTEGER,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_fb_id, achievement_id)
        )
    `).run();

    // نظام الـ Streaks المتقدم (Advanced Streaks)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS user_streaks (
            user_fb_id TEXT PRIMARY KEY,
            current_streak INTEGER DEFAULT 0,
            highest_streak INTEGER DEFAULT 0,
            last_activity_date TEXT,
            streak_freeze_count INTEGER DEFAULT 0
        )
    `).run();

    // نظام القبائل (Guilds)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS guilds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            total_points INTEGER DEFAULT 0,
            member_count INTEGER DEFAULT 0
        )
    `).run();

    // ربط المستخدم بالقبيلة
    db.prepare(`
        ALTER TABLE users ADD COLUMN guild_id INTEGER;
    `).run();

    // نظام التصويت الآلي (Auto Polls)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS auto_polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT,
            options TEXT, -- JSON array of options
            status TEXT DEFAULT 'active',
            end_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // نظام الفعاليات (Events)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT, -- DOUBLE_POINTS, FAST_PUBLISH, etc.
            start_date DATETIME,
            end_date DATETIME,
            is_active INTEGER DEFAULT 0
        )
    `).run();

    // نظام التحذيرات (Warnings)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS user_warnings (
            user_fb_id TEXT PRIMARY KEY,
            warning_count INTEGER DEFAULT 0,
            last_warning_reason TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // إعدادات النظام الإضافية
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `).run();
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES ("points_multiplier", "1")').run();
};

export default db;
