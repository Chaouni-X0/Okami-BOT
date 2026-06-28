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
        this.publisher = new FacebookPublisher();
        this.isProcessing = false;
        this.queue = [];
    }

    async addToQueue(mangaId, chapterData) {
        this.queue.push({ mangaId, ...chapterData });
        logger.info(`Added Chapter ${chapterData.number} of manga ID ${mangaId} to queue.`);
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
            const manga = await this.getMangaById(task.mangaId);
            if (!manga) throw new Error(`Manga with ID ${task.mangaId} not found.`);

            logger.info(`Processing Chapter ${task.number} of ${manga.title}...`);
            
            // 1. استخراج صور الفصل
            const images = await scraperEngine.parseChapterImages(manga.source_site_key || task.sourceKey, task.url || task.chapterUrl);
            if (!images || images.length === 0) throw new Error(`No images found for chapter ${task.number}`);
            
            // 2. معالجة الصور
            const processed = await this.processor.processChapter(manga.slug, task.number, images);
            
            // 3. النشر على فيسبوك
            const postId = await this.publisher.publishChapter(manga.title, task.number, processed.images);
            
            // 4. تحديث قاعدة البيانات
            MemoryService.markChapterAsPublished(task.mangaId, task.number, postId);
            
            // 5. تنظيف الملفات المؤقتة
            await this.processor.cleanup(processed.chapterDir);

            // 6. إرسال إشعارات للمتابعين
            const postUrl = `https://facebook.com/${postId}`;
            await NotificationService.notifyFollowers(task.mangaId, task.number, postUrl);

            // 7. إرسال تنبيه للمطور إذا كان هو من بدأ العملية
            if (task.adminFbId) {
                await NotificationService.sendFacebookMessage(task.adminFbId, `✅ تم بنجاح نشر الفصل ${task.number} من "${manga.title}".\n🔗 الرابط: ${postUrl}`);
            }

            logger.info(`Successfully published Chapter ${task.number} of ${manga.title}.`);
            
            // تأخير لتجنب الحظر
            const delay = Math.floor(Math.random() * (120000 - 60000) + 60000); // 1-2 minutes
            setTimeout(() => this.processNext(), delay);

        } catch (error) {
            logger.error(`Error processing task: ${error.message}`);
            // إعادة المحاولة بعد فترة قصيرة إذا فشل
            setTimeout(() => this.processNext(), 60000);
        }
    }

    async getMangaById(id) {
        return db.prepare('SELECT * FROM manga WHERE id = ?').get(id);
    }
}

export const QueueSystem = new OkamiQueue();
