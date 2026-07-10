import db from '../database/db.js';
import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { MemoryService } from './memory.service.js';
import logger from '../utils/logger.js';

export class AutomationService {
    constructor() {
        this.trackedManga = []; // Loaded from DB
        this.interval = 30 * 60 * 1000; // Check every 30 minutes
    }

    async init() {
        logger.info("[Automation] Starting automatic update checker...");
        this.loadTrackedManga();
        setInterval(() => this.checkUpdates(), this.interval);
        // Run once on start
        setTimeout(() => this.checkUpdates(), 10000);
    }

    loadTrackedManga() {
        try {
            // Ensure table exists
            db.exec(`
                CREATE TABLE IF NOT EXISTS tracked_manga (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    last_chapter REAL DEFAULT 0,
                    auto_post INTEGER DEFAULT 1
                )
            `);
            this.trackedManga = db.prepare('SELECT * FROM tracked_manga WHERE auto_post = 1').all() || [];
            logger.info(`[Automation] Loaded ${this.trackedManga.length} tracked manga.`);
        } catch (e) {
            logger.error(`[Automation] Load error: ${e.message}`);
            this.trackedManga = [];
        }
    }

    async checkUpdates() {
        logger.info("[Automation] Checking for updates...");
        for (const manga of this.trackedManga) {
            try {
                const details = await scraperEngine.getMangaDetails(manga.source_id, manga.url);
                
                // Save or retrieve manga in MemoryService to get its database ID
                const savedManga = await MemoryService.saveManga({
                    title: details.title,
                    slug: manga.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-+|-+$/g, '') || `manga-${Date.now()}`,
                    coverUrl: details.coverUrl,
                    description: details.description,
                    status: details.status || 'مستمر',
                    sourceSite: manga.source_id,
                    sourceUrl: manga.url
                });
                const mangaId = savedManga._id || savedManga.id;

                // Find all chapters newer than our last tracked chapter
                const newChapters = details.chapters
                    .filter(ch => ch.number > manga.last_chapter)
                    .sort((a, b) => a.number - b.number);

                if (newChapters.length > 0) {
                    logger.info(`[Automation] Found ${newChapters.length} new chapters for "${manga.title}". Publishing chronologically...`);
                    
                    for (const ch of newChapters) {
                        logger.info(`[Automation] New chapter queued for ${manga.title}: ${ch.name} (Number: ${ch.number})`);
                        
                        const postMessage = `╭━━━〔 🔥 فصل جديد 🔥 〕━━━╮\n📖 اسم العمل: ❪ ${details.title} ❫\n📌 الفصل: ❪ ${ch.name} ❫\n╰━━━━━━━━━━━━━━━╯\n\n📝 نبذة:\n${details.description ? details.description.substring(0, 200) + '...' : 'لا يوجد وصف متاح.'}\n\n📥 قراءة مباشرة:\n🔗 ${ch.url}\n\n━━━━━━━━━━━━━━━\n🔥 لا تنسوا المتابعة ليصلكم كل جديد\n💬 شاركونا رأيكم 👇`;

                        await QueueSystem.addChapterToQueue({
                            mangaId: mangaId,
                            mangaTitle: details.title,
                            chapterName: ch.name,
                            chapterNumber: ch.number,
                            chapterUrl: ch.url,
                            sourceKey: manga.source_id,
                            customMessage: postMessage
                        });
                    }

                    // Update DB with the highest new chapter number
                    const highestNumber = newChapters[newChapters.length - 1].number;
                    db.prepare('UPDATE tracked_manga SET last_chapter = ? WHERE id = ?').run(highestNumber, manga.id);
                    manga.last_chapter = highestNumber;
                }
            } catch (error) {
                logger.error(`[Automation] Error checking ${manga.title}: ${error.message}`);
            }
        }
    }

    async addMangaToTrack(title, url, sourceId, lastChapter) {
        db.prepare('INSERT INTO tracked_manga (title, url, source_id, last_chapter) VALUES (?, ?, ?, ?)').run(title, url, sourceId, lastChapter);
        this.loadTrackedManga();
    }

    async removeMangaFromTrack(id) {
        // We set auto_post to 0 or delete it to untrack
        db.prepare('DELETE FROM tracked_manga WHERE id = ?').run(id);
        this.loadTrackedManga();
    }

    getTrackedMangaList() {
        try {
            return db.prepare('SELECT * FROM tracked_manga').all() || [];
        } catch (e) {
            return this.trackedManga;
        }
    }
}

export default new AutomationService();
