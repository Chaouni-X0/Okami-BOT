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
        this.delayBetweenChapters = 5 * 60 * 1000; // 5 دقائق بالميلي ثانية
    }

    async addToQueue(job) {
        this.queue.push(job);
        logger.info(`Job added to queue. Current size: ${this.queue.length}`);
        if (!this.isProcessing) this.processNext();
    }

    /**
     * حساب الوقت المتبقي لانتهاء الطابور الحالي
     */
    getEstimatedTime() {
        const totalMinutes = this.queue.length * 5;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { hours, minutes, totalMinutes };
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            logger.info("Queue is empty. Sleeping...");
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();
        
        try {
            const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(task.mangaId);
            if (!manga) throw new Error(`Manga with ID ${task.mangaId} not found.`);

            logger.info(`[SCHEDULED] Processing Chapter ${task.number} of ${manga.title}...`);
            
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
            
            // 5. تنظيف الملفات المؤقتة فوراً
            this.processor.cleanup(processed.chapterDir);

            // 6. التحقق من الحاجة لإنشاء/تحديث منشور تجميعي
            await this.handleAggregation(task.mangaId);

            logger.info(`Successfully published Chapter ${task.number}. Waiting 5 minutes for next...`);
            
            // الجدولة الذكية: الانتظار 5 دقائق قبل الفصل التالي
            setTimeout(() => this.processNext(), this.delayBetweenChapters);

        } catch (error) {
            logger.error(`Error processing task: ${error.message}`);
            // في حالة الخطأ، انتظر دقيقة ثم حاول التالي
            setTimeout(() => this.processNext(), 60000);
        }
    }

    async handleAggregation(mangaId) {
        const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(mangaId);
        const publishedChapters = MemoryService.getPublishedChapters(mangaId);
        
        // تقسيم الفصول إلى مجموعات (كل 100 فصل في منشور تجميعي)
        const chunkSize = 100;
        for (let i = 0; i < publishedChapters.length; i += chunkSize) {
            const chunk = publishedChapters.slice(i, i + chunkSize);
            const partNumber = Math.floor(i / chunkSize) + 1;
            
            const startChapter = chunk[0].chapter_number;
            const endChapter = chunk[chunk.length - 1].chapter_number;
            
            const aggId = await FacebookPublisher.publishAggregation(
                { ...manga, partNumber, startChapter, endChapter }, 
                chunk
            );
            
            // حفظ الـ ID (يمكن تطوير هذا لحفظ مصفوفة من الـ IDs)
            if (partNumber === 1) {
                db.prepare('UPDATE manga SET aggregation_post_id = ? WHERE id = ?').run(aggId, mangaId);
            }
        }
    }
}

export const QueueSystem = new OkamiQueue();
