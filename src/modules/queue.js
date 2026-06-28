import { MemoryService } from '../services/memory.service.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import { NotificationService } from '../services/notification.service.js';
import logger from '../utils/logger.js';
import db from '../database/db.js';

export class OkamiQueue {
    constructor() {
        this.processor = new ChapterProcessor();
        this.isProcessing = false;
        this.queue = [];
    }

    async addToQueue(job) {
        this.queue.push(job);
        logger.info(`Job added to queue. Current size: ${this.queue.length}`);
        if (!this.isProcessing) this.processNext();
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();
        
        try {
            const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(task.mangaId);
            if (!manga) throw new Error(`Manga with ID ${task.mangaId} not found.`);

            logger.info(`Processing Chapter ${task.number} of ${manga.title}...`);
            
            // 1. استخراج صور الفصل
            const images = await scraperEngine.parseChapterImages(manga.source_site_key || task.sourceKey, task.url || task.chapterUrl);
            if (!images || images.length === 0) throw new Error(`No images found for chapter ${task.number}`);
            
            // 2. معالجة الصور (تشمل التقطيع)
            const processed = await this.processor.processChapter(manga.slug, task.number, images);
            
            // 3. النشر على فيسبوك
            const postText = `
🐺 فصل جديد من: ${manga.title}
🔢 رقم الفصل: ${task.number}
📖 استمتعوا بالقراءة!
#OkamiBot #Manga #Manhwa
            `;
            const postId = await FacebookPublisher.publishChapter(processed.images, postText);
            
            // 4. تحديث قاعدة البيانات
            MemoryService.markChapterAsPublished(task.mangaId, task.number, postId);
            
            // 5. تنظيف الملفات المؤقتة فوراً لتوفير مساحة
            this.processor.cleanup(processed.chapterDir);

            // 6. إشعار المطور بالنجاح
            if (task.adminFbId) {
                await NotificationService.sendFacebookMessage(task.adminFbId, `✅ تم بنجاح نشر الفصل ${task.number} من "${manga.title}".`);
            }

            logger.info(`Successfully published and cleaned up Chapter ${task.number} of ${manga.title}.`);
            
            // تأخير بسيط لتجنب الحظر
            setTimeout(() => this.processNext(), 5000);

        } catch (error) {
            logger.error(`Error processing task: ${error.message}`);
            setTimeout(() => this.processNext(), 10000);
        }
    }
}

export const QueueSystem = new OkamiQueue();
