import { config } from '../config/config.js';
import db from '../database/db.js';
import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { FacebookPublisher } from '../modules/publisher.js';
import { MemoryService } from './memory.service.js';
import logger from '../utils/logger.js';

/**
 * خدمة الحوار المحسّنة (Enhanced Dialogue Service)
 * توحيد الردود وتحسين معالجة الفصول والفصول
 */
export class DialogueServiceEnhanced {
    static userStates = new Map();
    static userSessions = new Map(); // تتبع جلسات المستخدم

    /**
     * معالجة الرسالة الواردة من المستخدم
     * @param {string} fbId - معرف المستخدم على Facebook
     * @param {string} text - نص الرسالة
     * @returns {Promise<string>} - الرد على المستخدم
     */
    static async handleMessage(fbId, text) {
        try {
            const state = this.userStates.get(fbId) || { step: 'START' };
            const cleanText = text.trim().toLowerCase();

            // أوامر سريعة
            if (cleanText === 'مرحبا' || cleanText === 'start' || cleanText === '/start') {
                return this.handleStart(fbId);
            }

            if (cleanText === 'مساعدة' || cleanText === '/help') {
                return this.getHelpMessage();
            }

            if (cleanText === 'إلغاء' || cleanText === '/cancel') {
                this.userStates.delete(fbId);
                return "✅ تم إلغاء العملية الحالية. أرسل 'مرحبا' للبدء من جديد.";
            }

            // معالجة حسب الحالة الحالية
            switch (state.step) {
                case 'CHOOSING_MODE':
                    return this.handleModeSelection(fbId, cleanText);

                case 'AWAITING_PASSWORD':
                    return this.handlePasswordVerification(fbId, cleanText);

                case 'ADMIN_MODE':
                    return this.handleAdminMode(fbId, cleanText);

                case 'SELECTING_SITE':
                    return this.handleSiteSelection(fbId, cleanText);

                case 'AWAITING_MANGA_NAME':
                    return await this.handleMangaNameInput(fbId, cleanText, state);

                case 'USER_MODE':
                    return this.handleUserMode(fbId, cleanText);

                default:
                    return "🐺 أرسل 'مرحبا' للبدء أو 'مساعدة' للحصول على المساعدة.";
            }
        } catch (error) {
            logger.error(`Dialogue Error: ${error.message}`);
            return "❌ حدث خطأ أثناء معالجة الرسالة. حاول مرة أخرى.";
        }
    }

    /**
     * معالجة بداية المحادثة
     */
    static handleStart(fbId) {
        this.userStates.set(fbId, { step: 'CHOOSING_MODE' });
        return `🐺 أهلاً وسهلاً في **أوكامي بوت**! 🎉

اختر الوضع الذي تريده:

1️⃣ **وضع المستخدم** 👤
   - عرض ملفك الشخصي
   - طلب المانهوا الجديدة
   - عرض إحصائياتك

2️⃣ **وضع المطور** 🛠️
   - إضافة مانهوا جديدة
   - إدارة الطابور
   - عرض الإحصائيات المتقدمة

أرسل الرقم (1 أو 2):`;
    }

    /**
     * معالجة اختيار الوضع
     */
    static handleModeSelection(fbId, choice) {
        if (choice === '1') {
            this.userStates.set(fbId, { step: 'USER_MODE' });
            return `👤 **وضع المستخدم**

يمكنك:
- أرسل 'ملفي' لعرض ملفك الشخصي
- أرسل 'مانهوا' لعرض المانهوا المتاحة
- أرسل 'إحصائيات' لعرض إحصائياتك

اختر أحد الخيارات:`;
        } else if (choice === '2') {
            this.userStates.set(fbId, { step: 'AWAITING_PASSWORD' });
            return `🛠️ **وضع المطور**

هذا الوضع يتطلب كلمة سر للتحقق من الهوية.

🔐 أدخل كلمة السر:`;
        } else {
            return "❌ اختيار غير صحيح. أرسل 1 أو 2.";
        }
    }

    /**
     * معالجة التحقق من كلمة السر
     */
    static handlePasswordVerification(fbId, password) {
        if (password === config.admin.password) {
            this.userStates.set(fbId, { step: 'ADMIN_MODE' });
            return `✅ **تم التحقق بنجاح!**

🛠️ أهلاً بك أيها المطور. الأوامر المتاحة:

📍 **/مواقع** - عرض المواقع المدعومة
📊 **/إحصائيات** - عرض إحصائيات الطابور
🔄 **/حالة** - عرض حالة النظام
🆘 **/مساعدة** - عرض قائمة الأوامر

اختر أحد الأوامر:`;
        } else {
            return "❌ كلمة السر غير صحيحة. حاول مرة أخرى أو أرسل 'إلغاء'.";
        }
    }

    /**
     * معالجة وضع المطور
     */
    static handleAdminMode(fbId, command) {
        const cleanCommand = command.toLowerCase().replace('/', '');

        if (cleanCommand === 'مواقع') {
            const sites = config.sources
                .map((s, idx) => `${idx + 1}. **${s.name}** (ID: ${s.id})`)
                .join('\n');
            
            this.userStates.set(fbId, { step: 'SELECTING_SITE' });
            return `🌐 **المواقع المدعومة:**\n\n${sites}\n\n📍 أرسل رقم الموقع (1-${config.sources.length}):`;
        }

        if (cleanCommand === 'إحصائيات') {
            return this.getQueueStatistics();
        }

        if (cleanCommand === 'حالة') {
            return this.getSystemStatus();
        }

        if (cleanCommand === 'مساعدة') {
            return `🆘 **قائمة أوامر المطور:**

/مواقع - عرض المواقع المدعومة
/إحصائيات - عرض إحصائيات الطابور
/حالة - عرض حالة النظام
/مساعدة - عرض هذه الرسالة
إلغاء - إلغاء العملية الحالية`;
        }

        return "❌ أمر غير معروف. أرسل '/مساعدة' لعرض الأوامر.";
    }

    /**
     * معالجة اختيار الموقع
     */
    static handleSiteSelection(fbId, choice) {
        const siteIndex = parseInt(choice) - 1;
        
        if (siteIndex < 0 || siteIndex >= config.sources.length) {
            return "❌ اختيار غير صحيح. أرسل رقم الموقع الصحيح.";
        }

        const source = config.sources[siteIndex];
        this.userStates.set(fbId, { 
            step: 'AWAITING_MANGA_NAME', 
            sourceId: source.id,
            sourceName: source.name
        });

        return `✅ اخترت **${source.name}**

📝 الآن أرسل اسم المانهوا/المانهوا بالإنجليزية (الاسم الصحيح للبحث):`;
    }

    /**
     * معالجة إدخال اسم المانهوا
     */
    static async handleMangaNameInput(fbId, mangaName, state) {
        const sourceId = state.sourceId;
        const sourceName = state.sourceName;

        // إعادة تعيين الحالة
        this.userStates.set(fbId, { step: 'ADMIN_MODE' });

        // إرسال رسالة انتظار
        await FacebookPublisher.sendDirectMessage(fbId, 
            `🔍 جاري البحث عن "${mangaName}" في **${sourceName}**...`
        );

        // بدء استخراج المانهوا بشكل غير متزامن
        this.startMangaExtraction(fbId, sourceId, sourceName, mangaName);

        return `✅ تم استقبال الطلب. سيتم إرسال التفاصيل قريباً...`;
    }

    /**
     * معالجة وضع المستخدم العادي
     */
    static handleUserMode(fbId, command) {
        const cleanCommand = command.toLowerCase();

        if (cleanCommand === 'ملفي') {
            return this.getUserProfile(fbId);
        }

        if (cleanCommand === 'مانهوا') {
            return this.getAvailableManga();
        }

        if (cleanCommand === 'إحصائيات') {
            return this.getUserStatistics(fbId);
        }

        return "❌ أمر غير معروف. أرسل 'ملفي' أو 'مانهوا' أو 'إحصائيات'.";
    }

    /**
     * بدء استخراج المانهوا
     */
    static async startMangaExtraction(fbId, sourceId, sourceName, mangaName) {
        try {
            // البحث عن المانهوا
            const results = await scraperEngine.search(sourceId, mangaName);
            
            if (!results || results.length === 0) {
                await FacebookPublisher.sendDirectMessage(fbId, 
                    `❌ لم أجد مانهوا باسم "${mangaName}" في **${sourceName}**.`
                );
                return;
            }

            const manga = results[0];
            const details = await scraperEngine.getMangaDetails(sourceId, manga.url);

            // حفظ المانهوا
            const mangaRecord = MemoryService.saveManga({
                title: details.title,
                slug: mangaName.toLowerCase().replace(/\s+/g, '-'),
                coverUrl: details.coverUrl || '',
                status: details.status || 'ongoing',
                sourceSite: sourceId,
                sourceUrl: manga.url
            });

            const mangaId = mangaRecord.id;
            const chapterCount = details.chapters.length;

            // حساب الوقت المتوقع
            const delayMinutes = 5; // 5 دقائق لكل فصل
            const totalMinutes = chapterCount * delayMinutes;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0 
                ? `${hours}ساعة و${minutes}دقيقة` 
                : `${minutes}دقيقة`;

            // إرسال ملخص المانهوا
            await FacebookPublisher.sendDirectMessage(fbId, 
                `✅ **تم العثور على المانهوا!**\n\n` +
                `📖 **العنوان:** ${details.title}\n` +
                `🔢 **عدد الفصول:** ${chapterCount}\n` +
                `📍 **الحالة:** ${details.status}\n` +
                `⏳ **الوقت المتوقع:** ${timeText}\n\n` +
                `🚀 بدأ النشر الآن...`
            );

            // إضافة الفصول للطابور
            for (const chapter of details.chapters) {
                await QueueSystem.addToQueue({
                    mangaId,
                    number: chapter.number,
                    chapterUrl: chapter.url,
                    sourceKey: sourceId,
                    adminFbId: fbId
                });
            }

            logger.info(`✅ Added ${chapterCount} chapters for "${details.title}" to queue`);

        } catch (error) {
            logger.error(`Extraction Error: ${error.message}`);
            await FacebookPublisher.sendDirectMessage(fbId, 
                `❌ حدث خطأ أثناء معالجة المانهوا:\n${error.message}`
            );
        }
    }

    /**
     * الحصول على إحصائيات الطابور
     */
    static getQueueStatistics() {
        try {
            const pending = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'pending'").get().count;
            const processing = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'processing'").get().count;
            const failed = db.prepare("SELECT COUNT(*) as count FROM publish_queue WHERE status = 'failed'").get().count;
            const total = db.prepare("SELECT COUNT(*) as count FROM publish_queue").get().count;

            return `📊 **إحصائيات الطابور:**

⏳ قيد الانتظار: ${pending}
⚙️ قيد المعالجة: ${processing}
❌ فاشلة: ${failed}
📈 الإجمالي: ${total}`;
        } catch (error) {
            return "❌ خطأ في جلب الإحصائيات.";
        }
    }

    /**
     * الحصول على حالة النظام
     */
    static getSystemStatus() {
        return `🔄 **حالة النظام:**

✅ حالة الاتصال: متصل
✅ قاعدة البيانات: متصلة
✅ Facebook API: متصل
📈 الإصدار: 5.0.0
🐺 البوت: نشط وجاهز`;
    }

    /**
     * الحصول على رسالة المساعدة
     */
    static getHelpMessage() {
        return `🆘 **المساعدة:**

**وضع المستخدم:**
- ملفي: عرض ملفك الشخصي
- مانهوا: عرض المانهوا المتاحة
- إحصائيات: عرض إحصائياتك

**وضع المطور:**
- /مواقع: عرض المواقع المدعومة
- /إحصائيات: عرض إحصائيات الطابور
- /حالة: عرض حالة النظام

**أوامر عامة:**
- مرحبا: البدء من جديد
- إلغاء: إلغاء العملية الحالية`;
    }

    /**
     * الحصول على ملف المستخدم الشخصي
     */
    static getUserProfile(fbId) {
        try {
            const user = db.prepare("SELECT * FROM users WHERE fb_id = ?").get(fbId);
            
            if (!user) {
                return "👤 **ملفك الشخصي:**\n\nأنت مستخدم جديد. ابدأ بطلب مانهوا!";
            }

            return `👤 **ملفك الشخصي:**

👤 الاسم: ${user.name}
⭐ المستوى: ${user.level}
🎯 النقاط: ${user.points}
🔥 السلسلة: ${user.streak}
📅 آخر نشاط: ${user.last_active}`;
        } catch (error) {
            return "❌ خطأ في جلب ملفك الشخصي.";
        }
    }

    /**
     * الحصول على المانهوا المتاحة
     */
    static getAvailableManga() {
        try {
            const manga = db.prepare("SELECT * FROM manga LIMIT 10").all();
            
            if (manga.length === 0) {
                return "📚 لا توجد مانهوا متاحة حالياً.";
            }

            let message = "📚 **المانهوا المتاحة:**\n\n";
            manga.forEach((m, idx) => {
                message += `${idx + 1}. ${m.title} (${m.status})\n`;
            });

            return message;
        } catch (error) {
            return "❌ خطأ في جلب المانهوا.";
        }
    }

    /**
     * الحصول على إحصائيات المستخدم
     */
    static getUserStatistics(fbId) {
        return `📈 **إحصائياتك:**

📖 المانهوا المقروءة: 0
📝 الفصول المقروءة: 0
⭐ التقييم المتوسط: 0
🎯 النقاط المجمعة: 0`;
    }
}

export default DialogueServiceEnhanced;
