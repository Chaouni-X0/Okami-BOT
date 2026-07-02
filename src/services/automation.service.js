import db from '../database/db.js';
import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import logger from '../utils/logger.js';

export class AutomationService {
    constructor() {
        this.trackedManga = []; // Should be loaded from DB
        this.interval = 30 * 60 * 1000; // Check every 30 minutes
    }

    async init() {
        logger.info("[Automation] Starting automatic update checker...");
        this.loadTrackedManga();
        setInterval(() => this.checkUpdates(), this.interval);
        // Run once on start
        this.checkUpdates();
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
            this.trackedManga = db.prepare('SELECT * FROM tracked_manga WHERE auto_post = 1').all();
            logger.info(`[Automation] Loaded ${this.trackedManga.length} tracked manga.`);
        } catch (e) {
            logger.error(`[Automation] Load error: ${e.message}`);
        }
    }

    async checkUpdates() {
        logger.info("[Automation] Checking for updates...");
        for (const manga of this.trackedManga) {
            try {
                const details = await scraperEngine.getMangaDetails(manga.source_id, manga.url);
                const latest = details.chapters[0];
                
                if (latest && latest.number > manga.last_chapter) {
                    logger.info(`[Automation] New chapter found for ${manga.title}: ${latest.number}`);
                    
                    const postMessage = `╭━━━〔 🔥 فصل جديد 🔥 〕━━━╮\n📖 اسم العمل: ❪ ${details.title} ❫\n📌 الفصل: ❪ ${latest.number} ❫\n╰━━━━━━━━━━━━━━━╯\n\n📝 نبذة:\n${details.description.substring(0, 200)}...\n\n📥 قراءة مباشرة:\n🔗 ${latest.url}\n\n━━━━━━━━━━━━━━━\n🔥 لا تنسوا المتابعة ليصلكم كل جديد\n💬 شاركونا رأيكم 👇`;

                    await QueueSystem.addChapterToQueue({
                        mangaTitle: details.title,
                        chapterName: latest.name,
                        chapterUrl: latest.url,
                        sourceKey: manga.source_id,
                        customMessage: postMessage
                    });

                    // Update DB
                    db.prepare('UPDATE tracked_manga SET last_chapter = ? WHERE id = ?').run(latest.number, manga.id);
                    manga.last_chapter = latest.number;
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
}

export default new AutomationService();
