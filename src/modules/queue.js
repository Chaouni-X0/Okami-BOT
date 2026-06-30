import { MemoryService } from '../services/memory.service.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import logger from '../utils/logger.js';
import db from '../database/db.js';
import { Manga } from '../database/mongo.js';

export class OkamiQueue {
    constructor() {
        this.processor = new ChapterProcessor();
        this.isProcessing = false;
        this.delayBetweenChapters = 5 * 60 * 1000; // 5 minutes
        this.retryDelay = 60 * 1000; // 1 minute
    }

    /**
     * Adds a new publishing job to the persistent SQLite queue.
     */
    async addToQueue(job) {
        try {
            const stmt = db.prepare(`
                INSERT INTO publish_queue (manga_id, chapter_number, chapter_url, source_key, admin_fb_id, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `);
            stmt.run(job.mangaId, job.number, job.chapterUrl, job.sourceKey, job.adminFbId);
            
            logger.info(`[Queue] Added Chapter ${job.number} of ${job.mangaId} to queue.`);
            
            if (!this.isProcessing) {
                this.processNext();
            }
        } catch (error) {
            logger.error(`[Queue] Failed to add job to SQLite: ${error.message}`);
        }
    }

    /**
     * Resumes any pending tasks from the database (e.g., after a crash or restart).
     */
    async resumeQueue() {
        try {
            const pending = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending' OR status = 'processing'").get();
            if (pending && pending.count > 0) {
                logger.info(`[Queue] Resuming queue with ${pending.count} tasks...`);
                // Reset 'processing' tasks back to 'pending' to ensure they are retried
                db.prepare("UPDATE publish_queue SET status = 'pending' WHERE status = 'processing'").run();
                this.processNext();
            }
        } catch (error) {
            logger.error(`[Queue] Resume failed: ${error.message}`);
        }
    }

    /**
     * Main processing loop. Fetches one task at a time.
     */
    async processNext() {
        if (this.isProcessing) return;

        const task = db.prepare("SELECT * FROM publish_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1").get();
        
        if (!task) {
            this.isProcessing = false;
            logger.info("[Queue] All tasks completed. System idle.");
            return;
        }

        this.isProcessing = true;
        let processedData = null;
        
        try {
            logger.info(`[Queue] Processing Task ID ${task.id}: Chapter ${task.chapter_number} of ${task.manga_id}`);
            db.prepare("UPDATE publish_queue SET status = 'processing' WHERE id = ?").run(task.id);
            
            // 1. Get Manga Metadata from MongoDB
            const manga = await Manga.findOne({ slug: task.manga_id });
            if (!manga) throw new Error(`Manga metadata for "${task.manga_id}" not found in MongoDB.`);

            // 2. Extract Images
            const images = await scraperEngine.parseChapterImages(task.source_key, task.chapter_url);
            if (!images || images.length === 0) throw new Error(`Scraper failed to find images for chapter ${task.chapter_number}.`);

            // 3. Process Images (Slicing/Optimization)
            processedData = await this.processor.processChapter(manga.slug, task.chapter_number, images);
            
            // 4. Publish to Facebook
            const postText = `🐺 فصل جديد من: ${manga.title}\n🔢 رقم الفصل: ${task.chapter_number}\n📖 استمتعوا بالقراءة!\n#OkamiBot #Manga #Manhwa`;
            const postId = await FacebookPublisher.publishChapter(processedData.images, postText);
            
            // 5. Update Memory/Database
            MemoryService.markChapterAsPublished(task.manga_id, task.chapter_number, postId);
            db.prepare("DELETE FROM publish_queue WHERE id = ?").run(task.id);
            
            logger.info(`[Queue] Success: Published Chapter ${task.chapter_number} for ${manga.title}. Post ID: ${postId}`);

            // 6. Handle Aggregation Post Update
            await this.handleAggregation(manga);

            // Move to next task after delay
            this.isProcessing = false;
            setTimeout(() => this.processNext(), this.delayBetweenChapters);

        } catch (error) {
            logger.error(`[Queue Error] Task ${task.id} failed: ${error.message}`);
            
            // Mark as failed and move to next (or retry later)
            db.prepare("UPDATE publish_queue SET status = 'failed' WHERE id = ?").run(task.id);
            
            this.isProcessing = false;
            // Retry after a shorter delay if it failed
            setTimeout(() => this.processNext(), this.retryDelay);
        } finally {
            // Bulletproof Cleanup: Always delete temp images
            if (processedData && processedData.chapterDir) {
                this.processor.cleanup(processedData.chapterDir);
            }
        }
    }

    /**
     * Updates or creates an aggregation post linking all published chapters.
     */
    async handleAggregation(manga) {
        try {
            const publishedChapters = MemoryService.getPublishedChapters(manga.slug);
            if (!publishedChapters || publishedChapters.length === 0) return;

            const chunkSize = 100;
            for (let i = 0; i < publishedChapters.length; i += chunkSize) {
                const chunk = publishedChapters.slice(i, i + chunkSize);
                const partNumber = Math.floor(i / chunkSize) + 1;
                
                await FacebookPublisher.publishAggregation({ 
                    title: manga.title,
                    status: manga.status,
                    partNumber, 
                    startChapter: chunk[0].chapter_number, 
                    endChapter: chunk[chunk.length-1].chapter_number 
                }, chunk);
            }
        } catch (error) {
            logger.error(`[Queue] Aggregation update failed: ${error.message}`);
        }
    }
}

export const QueueSystem = new OkamiQueue();
