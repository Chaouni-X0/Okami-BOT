import { config } from '../config/config.js';
import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { FacebookPublisher } from '../modules/publisher.js';
import { MemoryService } from './memory.service.js';
import logger from '../utils/logger.js';

export class DialogueService {
    static userStates = new Map();

    static async handleMessage(fbId, text) {
        const cleanText = text.trim().toLowerCase();
        const state = this.userStates.get(fbId) || { step: 'START' };

        logger.info(`[Dialogue] Message from ${fbId}: "${cleanText}" (State: ${state.step})`);

        // --- Global Commands (Work anytime) ---
        if (['ابدأ', 'start', 'مرحبا', 'hi', 'hello', 'menu', 'القائمة'].includes(cleanText)) {
            this.userStates.set(fbId, { step: 'CHOOSING_MODE' });
            return "🐺 أهلاً بك في أوكامي بوت (Okami Bot)!\n\nأنا هنا لمساعدتك في متابعة ونشر المانهوا المفضلة لديك.\n\nمن فضلك اختر الوضع:\n1️⃣ وضع المستخدم (للمتابعة والاستعلام)\n2️⃣ وضع المطور (لإضافة ونشر المانهوا)";
        }

        // --- Direct Activation Command (As seen in user screenshot) ---
        if (cleanText.startsWith('تفعيل') || cleanText.startsWith('activate')) {
            const password = cleanText.replace(/تفعيل|activate|[\[\]]/g, '').trim();
            if (password === config.admin.password || password === config.admin.activationKey) {
                this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                return "✅ تم التفعيل بنجاح! أهلاً بك أيها المطور.\n\nيمكنك الآن التحكم في البوت. أرسل كلمة 'مواقع' لعرض المصادر المدعومة أو 'بحث [اسم]' للبحث عن مانهوا.";
            } else {
                return "❌ رمز التفعيل أو كلمة السر غير صحيحة.";
            }
        }

        // --- State Machine ---
        switch (state.step) {
            case 'CHOOSING_MODE':
                if (cleanText === '1' || cleanText.includes('مستخدم')) {
                    this.userStates.set(fbId, { step: 'USER_MODE' });
                    return "👤 أنت الآن في وضع المستخدم.\n\nقريباً: ستتمكن من الاشتراك في المانهوا لتلقي تنبيهات عند صدور فصول جديدة!";
                } else if (cleanText === '2' || cleanText.includes('مطور')) {
                    this.userStates.set(fbId, { step: 'AWAITING_PASSWORD' });
                    return "🛠️ وضع المطور يتطلب كلمة السر الخاصة بك.\n\nمن فضلك أدخل كلمة السر:";
                }
                break;

            case 'AWAITING_PASSWORD':
                if (cleanText === config.admin.password || cleanText === config.admin.activationKey) {
                    this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                    return "✅ تم التحقق بنجاح!\n\nأرسل كلمة 'مواقع' لعرض المواقع المدعومة للبدء في النشر.";
                } else {
                    return "❌ كلمة سر خاطئة. حاول مرة أخرى أو أرسل 'start' للعودة.";
                }

            case 'ADMIN_MODE':
                if (cleanText === 'مواقع' || cleanText === 'sites') {
                    const sites = config.sources.map(s => `🔹 ${s.name} (ID: ${s.id})`).join('\n');
                    this.userStates.set(fbId, { step: 'SELECTING_SITE' });
                    return `🌐 المواقع المدعومة حالياً:\n\n${sites}\n\nمن فضلك اكتب (ID) الموقع الذي تريد السحب منه:`;
                }
                if (cleanText.startsWith('بحث ') || cleanText.startsWith('search ')) {
                    const query = cleanText.replace(/بحث |search /g, '');
                    return `🔍 جاري البحث عن "${query}" في جميع المصادر... (هذه الميزة قيد التطوير لتكون مباشرة هنا)`;
                }
                break;

            case 'SELECTING_SITE':
                const source = config.sources.find(s => s.id === cleanText);
                if (source) {
                    this.userStates.set(fbId, { step: 'AWAITING_MANGA_NAME', sourceId: cleanText });
                    return `✅ تم اختيار: ${source.name}.\n\nالآن أرسل "اسم المانهوا" كما هو موجود في الموقع (يفضل بالإنجليزية إذا كان الموقع يدعم ذلك):`;
                } else {
                    return "❌ معرف الموقع (ID) غير صحيح. من فضلك اختر من القائمة أو أرسل 'مواقع' مرة أخرى.";
                }

            case 'AWAITING_MANGA_NAME':
                const mangaName = text.trim(); // Keep original casing for search
                const sourceId = state.sourceId;
                this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                
                // Fire and forget extraction
                this.startMangaExtraction(fbId, sourceId, mangaName);
                return `⏳ جاري فحص "${mangaName}" في موقع ${sourceId}...\n\nسأقوم بإرسال تقرير مفصل فور العثور عليها وحساب وقت النشر.`;

            default:
                return "🐺 مرحباً! أنا أوكامي بوت.\n\nأرسل كلمة 'ابدأ' أو 'start' لاستكشاف الخيارات المتاحة.";
        }
    }

    static async startMangaExtraction(fbId, sourceId, mangaName) {
        try {
            logger.info(`[Extraction] Starting for ${mangaName} from ${sourceId}`);
            const results = await scraperEngine.search(sourceId, mangaName);
            
            if (!results || results.length === 0) {
                await FacebookPublisher.sendDirectMessage(fbId, `❌ لم أجد أي مانهوا باسم "${mangaName}" في هذا الموقع. تأكد من الاسم الصحيح.`);
                return;
            }

            const manga = results[0];
            const details = await scraperEngine.getMangaDetails(sourceId, manga.url);
            
            if (!details || !details.chapters || details.chapters.length === 0) {
                await FacebookPublisher.sendDirectMessage(fbId, `⚠️ تم العثور على المانهوا ولكن لم أتمكن من استخراج أي فصول منها.`);
                return;
            }

            const mangaData = {
                title: details.title,
                slug: details.slug || mangaName.toLowerCase().replace(/ /g, '-'),
                coverUrl: details.coverUrl,
                status: details.status,
                sourceSite: sourceId,
                sourceUrl: manga.url
            };

            const savedManga = await MemoryService.saveManga(mangaData);
            
            const chapterCount = details.chapters.length;
            const totalMinutes = chapterCount * 5;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${minutes} دقيقة`;

            await FacebookPublisher.sendDirectMessage(fbId, 
                `✅ تم العثور على: ${details.title}\n` +
                `🔢 إجمالي الفصول: ${chapterCount}\n` +
                `⏳ الوقت المتوقع للنشر: ${timeText}\n\n` +
                `🚀 بدأت عملية النشر في الخلفية. يمكنك متابعة التقدم عبر لوحة التحكم.`
            );

            // Add chapters to queue
            for (const ch of details.chapters) {
                await QueueSystem.addToQueue({
                    mangaId: savedManga.slug,
                    number: ch.number,
                    chapterUrl: ch.url,
                    sourceKey: sourceId,
                    adminFbId: fbId
                });
            }

        } catch (error) {
            logger.error(`[Extraction Error]: ${error.message}`);
            await FacebookPublisher.sendDirectMessage(fbId, `❌ حدث خطأ غير متوقع أثناء المعالجة: ${error.message}`);
        }
    }
}
