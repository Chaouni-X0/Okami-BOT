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
        if (['ابدأ', 'start', 'مرحبا', 'hi', 'hello', 'menu', 'القائمة', 'help', 'مساعدة'].includes(cleanText)) {
            return this.showMainMenu(fbId);
        }

        // --- Direct Activation Command ---
        if (cleanText.startsWith('تفعيل') || cleanText.startsWith('activate')) {
            const password = cleanText.replace(/تفعيل|activate|[\[\]]/g, '').trim();
            if (password === config.admin.password || password === config.admin.activationKey) {
                this.userStates.set(fbId, { step: 'ADMIN_MODE' });
                return "✅ تم التفعيل بنجاح! أهلاً بك أيها المطور.\n\n🔧 الأوامر المتاحة:\n• 'مواقع' - عرض مصادر المانجا\n• 'بحث [اسم]' - البحث عن مانجا\n• 'حالة' - عرض حالة النشر\n• 'مساعدة' - عرض هذه القائمة";
            } else {
                return "❌ رمز التفعيل أو كلمة السر غير صحيحة.";
            }
        }

        // --- State Machine ---
        switch (state.step) {
            case 'START':
                // User hasn't activated yet - show helpful message
                return this.showWelcomeMessage();

            case 'ADMIN_MODE':
                return this.handleAdminMode(fbId, cleanText, text.trim());

            case 'SELECTING_SITE':
                return this.handleSiteSelection(fbId, cleanText);

            case 'AWAITING_MANGA_NAME':
                return this.handleMangaName(fbId, text.trim(), state.sourceId);

            default:
                return this.showWelcomeMessage();
        }
    }

    // --- Helper Methods ---

    static showMainMenu(fbId) {
        this.userStates.set(fbId, { step: 'START' });
        return this.showWelcomeMessage();
    }

    static showWelcomeMessage() {
        return `🐺 أهلاً بك في أوكامي بوت!

أنا بوت خاص لنشر المانجا على فيسبوك.

🔒 هذا البوت مخصص للمطور والمختبرين فقط.

للبدء، أرسل:
• تفعيل [كلمة السر] - لتفعيل وضع المطور
• مساعدة - لعرض هذه الرسالة`;
    }

    static handleAdminMode(fbId, cleanText, originalText) {
        // Site listing
        if (cleanText === 'مواقع' || cleanText === 'sites') {
            const sites = config.sources.map(s => `🔹 ${s.name} (ID: ${s.id})`).join('\n');
            this.userStates.set(fbId, { step: 'SELECTING_SITE' });
            return `🌐 المواقع المدعومة حالياً:\n\n${sites}\n\n✏️ اكتب ID الموقع للاختيار:`;
        }

        // Search
        if (cleanText.startsWith('بحث ') || cleanText.startsWith('search ')) {
            const query = cleanText.replace(/بحث |search /g, '');
            return `🔍 البحث عن "${query}" قيد التطوير. استخدم 'مواقع' ثم اختر المانجا مباشرة.`;
        }

        // Status check
        if (cleanText === 'حالة' || cleanText === 'status') {
            return `📊 حالة البوت:\n• ✅ البوت يعمل\n• استخدم 'مواقع' لبدء نشر مانجا جديدة`;
        }

        // Help
        if (cleanText === 'مساعدة' || cleanText === 'help') {
            return `🔧 أوامر وضع المطور:\n\n• مواقع - عرض مصادر المانجا\n• حالة - فحص حالة البوت\n• مساعدة - عرض هذه القائمة\n\n💡 لنشر مانجا:\n1. أرسل 'مواقع'\n2. اختر الموقع (ID)\n3. أرسل اسم المانجا`;
        }

        // Unknown command in admin mode
        return `❓ أمر غير معروف: "${originalText}"\n\n🔧 الأوامر المتاحة:\n• مواقع - عرض المصادر\n• حالة - حالة البوت\n• مساعدة - عرض المساعدة`;
    }

    static handleSiteSelection(fbId, cleanText) {
        const source = config.sources.find(s => s.id === cleanText);
        if (source) {
            this.userStates.set(fbId, { step: 'AWAITING_MANGA_NAME', sourceId: cleanText });
            return `✅ تم اختيار: ${source.name}\n\n✏️ أرسل اسم المانجا كما هو في الموقع:`;
        } else {
            return `❌ ID غير صحيح. أرسل 'مواقع' للعرض مرة أخرى.`;
        }
    }

    static handleMangaName(fbId, mangaName, sourceId) {
        this.userStates.set(fbId, { step: 'ADMIN_MODE' });
        
        // Fire and forget extraction
        this.startMangaExtraction(fbId, sourceId, mangaName);
        return `⏳ جاري فحص "${mangaName}"...\nسأرسل التقرير فور الانتهاء.`;
    }

    static async startMangaExtraction(fbId, sourceId, mangaName) {
        try {
            logger.info(`[Extraction] Starting for ${mangaName} from ${sourceId}`);
            const results = await scraperEngine.search(sourceId, mangaName);
            
            if (!results || results.length === 0) {
                await FacebookPublisher.sendDirectMessage(fbId, `❌ لم أجد "${mangaName}" في هذا الموقع.`);
                return;
            }

            const manga = results[0];
            const details = await scraperEngine.getMangaDetails(sourceId, manga.url);
            
            if (!details || !details.chapters || details.chapters.length === 0) {
                await FacebookPublisher.sendDirectMessage(fbId, `⚠️ تم العثور على المانجا ولكن لا توجد فصول.`);
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
            const timeText = hours > 0 ? `${hours}س و${minutes}د` : `${minutes}د`;

            await FacebookPublisher.sendDirectMessage(fbId, 
                `✅ ${details.title}\n` +
                `📚 ${chapterCount} فصل | ⏳ ${timeText}\n` +
                `🚀 بدأت عملية النشر!`
            );

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
            await FacebookPublisher.sendDirectMessage(fbId, `❌ خطأ: ${error.message}`);
        }
    }
}
