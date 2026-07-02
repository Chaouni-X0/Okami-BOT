import PQueue from 'p-queue';
import logger from '../utils/logger.js';
import scraperEngine from './scraper.js';
import { FacebookPublisher } from './publisher.js';
import { sendMessage } from '../services/messenger.js';
import fs from 'fs';
import path from 'path';

class QueueSystemClass {
    constructor() {
        this.messageQueue = new PQueue({
            concurrency: 1,
            intervalCap: 1,
            interval: 5000
        });
        this.consecutiveFailures = 0;
        this.FAILURE_THRESHOLD = 3;
        this.isPaused = false;
    }

    async addChapterToQueue(task) {
        return this.messageQueue.add(async () => {
            try {
                logger.info(`[Queue] Processing with Python Engine: ${task.mangaTitle} - ${task.chapterName}`);
                
                // 1. Get and Process Images via Python Bridge
                const processedImages = await scraperEngine.parseChapterImages(
                    task.sourceKey, 
                    task.chapterUrl,
                    task.mangaTitle,
                    task.chapterName
                );

                if (!processedImages || processedImages.length === 0) {
                    throw new Error("فشل محرك Python في جلب أو معالجة الصور لهذا الفصل.");
                }

                logger.info(`[Queue] Python Engine returned ${processedImages.length} processed parts.`);

                // 2. Publish to Facebook
                const postId = await FacebookPublisher.publishChapter(processedImages, task.customMessage);

                // 3. Notify Admin
                if (task.adminFbId) {
                    await sendMessage(task.adminFbId, {
                        text: `✅ تم بنجاح نشر "${task.mangaTitle} - ${task.chapterName}"\n🔗 رابط المنشور: https://facebook.com/${postId}`
                    });
                }

                // 4. Cleanup (Python engine handles temp files, but we can double check)
                this.registerSuccess();
                
            } catch (error) {
                this.registerFailure();
                logger.error(`[Queue] Task failed: ${error.message}`);
                if (task.adminFbId) {
                    await sendMessage(task.adminFbId, {
                        text: `❌ فشل نشر "${task.mangaTitle} - ${task.chapterName}"\nالسبب: ${error.message}`
                    });
                }
            }
        });
    }

    registerSuccess() {
        this.consecutiveFailures = 0;
    }

    registerFailure() {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.FAILURE_THRESHOLD && !this.isPaused) {
            this.isPaused = true;
            logger.error(`[Queue] CRITICAL: Pausing for 60s...`);
            this.messageQueue.pause();
            setTimeout(() => {
                this.isPaused = false;
                this.consecutiveFailures = 0;
                this.messageQueue.start();
            }, 60000);
        }
    }
}

export const QueueSystem = new QueueSystemClass();
export default QueueSystem;
