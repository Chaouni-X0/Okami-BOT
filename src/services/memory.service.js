import { User, Manga, Chapter } from '../database/mongodb.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export class MemoryService {
    /**
     * Creates or updates a manga record. Always await this call — it's async
     * and returns the saved Mongoose document (use `._id` or `.id` on the result).
     */
    static async saveManga(mangaData) {
        try {
            let manga = await Manga.findOne({ slug: mangaData.slug });
            const data = {
                title: mangaData.title,
                slug: mangaData.slug,
                cover_url: mangaData.coverUrl,
                status: mangaData.status,
                source_site_key: mangaData.sourceSite,
                source_url: mangaData.sourceUrl,
                updated_at: Date.now()
            };

            if (manga) {
                Object.assign(manga, data);
                return await manga.save();
            }
            manga = new Manga(data);
            return await manga.save();
        } catch (error) {
            logger.error(`Error saving manga: ${error.message}`);
            throw error;
        }
    }

    static async markChapterAsPublished(mangaId, chapterNumber, fbPostId) {
        try {
            return await Chapter.findOneAndUpdate(
                { manga_id: mangaId, chapter_number: chapterNumber },
                { 
                    fb_post_id: fbPostId, 
                    is_published: true, 
                    published_at: Date.now() 
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error(`Error marking chapter as published: ${error.message}`);
            throw error;
        }
    }

    static async getPublishedChapters(mangaId) {
        return await Chapter.find({ manga_id: mangaId, is_published: true }).sort({ chapter_number: 1 });
    }

    /**
     * Returns every manga that has at least one published chapter, with a
     * published-chapter count for each — used for the "عرض لائحة ما تم نشره" command.
     */
    static async getAllPublishedManga() {
        const mangas = await Manga.find().sort({ updated_at: -1 });
        const list = [];
        for (const manga of mangas) {
            const count = await Chapter.countDocuments({ manga_id: manga._id, is_published: true });
            if (count > 0) {
                list.push({ title: manga.title, slug: manga.slug, sourceSite: manga.source_site_key, publishedCount: count });
            }
        }
        return list;
    }

    static cleanupMangaStorage(mangaSlug) {
        const tempPath = path.resolve('./data/temp');
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
