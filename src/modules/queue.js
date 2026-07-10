import PQueue from 'p-queue';
import logger from '../utils/logger.js';
import scraperEngine from './scraper.js';
import { ChapterProcessor } from './processor.js';
import { FacebookPublisher } from './publisher.js';
import { MemoryService } from '../services/memory.service.js';
import { sendMessage } from '../services/messenger.js';
import { config } from '../config/config.js';
import db from '../database/db.js';

// Number of chapters downloaded, published, and deleted together before
// moving on to the next group. Keeping this small (2) is what limits how
// much disk space the bot ever uses at once for a single manga run.
const PUBLISH_BATCH_SIZE = 2;
// Pause between batches so we don't hammer Facebook's API or the source site.
const BATCH_DELAY_MS = 4000;

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
        this.processor = new ChapterProcessor();
        // Tracks manga slugs currently being auto-published, so a duplicate
        // "confirm" can't start a second parallel run on the same title,
        // and so admins can ask "ما هو الوضع؟" style status/cancel commands.
        this.activeJobs = new Map(); // mangaSlug -> { cancelled: boolean, mangaTitle }
    }

    isJobActive(mangaSlug) {
        return this.activeJobs.has(mangaSlug);
    }

    cancelJob(mangaSlug) {
        const job = this.activeJobs.get(mangaSlug);
        if (job) {
            job.cancelled = true;
            return true;
        }
        return false;
    }

    async _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Downloads, splits (for Facebook's height/quality constraints), publishes,
     * and cleans up ALL chapters of a manga, two at a time, so at most
     * PUBLISH_BATCH_SIZE chapters worth of images ever sit on disk together.
     */
    async startMangaPublishing({ mangaId, mangaTitle, mangaSlug, chapters, sourceId, adminFbId, baseMessage }) {
        if (this.isJobActive(mangaSlug)) {
            await sendMessage(adminFbId, { text: `⚠️ يوجد بالفعل عملية نشر جارية لـ "${mangaTitle}".` });
            return;
        }

        const job = { cancelled: false, mangaTitle };
        this.activeJobs.set(mangaSlug, job);

        try {
            // Skip chapters already published previously, so re-confirming
            // the same manga doesn't repost old chapters.
            const alreadyPublished = new Set(
                (await MemoryService.getPublishedChapters(mangaId)).map(c => c.chapter_number)
            );
            const pending = chapters.filter(ch => !alreadyPublished.has(ch.number));

            if (pending.length === 0) {
                await sendMessage(adminFbId, { text: `ℹ️ كل فصول "${mangaTitle}" منشورة مسبقاً.` });
                return;
            }

            await sendMessage(adminFbId, {
                text: `🚀 بدأ النشر التلقائي لـ "${mangaTitle}"\n📦 سيتم تنزيل ونشر الفصول على دفعات من ${PUBLISH_BATCH_SIZE} لتفادي أي مشاكل تخزين.\n🔢 عدد الفصول المتبقية: ${pending.length}`
            });

            for (let i = 0; i < pending.length; i += PUBLISH_BATCH_SIZE) {
                if (job.cancelled) {
                    await sendMessage(adminFbId, { text: `🛑 تم إلغاء نشر "${mangaTitle}" بعد نشر ${i} فصل.` });
                    break;
                }

                const batch = pending.slice(i, i + PUBLISH_BATCH_SIZE);

                // Process each chapter sequentially and clean up immediately to keep peak disk space at its absolute minimum.
                for (const ch of batch) {
                    let chapterDir = null;
                    let images = null;
                    try {
                        const imageUrls = await scraperEngine.parseChapterImages(sourceId, ch.url);
                        if (!imageUrls || imageUrls.length === 0) {
                            throw new Error('لم يتم العثور على صور لهذا الفصل.');
                        }
                        
                        const processed = await this.processor.processChapter(mangaSlug, ch.number, imageUrls);
                        chapterDir = processed.chapterDir;
                        images = processed.images;
                        
                        if (!images || images.length === 0) {
                            throw new Error('فشلت معالجة/تقسيم صور الفصل.');
                        }

                        const message = baseMessage
                            ? baseMessage.replace('{chapter}', ch.name)
                            : `📖 ${mangaTitle}\n📌 الفصل: ${ch.name}`;
                            
                        const postId = await FacebookPublisher.publishChapter(images, message);
                        await MemoryService.markChapterAsPublished(mangaId, ch.number, postId);
                        
                        await sendMessage(adminFbId, {
                            text: `✅ تم نشر "${mangaTitle} - ${ch.name}"\n🔗 https://facebook.com/${postId}`
                        });
                        this.registerSuccess();
                    } catch (err) {
                        this.registerFailure();
                        logger.error(`[Queue] Process/Publish failed for ${mangaTitle} ${ch.name}: ${err.message}`);
                        await sendMessage(adminFbId, { text: `❌ فشل نشر "${mangaTitle} - ${ch.name}"\nالسبب: ${err.message}` });
                    } finally {
                        // Cleanup immediately
                        if (chapterDir) {
                            this.processor.cleanup(chapterDir);
                        }
                    }
                }

                // Respect a global pause if too many consecutive failures happened.
                while (this.isPaused) {
                    await this._sleep(2000);
                }

                if (i + PUBLISH_BATCH_SIZE < pending.length) {
                    await this._sleep(BATCH_DELAY_MS);
                }
            }

            if (!job.cancelled) {
                await sendMessage(adminFbId, { text: `🎉 انتهى نشر جميع فصول "${mangaTitle}".` });
                // Generate and publish the compilation post!
                await this.createMangaCompilationPost(mangaId, adminFbId);
            }
        } catch (error) {
            logger.error(`[Queue] startMangaPublishing fatal error: ${error.message}`);
            await sendMessage(adminFbId, { text: `❌ توقفت عملية نشر "${mangaTitle}" بسبب خطأ غير متوقع: ${error.message}` });
        } finally {
            this.activeJobs.delete(mangaSlug);
        }
    }

    /**
     * Creates a beautiful, unified compilation post for the manga
     * containing details, site, cover image, and direct Facebook links to all chapters!
     */
    async createMangaCompilationPost(mangaId, adminFbId) {
        try {
            logger.info(`[Queue] Creating manga compilation post for mangaId: ${mangaId}`);
            const manga = await MemoryService.getMangaById(mangaId);
            if (!manga) {
                throw new Error('لم يتم العثور على المانهوا في قاعدة البيانات.');
            }

            const chapters = await MemoryService.getPublishedChapters(mangaId);
            if (!chapters || chapters.length === 0) {
                throw new Error('لا توجد فصول منشورة لهذه المانهوا لإنشاء تجميعة.');
            }

            // Build the compilation text message
            let compilationMsg = `📚 【 تجميعة الفصول الكاملة 】 📚\n\n`;
            compilationMsg += `📖 اسم العمل: ${manga.title}\n`;
            if (manga.description) {
                compilationMsg += `📝 نبذة عن القصة:\n${manga.description}\n\n`;
            }
            
            const source = config.sources.find(s => s.id === manga.source_site_key);
            const sourceName = source ? source.name : manga.source_site_key;
            compilationMsg += `🌐 الموقع المصدر: ${sourceName}\n`;
            compilationMsg += `🔗 رابط المصدر: ${manga.source_url}\n\n`;
            compilationMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            compilationMsg += `👇 روابط الفصول المنشورة على صفحتنا:\n\n`;

            chapters.forEach((ch) => {
                compilationMsg += `🔹 الفصل ${ch.chapter_number}: https://facebook.com/${ch.fb_post_id}\n`;
            });

            compilationMsg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
            compilationMsg += `🐺 نتمنى لكم قراءة ممتعة! لا تنسوا مشاركة المنشور والتفاعل لمساعدتنا على الاستمرار. ❤️`;

            // Publish to Facebook with cover image if available
            const coverUrl = manga.cover_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400';
            
            const compilationPostId = await FacebookPublisher.publishCustomPost(compilationMsg, coverUrl);
            
            // Save the compilation post ID to the manga record
            await MemoryService.updateMangaCompilationPost(mangaId, compilationPostId);

            // Notify admin
            if (adminFbId) {
                await sendMessage(adminFbId, {
                    text: `📋 تم بنجاح إنشاء المنشور التجميعي للفصول مضافاً إليه صورة الغلاف!\n🔗 رابط المنشور التجميعي على فيسبوك: https://facebook.com/${compilationPostId}`
                });
            }

            // After creating a manga compilation post, trigger updating the Master compilation post
            await this.updateMasterCompilationPost(adminFbId);

        } catch (error) {
            logger.error(`[Queue] Failed to create manga compilation post: ${error.message}`);
            if (adminFbId) {
                await sendMessage(adminFbId, {
                    text: `⚠️ لم نتمكن من إنشاء منشور التجميعة التلقائي للفصول.\nالسبب: ${error.message}`
                });
            }
        }
    }

    /**
     * Creates/updates a master compilation post containing a directory
     * of all mangas published on the bot with links to their respective chapter compilation posts.
     */
    async updateMasterCompilationPost(adminFbId) {
        try {
            logger.info(`[Queue] Generating master manga directory compilation post...`);
            
            // Fetch all mangas that have a compilation_post_id
            let allMangas = [];
            try {
                const { Manga: MongooseManga } = await import('../database/mongodb.js');
                allMangas = await MongooseManga.find({ compilation_post_id: { $exists: true, $ne: null } }).sort({ updated_at: -1 });
            } catch (error) {
                allMangas = db.data.manga.filter(m => m.compilation_post_id);
            }

            if (!allMangas || allMangas.length === 0) {
                logger.info(`[Queue] No mangas with compilation posts found to include in master compilation.`);
                return;
            }

            let masterMsg = `🌟 【 الفهرس الشامل لجميع المانهوات المكتملة والمنشورة 】 🌟\n\n`;
            masterMsg += `قائمة متكاملة بجميع الأعمال والمانهوات التي قمنا بنشر فصولها وتجميعاتها حتى الآن عبر البوت التلقائي:\n\n`;

            allMangas.forEach((manga, idx) => {
                const source = config.sources.find(s => s.id === manga.source_site_key);
                const sourceName = source ? source.name : manga.source_site_key;
                
                masterMsg += `${idx + 1}️⃣ ❪ ${manga.title} ❫\n`;
                masterMsg += `🌐 المصدر: ${sourceName}\n`;
                masterMsg += `🔗 رابط التجميعة الكاملة للفصول: https://facebook.com/${manga.compilation_post_id}\n\n`;
            });

            masterMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            masterMsg += `💡 سيتم تحديث هذا الفهرس وتنزيل أعمال ممتعة وجديدة باستمرار! شاركوا الصفحة لمساندتنا 🐺🔥`;

            // We can publish this master post.
            // Use cover image of the latest completed manga as banner
            const bannerUrl = allMangas[0].cover_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400';
            
            const masterPostId = await FacebookPublisher.publishCustomPost(masterMsg, bannerUrl);

            // Notify admin
            if (adminFbId) {
                await sendMessage(adminFbId, {
                    text: `🗂️ تم إنشاء المنشور التجميعي العام لجميع المانهوات بنجاح!\n🔗 رابط منشور الفهرس الشامل على فيسبوك: https://facebook.com/${masterPostId}`
                });
            }

        } catch (error) {
            logger.error(`[Queue] Failed to generate master directory compilation post: ${error.message}`);
            if (adminFbId) {
                await sendMessage(adminFbId, {
                    text: `⚠️ لم نتمكن من إنشاء منشور الفهرس الشامل للمانهوات.\nالسبب: ${error.message}`
                });
            }
        }
    }

    /**
     * Publish a single, specific chapter on demand (kept for manual/one-off use).
     */
    async addChapterToQueue(task) {
        return this.messageQueue.add(async () => {
            try {
                logger.info(`[Queue] Processing single chapter: ${task.mangaTitle} - ${task.chapterName}`);

                const imageUrls = await scraperEngine.parseChapterImages(task.sourceKey, task.chapterUrl);
                if (!imageUrls || imageUrls.length === 0) {
                    throw new Error("لم يتم العثور على صور لهذا الفصل.");
                }

                const mangaSlug = (task.mangaTitle || 'manga').toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const { chapterDir, images } = await this.processor.processChapter(mangaSlug, task.chapterNumber || 0, imageUrls);
                if (!images || images.length === 0) {
                    throw new Error("فشلت معالجة/تقسيم صور الفصل.");
                }

                const postId = await FacebookPublisher.publishChapter(images, task.customMessage);

                if (task.mangaId && task.chapterNumber) {
                    await MemoryService.markChapterAsPublished(task.mangaId, task.chapterNumber, postId);
                    // Automatically generate/update compilation posts in the background!
                    try {
                        await this.createMangaCompilationPost(task.mangaId, task.adminFbId);
                    } catch (compErr) {
                        logger.error(`[Queue] Auto-compilation failed: ${compErr.message}`);
                    }
                }

                if (task.adminFbId) {
                    await sendMessage(task.adminFbId, {
                        text: `✅ تم بنجاح نشر "${task.mangaTitle} - ${task.chapterName}"\n🔗 رابط المنشور: https://facebook.com/${postId}`
                    });
                }

                this.processor.cleanup(chapterDir);
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
