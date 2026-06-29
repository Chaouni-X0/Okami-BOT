import { MemoryService } from '../services/memory.service.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import logger from '../utils/logger.js';
import db from '../database/db.js';
import { Manga } from '../database/mongo.js'; // REPAIRED: Moved to top-level

export class OkamiQueue {
    constructor() {
        this.processor = new ChapterProcessor();
        this.isProcessing = false;
        this.delayBetweenChapters = 5 * 60 * 1000; // 5 دقائق
        this.batchSize = 5; // معالجة وحذف كل 5 فصول
    }

    async addToQueue(job) {
        db.prepare(`
            INSERT INTO publish_queue (manga_id, chapter_number, chapter_url, source_key, admin_fb_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(job.mangaId, job.number, job.chapterUrl, job.sourceKey, job.adminFbId);
        
        if (!this.isProcessing) this.processNext();
    }

    async resumeQueue() {
        const pendingCount = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending'").get().count;
        if (pendingCount > 0) {
            logger.info(`Resuming queue with ${pendingCount} pending chapters...`);
            this.processNext();
        }
    }

    async processNext() {
        const task = db.prepare("SELECT * FROM publish_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1").get();
        
        if (!task) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        
        let processed;
        try {
            db.prepare("UPDATE publish_queue SET status = 'processing' WHERE id = ?").run(task.id);
            
            // Get manga metadata from MongoDB
            const manga = await Manga.findOne({ slug: task.manga_id });
            if (!manga) throw new Error(`Manga with slug ${task.manga_id} not found in MongoDB`);

            // 1. استخراج ومعالجة ونشر الفصل
            const images = await scraperEngine.parseChapterImages(task.source_key, task.chapter_url);
            if (!images || images.length === 0) throw new Error(`No images found for chapter ${task.chapter_number}`);

            processed = await this.processor.processChapter(manga.slug, task.chapter_number, images);
            
            const postText = `🐺 فصل جديد من: ${manga.title}\n🔢 رقم الفصل: ${task.chapter_number}\n📖 استمتعوا بالقراءة!\n#OkamiBot`;
            const postId = await FacebookPublisher.publishChapter(processed.images, postText);
            
            MemoryService.markChapterAsPublished(task.manga_id, task.chapter_number, postId);

            db.prepare("DELETE FROM publish_queue WHERE id = ?").run(task.id);
            
            await this.handleAggregation({
                title: manga.title,
                status: manga.status,
                slug: manga.slug
            });

            logger.info(`[Queue] Successfully published Chapter ${task.chapter_number} for ${manga.title}`);
            setTimeout(() => this.processNext(), this.delayBetweenChapters);

        } catch (error) {
            logger.error(`[Queue Error] Task ${task?.id}: ${error.message}`);
            db.prepare("UPDATE publish_queue SET status = 'failed' WHERE id = ?").run(task.id);
            setTimeout(() => this.processNext(), 60000);
        } finally {
            // Bulletproof Cleanup
            if (processed && processed.chapterDir) {
                this.processor.cleanup(processed.chapterDir);
            }
        }
            logger.error(`Error processing task ${task?.id}: ${error.message}`);
            db.prepare("UPDATE publish_queue SET status = 'failed' WHERE id = ?").run(task.id);
            setTimeout(() => this.processNext(), 60000);
        }
    }

    async handleAggregation(mangaData) {
        const publishedChapters = MemoryService.getPublishedChapters(mangaData.slug);
        const chunkSize = 100;
        
        for (let i = 0; i < publishedChapters.length; i += chunkSize) {
            const chunk = publishedChapters.slice(i, i + chunkSize);
            const partNumber = Math.floor(i / chunkSize) + 1;
            await FacebookPublisher.publishAggregation({ 
                title: mangaData.title,
                status: mangaData.status,
                partNumber, 
                startChapter: chunk[0].chapter_number, 
                endChapter: chunk[chunk.length-1].chapter_number 
            }, chunk);
        }
    }
}

export const QueueSystem = new OkamiQueue();
