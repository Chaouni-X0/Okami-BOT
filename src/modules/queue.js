import PQueue from 'p-queue';
import logger from '../utils/logger.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import { sendMessage } from '../services/messenger.js';

const processor = new ChapterProcessor();

class QueueSystemClass {
    constructor() {
        this.messageQueue = new PQueue({
            concurrency: 1, // Facebook API can be sensitive to concurrency
            intervalCap: 1,
            interval: 5000 // 5 seconds between jobs to avoid rate limits
        });
        this.consecutiveFailures = 0;
        this.FAILURE_THRESHOLD = 3;
        this.isPaused = false;
    }

    async addChapterToQueue(task) {
        return this.messageQueue.add(async () => {
            try {
                logger.info(`[Queue] Processing: ${task.mangaTitle} - ${task.chapterName}`);
                
                // 1. Get Chapter Images
                logger.info(`[Queue] Fetching images for: ${task.chapterUrl}`);
                const images = await scraperEngine.parseChapterImages(task.sourceKey, task.chapterUrl);
                if (!images || images.length === 0) {
                    throw new Error("لم يتم العثور على صور في هذا الفصل. قد يكون الموقع محمي بـ Cloudflare أو يتطلب Scraping متطور.");
                }
                logger.info(`[Queue] Found ${images.length} images. Starting download and processing...`);

                // 2. Process/Slice Images
                const { chapterDir, images: processedImages } = await processor.processChapter(
                    task.mangaTitle.replace(/[^\w\u0600-\u06FF]+/g, '-').toLowerCase(),
                    task.chapterName.match(/\d+/)?.[0] || '0',
                    images
                );
                
                if (!processedImages || processedImages.length === 0) {
                    throw new Error("فشل تحميل أو معالجة الصور. يرجى التحقق من اتصال الخادم بالموقع.");
                }
                logger.info(`[Queue] Successfully processed ${processedImages.length} image parts.`);

                // 3. Publish to Facebook
                const postId = await FacebookPublisher.publishChapter(processedImages, task.customMessage);

                // 4. Notify Admin
                if (task.adminFbId) {
                    await sendMessage(task.adminFbId, {
                        text: `✅ تم بنجاح نشر "${task.mangaTitle} - ${task.chapterName}"\n🔗 رابط المنشور: https://facebook.com/${postId}`
                    });
                }

                // 5. Cleanup
                processor.cleanup(chapterDir);
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
        logger.warn(`[Queue] Consecutive failures: ${this.consecutiveFailures}/${this.FAILURE_THRESHOLD}`);

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
