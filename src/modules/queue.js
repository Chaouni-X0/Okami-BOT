import { MemoryService } from '../services/memory.service.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import logger from '../utils/logger.js';
import db from '../database/db.js';

export class OkamiQueue {
    constructor() {
        this.processor = new ChapterProcessor();
        this.isProcessing = false;
        this.delayBetweenChapters = 5 * 60 * 1000; // 5 دقائق
    }

    /**
     * إضافة مهمة للطابور في قاعدة البيانات
     */
    async addToQueue(job) {
        db.prepare(`
            INSERT INTO publish_queue (manga_id, chapter_number, chapter_url, source_key, admin_fb_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(job.mangaId, job.number, job.chapterUrl, job.sourceKey, job.adminFbId);
        
        logger.info(`Chapter ${job.number} added to persistent queue.`);
        if (!this.isProcessing) this.processNext();
    }

    /**
     * استئناف النشر عند تشغيل البوت
     */
    async resumeQueue() {
        const pendingCount = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending'").get().count;
        if (pendingCount > 0) {
            logger.info(`Resuming queue with ${pendingCount} pending chapters...`);
            this.processNext();
        }
    }

    async processNext() {
        // البحث عن أول مهمة منتظرة
        const task = db.prepare("SELECT * FROM publish_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1").get();
        
        if (!task) {
            this.isProcessing = false;
            logger.info("No more pending tasks in queue.");
            return;
        }

        this.isProcessing = true;
        
        try {
            // تحديث حالة المهمة إلى "قيد المعالجة"
            db.prepare("UPDATE publish_queue SET status = 'processing' WHERE id = ?").run(task.id);

            const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(task.manga_id);
            if (!manga) throw new Error(`Manga with ID ${task.manga_id} not found.`);

            logger.info(`[PERSISTENT] Processing Chapter ${task.chapter_number} of ${manga.title}...`);
            
            const images = await scraperEngine.parseChapterImages(task.source_key, task.chapter_url);
            if (!images || images.length === 0) throw new Error(`No images found for chapter ${task.chapter_number}`);
            
            const processed = await this.processor.processChapter(manga.slug, task.chapter_number, images);
            
            const postText = `
🐺 فصل جديد من: ${manga.title}
🔢 رقم الفصل: ${task.chapter_number}
📖 استمتعوا بالقراءة!

#OkamiBot #Manga #Manhwa
            `;
            const postId = await FacebookPublisher.publishChapter(processed.images, postText);
            
            MemoryService.markChapterAsPublished(task.manga_id, task.chapter_number, postId);
            this.processor.cleanup(processed.chapterDir);

            // تحديث حالة المهمة إلى "مكتملة" (أو حذفها لتوفير مساحة)
            db.prepare("DELETE FROM publish_queue WHERE id = ?").run(task.id);

            // تحديث المنشور التجميعي
            await this.handleAggregation(task.manga_id);

            logger.info(`Successfully published Chapter ${task.chapter_number}. Waiting 5 minutes...`);
            setTimeout(() => this.processNext(), this.delayBetweenChapters);

        } catch (error) {
            logger.error(`Error in persistent queue: ${error.message}`);
            db.prepare("UPDATE publish_queue SET status = 'failed' WHERE id = ?").run(task.id);
            // محاولة المهمة التالية بعد دقيقة
            setTimeout(() => this.processNext(), 60000);
        }
    }

    async handleAggregation(mangaId) {
        const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(mangaId);
        const publishedChapters = MemoryService.getPublishedChapters(mangaId);
        
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
            
            if (partNumber === 1) {
                db.prepare('UPDATE manga SET aggregation_post_id = ? WHERE id = ?').run(aggId, mangaId);
            }
        }
    }
}

export const QueueSystem = new OkamiQueue();
