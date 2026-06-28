import { MemoryService } from '../services/memory.service.js';
import { ScraperEngine } from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';

export class OkamiQueue {
    constructor() {
        this.scraper = new ScraperEngine();
        this.processor = new ChapterProcessor();
        this.publisher = new FacebookPublisher();
        this.isProcessing = false;
        this.queue = [];
    }

    async addToQueue(mangaId, chapterData) {
        this.queue.push({ mangaId, ...chapterData });
        console.log(`Added Chapter ${chapterData.number} to queue.`);
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
            console.log(`Processing Chapter ${task.number}...`);
            
            // 1. استخراج صور الفصل
            const images = await this.scraper.parseChapterImages(task.url);
            
            // 2. معالجة الصور
            const manga = await this.getMangaById(task.mangaId);
            const processed = await this.processor.processChapter(manga.slug, task.number, images);
            
            // 3. النشر على فيسبوك
            const postId = await this.publisher.publishChapter(manga.title, task.number, processed.images);
            
            // 4. تحديث قاعدة البيانات
            MemoryService.markChapterAsPublished(task.mangaId, task.number, postId);
            
            // 5. تنظيف الملفات المؤقتة وحذف الصور لتوفير المساحة (Resource Management)
            this.processor.cleanup(processed.chapterDir);

            // 6. إرسال إشعارات للمتابعين
            const postUrl = `https://facebook.com/${postId}`;
            import { NotificationService } from '../services/notification.service.js';
            await NotificationService.notifyFollowers(task.mangaId, task.number, postUrl);

            // 7. إرسال تنبيه للمطور إذا كان هو من بدأ العملية
            if (task.adminFbId) {
                console.log(`[ADMIN NOTIFY] User ${task.adminFbId}: Done publishing ${manga.title}. Temporary data deleted.`);
            }

            console.log(`Successfully published Chapter ${task.number} of ${manga.title} and cleaned up files.`);
            
            // تأخير عشوائي لتجنب الحظر (Anti-Ban)
            const delay = Math.floor(Math.random() * (300000 - 60000) + 60000); // 1-5 minutes
            setTimeout(() => this.processNext(), delay);

        } catch (error) {
            console.error(`Error processing task:`, error.message);
            // إعادة المحاولة بعد فترة
            setTimeout(() => this.processNext(), 60000);
        }
    }

    // دالة مساعدة
    async getMangaById(id) {
        import db from '../database/db.js';
        return db.prepare('SELECT * FROM manga WHERE id = ?').get(id);
    }
}
