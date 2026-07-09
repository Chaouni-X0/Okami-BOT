import { config } from '../config/config.js';
import db from '../database/db.js';
import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { FacebookPublisher } from '../modules/publisher.js';
import { MemoryService } from './memory.service.js';
import logger from '../utils/logger.js';

export class DialogueService {
    static userStates = new Map();

    static async handleMessage(fbId, text) {
        const state = this.userStates.get(fbId) || { step: 'START' };
        const cleanText = text.trim();

        if (cleanText.toLowerCase() === 'مرحبا' || cleanText.toLowerCase() === 'start') {
            this.userStates.set(fbId, { step: 'CHOOSING_MODE' });
            return "🐺 أهلاً بك في أوكامي بوت!\n\nمن فضلك اختر الوضع:\n1. وضع المستخدم 👤\n2. وضع المطور 🛠️";
        }

        switch (state.step) {
            case 'CHOOSING_MODE':
                if (cleanText === '1') {
                    this.userStates.set(fbId, { step: 'USER_MODE' });
                    return "👤 أنت الآن في وضع المستخدم. يمكنك طلب المانجا أو عرض ملفك الشخصي.";
                } else if (cleanText === '2') {
                    this.userStates.set(fbId, { step: 'AWAITING_PASSWORD' });
                    return "🛠️ وضع المطور يتطلب كلمة سر. من فضلك أدخل كلمة السر:";
                }
                break;

            case 'AWAITING_PASSWORD':
                if (cleanText === config.admin.password) {
                    this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                    return "✅ تم التحقق! أهلاً بك أيها المطور.\n\nأرسل كلمة 'مواقع' لعرض المواقع المدعومة.";
                } else {
                    return "❌ كلمة سر خاطئة. حاول مرة أخرى.";
                }

            case 'ADMIN_MODE':
                if (cleanText === 'مواقع') {
                    const sites = config.sources.map(s => `${s.name} (${s.id})`).join('\n');
                    this.userStates.set(fbId, { step: 'SELECTING_SITE' });
                    return `🌐 المواقع المدعومة:\n${sites}\n\nمن فضلك اختر (ID) الموقع:`;
                }
                break;

            case 'SELECTING_SITE':
                const source = config.sources.find(s => s.id === cleanText);
                if (source) {
                    this.userStates.set(fbId, { step: 'AWAITING_MANGA_NAME', sourceId: cleanText });
                    return `✅ اخترت ${source.name}. الآن أرسل اسم المانهوا بالإنجليزية (الاسم الصحيح للبحث):`;
                } else {
                    return "❌ موقع غير مدعوم.";
                }

            case 'AWAITING_MANGA_NAME':
                const mangaName = cleanText;
                const sourceId = state.sourceId;
                this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                
                this.startMangaExtraction(fbId, sourceId, mangaName);
                return `🔍 جاري معالجة "${mangaName}"... سأقوم بحساب الوقت المتوقع وإرساله لك فوراً.`;

            default:
                return "🐺 أرسل 'مرحبا' للبدء.";
        }
    }

    static async startMangaExtraction(fbId, sourceId, mangaName) {
        try {
            const results = await scraperEngine.search(sourceId, mangaName);
            if (!results.length) {
                await FacebookPublisher.sendDirectMessage(fbId, `❌ لم أجد مانهوا باسم "${mangaName}" في هذا الموقع.`);
                return;
            }

            const manga = results[0];
            const details = await scraperEngine.getMangaDetails(sourceId, manga.url);
            
            const savedManga = await MemoryService.saveManga({
                title: details.title,
                slug: mangaName.toLowerCase().replace(/ /g, '-'),
                coverUrl: details.coverUrl,
                description: details.description,
                status: details.status,
                sourceSite: sourceId,
                sourceUrl: manga.url
            });
            const mangaId = savedManga._id || savedManga.id;

            // حساب الوقت المتوقع
            const chapterCount = details.chapters.length;
            const totalMinutes = chapterCount * 5;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${minutes} دقيقة`;

            await FacebookPublisher.sendDirectMessage(fbId, 
                `✅ تم العثور على "${details.title}".\n` +
                `🔢 عدد الفصول: ${chapterCount}\n` +
                `⏳ الوقت المتوقع للنشر: ${timeText} (بمعدل فصل كل 5 دقائق).\n\n` +
                `🚀 بدأ النشر الآن...`
            );

            // إضافة الفصول للطابور
            for (const ch of details.chapters) {
                await QueueSystem.addToQueue({
                    mangaId,
                    number: ch.number,
                    chapterUrl: ch.url,
                    sourceKey: sourceId,
                    adminFbId: fbId
                });
            }

        } catch (error) {
            logger.error(`Extraction Error: ${error.message}`);
            await FacebookPublisher.sendDirectMessage(fbId, `❌ حدث خطأ أثناء معالجة المانهوا: ${error.message}`);
        }
    }
}
