import { ScraperEngine } from '../modules/scraper.js';
import { MemoryService } from './memory.service.js';
import { OkamiQueue } from '../modules/queue.js';
import { config } from '../config/config.js';
import nodeCron from 'node-cron';

export class AdminService {
    constructor() {
        this.scraper = new ScraperEngine();
        this.queue = new OkamiQueue();
    }

    async startNewProject(activationKey, siteUrl) {
        if (activationKey !== config.admin.activationKey) {
            throw new Error('Invalid activation key!');
        }

        console.log(`Starting new project from: ${siteUrl}`);
        
        // 1. استخراج بيانات المانهوا
        const mangaData = await this.scraper.parseManga(siteUrl);
        if (!mangaData) throw new Error('Could not parse manga data.');

        // 2. حفظ في قاعدة البيانات
        const { id: mangaId } = MemoryService.saveManga({
            ...mangaData,
            sourceSite: new URL(siteUrl).hostname
        });

        // 3. إضافة الفصول للطابور
        for (const chapter of mangaData.chapters) {
            MemoryService.saveChapter({
                mangaId,
                chapterNumber: chapter.number,
                chapterUrl: chapter.url
            });
            await this.queue.addToQueue(mangaId, chapter);
        }

        return { success: true, mangaId, title: mangaData.title };
    }

    // نظام التحديث التلقائي (يفحص كل ساعة)
    initAutoUpdate() {
        nodeCron.schedule('0 * * * *', async () => {
            console.log('Running auto-update check...');
            import db from '../database/db.js';
            const activeManga = db.prepare("SELECT * FROM manga WHERE status = 'ongoing'").all();

            for (const manga of activeManga) {
                const latestData = await this.scraper.parseManga(manga.source_url);
                if (latestData) {
                    for (const chapter of latestData.chapters) {
                        const exists = db.prepare('SELECT id FROM chapters WHERE manga_id = ? AND chapter_number = ?')
                            .get(manga.id, chapter.number);
                        
                        if (!exists) {
                            MemoryService.saveChapter({
                                mangaId: manga.id,
                                chapterNumber: chapter.number,
                                chapterUrl: chapter.url
                            });
                            await this.queue.addToQueue(manga.id, chapter);
                        }
                    }
                }
            }
        });
    }
}
