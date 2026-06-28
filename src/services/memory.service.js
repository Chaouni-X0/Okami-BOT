import db from '../database/db.js';

export class MemoryService {
    static saveManga(mangaData) {
        const stmt = db.prepare(`
            INSERT INTO manga (title, slug, cover_url, status, source_site, source_url)
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

    static saveChapter(chapterData) {
        const stmt = db.prepare(`
            INSERT INTO chapters (manga_id, chapter_number, chapter_url)
            VALUES (?, ?, ?)
            ON CONFLICT(manga_id, chapter_number) DO NOTHING
        `);
        return stmt.run(chapterData.mangaId, chapterData.chapterNumber, chapterData.chapterUrl);
    }

    static markChapterAsPublished(mangaId, chapterNumber, fbPostId) {
        const stmt = db.prepare(`
            UPDATE chapters 
            SET is_published = 1, fb_post_id = ?, published_at = CURRENT_TIMESTAMP
            WHERE manga_id = ? AND chapter_number = ?
        `);
        return stmt.run(fbPostId, mangaId, chapterNumber);
    }

    static getMangaBySlug(slug) {
        return db.prepare('SELECT * FROM manga WHERE slug = ?').get(slug);
    }

    static getUnpublishedChapters(mangaId) {
        return db.prepare('SELECT * FROM chapters WHERE manga_id = ? AND is_published = 0 ORDER BY chapter_number ASC').all(mangaId);
    }
}
