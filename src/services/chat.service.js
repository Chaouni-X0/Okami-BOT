import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { UserService } from './user.service.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import { FacebookPublisher } from '../modules/publisher.js';

export class ChatService {
    constructor() {
        this.sessions = new Map(); // fbId -> { step, data }
    }

    async handleMessage(fbId, message) {
        const state = this.sessions.get(fbId) || { step: 'START' };
        const text = message.trim();

        // Global commands
        if (text.toLowerCase() === 'reset' || text === 'خروج') {
            this.sessions.delete(fbId);
            return "🔄 تم إعادة ضبط الجلسة. أرسل أي شيء للبدء من جديد.";
        }

        switch (state.step) {
            case 'START':
                this.sessions.set(fbId, { step: 'CHOOSING_ROLE' });
                return "🐺 مرحباً بك في Okami Bot!\nكيف يمكنني مساعدتك اليوم؟\n\n1️⃣ وضع المطور (Developer Mode)\n2️⃣ وضع القارئ (Reader Mode)\n\nأرسل رقم اختيارك:";

            case 'CHOOSING_ROLE':
                if (text === '1') {
                    this.sessions.set(fbId, { step: 'AWAITING_PASSWORD' });
                    return "🔐 يرجى إدخال مفتاح التنشيط الخاص بالمطور:";
                } else if (text === '2') {
                    const profile = await UserService.getProfile(fbId);
                    this.sessions.set(fbId, { step: 'START' });
                    return `📖 أهلاً بك أيها القارئ!\n👤 ملفك الشخصي:\n⭐ المستوى: ${profile.level}\n🔥 الـ Streak: ${profile.streak}\n🏆 اللقب: ${profile.rank_title}\n💰 النقاط: ${profile.points}\n\nيمكنك متابعة القراءة لزيادة نقاطك! 🐺`;
                }
                return "❌ اختيار غير صحيح. يرجى اختيار 1 أو 2:";

            case 'AWAITING_PASSWORD':
                if (text === config.admin.activationKey) {
                    this.sessions.set(fbId, { step: 'DEV_MENU' });
                    return "✅ تم التحقق بنجاح! مرحباً بك أيها المطور.\n\n1️⃣ البحث في جميع المواقع 🔍\n2️⃣ اختيار موقع معين 🌐\n3️⃣ التحقق من حالة النشر 📊\n\nأرسل رقم الخيار:";
                }
                return "❌ مفتاح التنشيط خاطئ. حاول مرة أخرى:";

            case 'DEV_MENU':
                if (text === '1') {
                    this.sessions.set(fbId, { step: 'AWAITING_SEARCH_QUERY' });
                    return "🔍 أرسل اسم المانهوا/المانجا التي تبحث عنها:";
                } else if (text === '2') {
                    this.sessions.set(fbId, { step: 'SELECTING_SOURCE' });
                    let menu = "🌐 اختر الموقع:\n";
                    config.sources.forEach((s, i) => menu += `${i + 1}. ${s.name}\n`);
                    return menu + "\nأرسل رقم الموقع:";
                } else if (text === '3') {
                    const isValid = await FacebookPublisher.validateToken();
                    return isValid ? "✅ نظام النشر يعمل بشكل صحيح والتوكن صالح." : "❌ هناك مشكلة في توكن الفيسبوك. يرجى مراجعة الـ Logs.";
                }
                return "❌ اختيار غير صحيح.";

            case 'AWAITING_SEARCH_QUERY':
                const query = text;
                const results = await scraperEngine.searchAll(query);
                if (results.length === 0) {
                    return "❌ لم يتم العثور على نتائج. حاول كتابة الاسم بشكل مختلف أو جرب 'reset' للبدء من جديد.";
                }
                this.sessions.set(fbId, { step: 'SELECTING_RESULT', results });
                let resultMsg = "🔎 النتائج المتاحة:\n\n";
                results.slice(0, 10).forEach((res, i) => {
                    resultMsg += `${i + 1}️⃣ ${res.title} (${res.sourceName})\n`;
                });
                return resultMsg + "\n📌 أرسل الرقم فقط للاختيار:";

            case 'SELECTING_RESULT':
                const idx = parseInt(text) - 1;
                const searchResults = state.results;
                if (idx >= 0 && idx < searchResults.length) {
                    const selected = searchResults[idx];
                    try {
                        const details = await scraperEngine.getMangaDetails(selected.sourceId, selected.url);
                        this.sessions.set(fbId, { step: 'SELECTING_CHAPTER', details, sourceId: selected.sourceId });
                        let chapterMsg = `📖 ${details.title}\n✅ تم العثور على ${details.chapters.length} فصل.\n\nأحدث الفصول:\n`;
                        details.chapters.slice(0, 5).forEach((ch, i) => {
                            chapterMsg += `${i + 1}. فصل ${ch.number} - ${ch.name}\n`;
                        });
                        return chapterMsg + "\nأرسل رقم الفصل للنشر، أو أرسل 'all' للنشر التلقائي للفصول الجديدة مستقبلاً:";
                    } catch (e) {
                        return "❌ حدث خطأ في جلب تفاصيل العمل.";
                    }
                }
                return "❌ رقم غير صحيح.";

            case 'SELECTING_CHAPTER':
                const chIdx = parseInt(text) - 1;
                const mangaDetails = state.details;
                if (chIdx >= 0 && chIdx < mangaDetails.chapters.length) {
                    const chapter = mangaDetails.chapters[chIdx];
                    
                    // Generate professional message
                    const postMessage = `╭━━━〔 🔥 فصل جديد 🔥 〕━━━╮\n📖 اسم العمل: ❪ ${mangaDetails.title} ❫\n📌 الفصل: ❪ ${chapter.number} ❫\n╰━━━━━━━━━━━━━━━╯\n\n📝 نبذة:\n${mangaDetails.description.substring(0, 200)}...\n\n📥 قراءة مباشرة:\n🔗 ${chapter.url}\n\n━━━━━━━━━━━━━━━\n🔥 لا تنسوا المتابعة ليصلكم كل جديد\n💬 شاركونا رأيكم 👇`;

                    await QueueSystem.addChapterToQueue({
                        mangaTitle: mangaDetails.title,
                        chapterName: chapter.name,
                        chapterUrl: chapter.url,
                        sourceKey: state.sourceId,
                        adminFbId: fbId,
                        customMessage: postMessage
                    });

                    this.sessions.set(fbId, { step: 'DEV_MENU' });
                    return `🚀 جاري العمل على نشر الفصل ${chapter.number} من "${mangaDetails.title}"...\nسيتم إرسال تنبيه لك فور الانتهاء. 🐺🔥`;
                }
                return "❌ رقم فصل غير صحيح.";

            default:
                this.sessions.set(fbId, { step: 'START' });
                return "🔄 أهلاً بك! أرسل أي شيء للبدء.";
        }
    }
}

export default new ChatService();
