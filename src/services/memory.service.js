import db from '../database/db.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class MemoryService {
    static saveManga(mangaData) {
        const stmt = db.prepare(`
            INSERT INTO manga (title, slug, cover_url, status, source_site_key, source_url)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                status = excluded.status,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `);
        return stmt.get(
            mangaData.title,
            mangaData.slug,
            mangaData.coverUrl,
            mangaData.status,
            mangaData.sourceSite,
            mangaData.sourceUrl
        );
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
