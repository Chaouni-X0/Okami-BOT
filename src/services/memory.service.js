import db from '../database/db.js';
import { Manga } from '../database/mongo.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class MemoryService {
    static async saveManga(mangaData) {
        try {
            const manga = await Manga.findOneAndUpdate(
                { slug: mangaData.slug },
                {
                    title: mangaData.title,
                    cover_url: mangaData.coverUrl,
                    status: mangaData.status,
                    source_site_key: mangaData.sourceSite,
                    source_url: mangaData.sourceUrl,
                    updated_at: new Date()
                },
                { upsert: true, new: true }
            );
            return { id: manga.slug }; // Use slug as the identifier for SQLite chapter table
        } catch (error) {
            logger.error(`Error saving manga to MongoDB: ${error.message}`);
            throw error;
        }
    }

    static markChapterAsPublished(mangaId, chapterNumber, fbPostId) {
        // التأكد من وجود الفصل أولاً أو إنشائه
        db.prepare(`
            INSERT INTO chapters (manga_id, chapter_number, is_published, fb_post_id, published_at)
            VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(manga_id, chapter_number) DO UPDATE SET
                is_published = 1,
                fb_post_id = excluded.fb_post_id,
                published_at = CURRENT_TIMESTAMP
        `).run(mangaId, chapterNumber, fbPostId);
    }

    static getPublishedChapters(mangaId) {
        return db.prepare('SELECT * FROM chapters WHERE manga_id = ? AND is_published = 1 ORDER BY chapter_number ASC').all(mangaId);
    }

    static cleanupMangaStorage(mangaSlug) {
        const tempPath = path.resolve('./src/temp');
        // البحث عن كل المجلدات التي تبدأ بـ slug المانهوا
        if (fs.existsSync(tempPath)) {
            const dirs = fs.readdirSync(tempPath);
            for (const dir of dirs) {
                if (dir.startsWith(mangaSlug)) {
                    const fullPath = path.join(tempPath, dir);
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    logger.info(`Cleaned up storage for: ${dir}`);
                }
            }
        }
    }
}
