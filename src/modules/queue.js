import PQueue from 'p-queue';
import logger from '../utils/logger.js';

class QueueSystemClass {
    constructor() {
        this.messageQueue = new PQueue({
            concurrency: 2,
            intervalCap: 10,
            interval: 1000
        });
        this.consecutiveFailures = 0;
        this.FAILURE_THRESHOLD = 3;
        this.isPaused = false;
    }

    async addToQueue(task) {
        return this.messageQueue.add(async () => {
            try {
                logger.info(`Processing queued task for manga: ${task.mangaId}`);
                // هنا يتم تنفيذ المنطق الخاص بالمهمة
                // يمكن استدعاء Publisher أو Processor هنا
            } catch (error) {
                this.registerFailure();
                logger.error(`Queue task failed: ${error.message}`);
            }
        });
    }

    async addChapterToQueue(data) {
        return this.addToQueue(data);
    }

    async resumeQueue() {
        logger.info('Resuming persistent queue...');
        // يمكن إضافة منطق استعادة المهام من قاعدة البيانات هنا
        this.messageQueue.start();
    }

    registerSuccess() {
        this.consecutiveFailures = 0;
    }

    registerFailure() {
        this.consecutiveFailures++;
        logger.warn(`[Okami Queue] Consecutive failures: ${this.consecutiveFailures}/${this.FAILURE_THRESHOLD}`);

        if (this.consecutiveFailures >= this.FAILURE_THRESHOLD && !this.isPaused) {
            this.isPaused = true;
            logger.error(`[Okami Queue] CRITICAL: ${this.consecutiveFailures} consecutive failures! Pausing for 10s...`);
            
            this.messageQueue.pause();

            setTimeout(() => {
                logger.info('[Okami Queue] Cooldown complete. Resuming...');
                this.isPaused = false;
                this.consecutiveFailures = 0;
                this.messageQueue.start();
            }, 10000);
        }
    }
}

export const QueueSystem = new QueueSystemClass();
export const messageQueue = QueueSystem.messageQueue;
export const registerSuccess = () => QueueSystem.registerSuccess();
export const registerFailure = () => QueueSystem.registerFailure();

export default QueueSystem;
