import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { UserService } from './user.service.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ChatService {
    constructor() {
        this.sessions = new Map(); // تخزين حالة كل مستخدم (fbId -> state)
    }

    async handleMessage(fbId, message) {
        const state = this.sessions.get(fbId) || { step: 'START' };
        const text = message.trim();

        switch (state.step) {
            case 'START':
                this.sessions.set(fbId, { step: 'CHOOSING_ROLE' });
                return "🐺 مرحباً بك في Okami Bot!\nكيف يمكنني مساعدتك اليوم؟\n\n1. وضع المطور (Developer Mode)\n2. وضع القارئ (Reader Mode)\n\nأرسل رقم اختيارك:";

            case 'CHOOSING_ROLE':
                if (text === '1') {
                    this.sessions.set(fbId, { step: 'AWAITING_PASSWORD' });
                    return "🔐 يرجى إدخال كلمة السر الخاصة بالمطور:";
                } else if (text === '2') {
                    const profile = await UserService.getProfile(fbId);
                    this.sessions.set(fbId, { step: 'START' });
                    return `📖 أهلاً بك أيها القارئ!
👤 ملفك الشخصي:
⭐ المستوى: ${profile.level}
🔥 الـ Streak: ${profile.streak}
🏆 اللقب: ${profile.rank_title}
💰 النقاط: ${profile.points}
🛡️ القبيلة: ${profile.guild_name}

يمكنك متابعة القراءة لزيادة نقاطك ومستواك! 🐺`;
                }
                return "❌ اختيار غير صحيح. يرجى اختيار 1 أو 2:";

            case 'AWAITING_PASSWORD':
                if (text === config.admin.activationKey) {
                    this.sessions.set(fbId, { step: 'DEV_MENU' });
                    const sources = scraperEngine.getSupportedSources();
                    let menu = "✅ تم التحقق بنجاح! مرحباً بك أيها المطور.\nاختر الموقع الذي تريد استخراج العمل منه:\n\n";
                    sources.forEach((s, i) => menu += `${i + 1}. ${s.name}\n`);
                    return menu + "\nأرسل رقم الموقع:";
                }
                return "❌ كلمة السر خاطئة. حاول مرة أخرى:";

            case 'DEV_MENU':
                const sources = scraperEngine.getSupportedSources();
                const sourceIdx = parseInt(text) - 1;
                if (sourceIdx >= 0 && sourceIdx < sources.length) {
                    const selectedSource = sources[sourceIdx];
                    this.sessions.set(fbId, { step: 'AWAITING_MANGA_SLUG', source: selectedSource.id });
                    return `🔍 ممتاز! لقد اخترت ${selectedSource.name}.\nالآن أرسل لي (Slug) العمل (مثال: solo-leveling):`;
                }
                return "❌ اختيار غير صحيح. يرجى اختيار رقم من القائمة:";

            case 'AWAITING_MANGA_SLUG':
                const sourceKey = state.source;
                const mangaSlug = text;
                this.sessions.set(fbId, { step: 'START' }); // إعادة تعيين الحالة بعد البدء

                try {
                    const mangaInfo = await scraperEngine.parseManga(sourceKey, mangaSlug);
                    if (mangaInfo && mangaInfo.chapters.length > 0) {
                        const lastChapter = mangaInfo.chapters[mangaInfo.chapters.length - 1];
                        
                        // بدء عملية النشر
                        await QueueSystem.addChapterToQueue({
                            mangaTitle: mangaInfo.title,
                            chapterName: lastChapter.name,
                            chapterUrl: lastChapter.url,
                            sourceKey: sourceKey,
                            adminFbId: fbId // لإرسال تنبيه عند الانتهاء
                        });

                        return `🚀 جاري العمل على "${mangaInfo.title}"...\nسيتم نشر الفصل الأخير وإرسال تنبيه لك فور الانتهاء وحذف البيانات المؤقتة. 🐺🔥`;
                    }
                    return "❌ لم أتمكن من العثور على العمل أو الفصول في هذا الموقع. تأكد من الـ Slug.";
                } catch (error) {
                    logger.error(`Chat Error: ${error.message}`);
                    return "❌ حدث خطأ أثناء محاولة جلب البيانات. حاول مرة أخرى لاحقاً.";
                }

            default:
                this.sessions.set(fbId, { step: 'START' });
                return "🔄 حدث خطأ في الجلسة. لنبدأ من جديد.\nأرسل 'مرحبا' للبدء.";
        }
    }
}

export default new ChatService();
