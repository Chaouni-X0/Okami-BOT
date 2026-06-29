import scraperEngine from '../modules/scraper.js';
import { MemoryService } from './memory.service.js';
import { QueueSystem } from '../modules/queue.js';
import { config } from '../config/config.js';
import nodeCron from 'node-cron';
import logger from '../utils/logger.js';
import db from '../database/db.js';

export class AdminService {
    constructor() {
        this.scraper = scraperEngine;
        this.queue = QueueSystem;
    }

    async startNewProject(activationKey, siteUrl) {
        if (activationKey !== config.admin.activationKey) {
            throw new Error('Invalid activation key!');
        }

        logger.info(`Starting new project from: ${siteUrl}`);
        
        // 1. استخراج بيانات المانهوا
        const mangaData = await this.scraper.parseManga(siteUrl);
        if (!mangaData) throw new Error('Could not parse manga data.');

        // 2. حفظ في قاعدة البيانات
        const result = MemoryService.saveManga({
            ...mangaData,
            sourceSite: new URL(siteUrl).hostname,
            sourceUrl: siteUrl
        });
        const mangaId = result.id;

        // 3. إضافة الفصول للطابور
        for (const chapter of mangaData.chapters) {
            MemoryService.saveChapter({
                mangaId,
                chapterNumber: chapter.number,
                chapterUrl: chapter.url
            });
            await this.queue.addToQueue(mangaId, {
                number: chapter.number,
                chapterUrl: chapter.url,
                sourceKey: mangaData.sourceKey
            });
        }

        return { success: true, mangaId, title: mangaData.title };
    }

    // Auto-update is now event-driven or manual to save resources
    async triggerUpdate(mangaSlug) {
        logger.info(`Manual update triggered for: ${mangaSlug}`);
        // Implementation for single manga update...
    }
}
