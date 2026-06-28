import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const dbPath = path.resolve('./src/database/okami.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// تهيئة الجداول
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fb_id TEXT UNIQUE,
        name TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        points INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        guild_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        slug TEXT UNIQUE,
        cover_url TEXT,
        status TEXT,
        source_site_key TEXT,
        source_url TEXT,
        auto_update INTEGER DEFAULT 0,
        aggregation_post_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manga_id INTEGER,
        chapter_number REAL,
        chapter_url TEXT,
        fb_post_id TEXT,
        is_published INTEGER DEFAULT 0,
        published_at TIMESTAMP,
        FOREIGN KEY (manga_id) REFERENCES manga(id),
        UNIQUE(manga_id, chapter_number)
    );

    CREATE TABLE IF NOT EXISTS guilds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        leader_id INTEGER,
        member_count INTEGER DEFAULT 0
    );
`);

logger.info('Database initialized with new schema.');

export default db;
