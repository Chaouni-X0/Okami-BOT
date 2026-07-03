import scraperEngine from '../modules/scraper.js';
import { QueueSystem } from '../modules/queue.js';
import { UserService } from './user.service.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import { FacebookPublisher } from '../modules/publisher.js';
import { sendMessage } from './messenger.js';

export class ChatService {
    constructor() {
        this.sessions = new Map(); // fbId -> { step, data }
        this.searchTimeout = 90000; // 90 second timeout for searches (Python engine can be slow)
    }

    async handleMessage(fbId, message) {
        const text = message.trim();
        const lowerText = text.toLowerCase();

        // Check for greeting or reset to restart the session
        if (['مرحبا', 'أهلا', 'start', 'reset', 'خروج', 'أهلا بك'].includes(lowerText)) {
            this.sessions.set(fbId, { step: 'CHOOSING_ROLE' });
            const welcome = "🐺 مرحباً بك في Okami Bot!\nكيف يمكنني مساعدتك اليوم؟\n\n1️⃣ وضع المطور (Developer Mode)\n2️⃣ وضع القارئ (Reader Mode)\n\nأرسل رقم اختيارك:";
            await sendMessage(fbId, { text: welcome });
            return;
        }

        const state = this.sessions.get(fbId) || { step: 'START' };

        try {
            switch (state.step) {
                case 'START':
                    this.sessions.set(fbId, { step: 'CHOOSING_ROLE' });
                    await sendMessage(fbId, { text: "🐺 مرحباً بك في Okami Bot!\nكيف يمكنني مساعدتك اليوم؟\n\n1️⃣ وضع المطور (Developer Mode)\n2️⃣ وضع القارئ (Reader Mode)\n\nأرسل رقم اختيارك:" });
                    break;

                case 'CHOOSING_ROLE':
                    if (text === '1') {
                        this.sessions.set(fbId, { step: 'AWAITING_PASSWORD' });
                        await sendMessage(fbId, { text: "🔐 يرجى إدخال مفتاح التنشيط الخاص بالمطور:" });
                    } else if (text === '2') {
                        const profile = await UserService.getProfile(fbId);
                        this.sessions.set(fbId, { step: 'START' });
                        const profileMsg = `📖 أهلاً بك أيها القارئ!\n👤 ملفك الشخصي:\n⭐ المستوى: ${profile.level}\n🔥 الـ Streak: ${profile.streak}\n🏆 اللقب: ${profile.rank_title}\n💰 النقاط: ${profile.points}\n\nيمكنك متابعة القراءة لزيادة نقاطك! 🐺\n(أرسل "مرحبا" للعودة للقائمة الرئيسية)`;
                        await sendMessage(fbId, { text: profileMsg });
                    } else {
                        await sendMessage(fbId, { text: "❌ اختيار غير صحيح. يرجى اختيار 1 أو 2:" });
                    }
                    break;

                case 'AWAITING_PASSWORD':
                    if (text === config.admin.activationKey) {
                        this.sessions.set(fbId, { step: 'DEV_MENU' });
                        const devMenu = "✅ تم التحقق بنجاح! مرحباً بك أيها المطور.\n\n1️⃣ البحث في جميع المواقع 🔍\n2️⃣ اختيار موقع معين 🌐\n3️⃣ التحقق من حالة النشر 📊\n\nأرسل رقم الخيار:";
                        await sendMessage(fbId, { text: devMenu });
                    } else {
                        await sendMessage(fbId, { text: "❌ مفتاح التنشيط خاطئ. حاول مرة أخرى:" });
                    }
                    break;

                case 'DEV_MENU':
                    if (text === '1') {
                        this.sessions.set(fbId, { step: 'AWAITING_SEARCH_QUERY' });
                        await sendMessage(fbId, { text: "🔍 أرسل اسم المانهوا/المانجا التي تبحث عنها:" });
                    } else if (text === '2') {
                        this.sessions.set(fbId, { step: 'SELECTING_SOURCE' });
                        let menu = "🌐 اختر الموقع:\n";
                        config.sources.forEach((s, i) => menu += `${i + 1}. ${s.name}\n`);
                        await sendMessage(fbId, { text: menu + "\nأرسل رقم الموقع:" });
                    } else if (text === '3') {
                        try {
                            const isValid = await FacebookPublisher.validateToken();
                            const statusMsg = isValid ? "✅ نظام النشر يعمل بشكل صحيح والتوكن صالح." : "❌ هناك مشكلة في توكن الفيسبوك. يرجى مراجعة الـ Logs.";
                            await sendMessage(fbId, { text: statusMsg });
                        } catch (e) {
                            logger.error(`Token validation error: ${e.message}`);
                            await sendMessage(fbId, { text: "❌ خطأ في التحقق من التوكن. تحقق من الـ Logs." });
                        }
                    } else {
                        await sendMessage(fbId, { text: "❌ اختيار غير صحيح." });
                    }
                    break;

                case 'SELECTING_SOURCE':
                    const sourceIdx = parseInt(text) - 1;
                    if (sourceIdx >= 0 && sourceIdx < config.sources.length) {
                        const selectedSource = config.sources[sourceIdx];
                        this.sessions.set(fbId, { step: 'AWAITING_SEARCH_QUERY', sourceId: selectedSource.id });
                        await sendMessage(fbId, { text: `🔍 لقد اخترت ${selectedSource.name}.\nأرسل الآن اسم العمل للبحث فيه:` });
                    } else {
                        await sendMessage(fbId, { text: "❌ رقم موقع غير صحيح." });
                    }
                    break;

                case 'AWAITING_SEARCH_QUERY':
                    const query = text;
                    const sourceId = state.sourceId;
                    
                    if (!query || query.trim().length === 0) {
                        await sendMessage(fbId, { text: "❌ يرجى إدخال اسم صحيح للبحث." });
                        break;
                    }

                    await sendMessage(fbId, { text: `⏳ جاري البحث عن "${query}"...\n⏳ قد يستغرق هذا بعض الوقت...` });
                    
                    try {
                        let results = [];
                        
                        // Add timeout for search operation
                        const searchPromise = sourceId 
                            ? scraperEngine.search(sourceId, query)
                            : scraperEngine.searchAll(query);
                        
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Search timeout')), this.searchTimeout)
                        );
                        
                        results = await Promise.race([searchPromise, timeoutPromise]);

                        if (!results || results.length === 0) {
                            await sendMessage(fbId, { text: "❌ لم يتم العثور على نتائج. حاول كتابة الاسم بشكل مختلف أو أرسل 'مرحبا' للبدء من جديد." });
                            this.sessions.set(fbId, { step: 'DEV_MENU' });
                            return;
                        }

                        this.sessions.set(fbId, { step: 'SELECTING_RESULT', results });
                        let resultMsg = `🔎 وجدت ${results.length} نتيجة:\n\n`;
                        results.slice(0, 10).forEach((res, i) => {
                            resultMsg += `${i + 1}️⃣ ${res.title} (${res.sourceName || 'الموقع المختار'})\n`;
                        });
                        await sendMessage(fbId, { text: resultMsg + "\n📌 أرسل الرقم للاختيار:" });
                    } catch (error) {
                        logger.error(`Search error: ${error.message}`);
                        if (error.message === 'Search timeout') {
                            await sendMessage(fbId, { text: "⏱️ انتهت مهلة البحث. يرجى المحاولة مرة أخرى أو اختيار موقع محدد." });
                        } else {
                            await sendMessage(fbId, { text: `❌ حدث خطأ في البحث: ${error.message}\nيرجى المحاولة مرة أخرى.` });
                        }
                        this.sessions.set(fbId, { step: 'DEV_MENU' });
                    }
                    break;

                case 'SELECTING_RESULT':
                    const idx = parseInt(text) - 1;
                    const searchResults = state.results;
                    if (idx >= 0 && idx < searchResults.length) {
                        const selected = searchResults[idx];
                        await sendMessage(fbId, { text: `⏳ جاري جلب فصول "${selected.title}"...` });
                        try {
                            const details = await scraperEngine.getMangaDetails(selected.sourceId, selected.url);
                            this.sessions.set(fbId, { step: 'SELECTING_CHAPTER', details, sourceId: selected.sourceId });
                            let chapterMsg = `📖 ${details.title}\n✅ تم العثور على ${details.chapters.length} فصل.\n\nأحدث الفصول:\n`;
                            details.chapters.slice(0, 10).forEach((ch, i) => {
                                chapterMsg += `${i + 1}. ${ch.name}\n`;
                            });
                            await sendMessage(fbId, { text: chapterMsg + "\nأرسل رقم الفصل للنشر:" });
                        } catch (e) {
                            logger.error(`Details fetch error: ${e.message}`);
                            await sendMessage(fbId, { text: "❌ حدث خطأ في جلب تفاصيل العمل. تأكد من أن الموقع يعمل." });
                            this.sessions.set(fbId, { step: 'DEV_MENU' });
                        }
                    } else {
                        await sendMessage(fbId, { text: "❌ رقم غير صحيح." });
                    }
                    break;

                case 'SELECTING_CHAPTER':
                    const chIdx = parseInt(text) - 1;
                    const mangaDetails = state.details;
                    if (chIdx >= 0 && chIdx < mangaDetails.chapters.length) {
                        const chapter = mangaDetails.chapters[chIdx];
                        
                        const postMessage = `╭━━━〔 🔥 فصل جديد 🔥 〕━━━╮\n📖 اسم العمل: ❪ ${mangaDetails.title} ❫\n📌 الفصل: ❪ ${chapter.name} ❫\n╰━━━━━━━━━━━━━━━╯\n\n📝 نبذة:\n${mangaDetails.description ? mangaDetails.description.substring(0, 200) + '...' : 'لا يوجد وصف متاح.'}\n\n📥 قراءة مباشرة:\n🔗 ${chapter.url}\n\n━━━━━━━━━━━━━━━\n🔥 لا تنسوا المتابعة ليصلكم كل جديد\n💬 شاركونا رأيكم 👇`;

                        await sendMessage(fbId, { text: `🚀 جاري العمل على جلب وتحميل صور "${chapter.name}" من "${mangaDetails.title}"...\nسيتم إرسال تنبيه لك فور الانتهاء من النشر على فيسبوك. 🐺🔥` });

                        QueueSystem.addChapterToQueue({
                            mangaTitle: mangaDetails.title,
                            chapterName: chapter.name,
                            chapterUrl: chapter.url,
                            sourceKey: state.sourceId,
                            adminFbId: fbId,
                            customMessage: postMessage
                        });

                        this.sessions.set(fbId, { step: 'DEV_MENU' });
                    } else {
                        await sendMessage(fbId, { text: "❌ رقم فصل غير صحيح." });
                    }
                    break;

                default:
                    this.sessions.set(fbId, { step: 'CHOOSING_ROLE' });
                    await sendMessage(fbId, { text: "🐺 مرحباً بك! أرسل 'مرحبا' للبدء." });
            }
        } catch (error) {
            logger.error(`[ChatService] Error handling message: ${error.message}`);
            await sendMessage(fbId, { text: "⚠️ حدث خطأ داخلي. يرجى المحاولة مرة أخرى بإرسال 'مرحبا'." });
            this.sessions.set(fbId, { step: 'START' });
        }
    }
}

export default new ChatService();
