import db from '../database/db.js';
import { FacebookPublisher } from '../modules/publisher.js';
import { VisualEngine } from '../modules/visual.js';
import logger from '../utils/logger.js';

export class ContentEngine {
    constructor() {
        this.publisher = new FacebookPublisher();
        this.visual = new VisualEngine();
    }

    // نشر قائمة المتصدرين أسبوعياً
    async publishWeeklyLeaderboard() {
        const topUsers = db.prepare('SELECT fb_id, points, level, rank_title FROM users ORDER BY points DESC LIMIT 5').all();
        
        let message = "👑 أقوى 5 أوتاكو هذا الأسبوع في مجتمع Okami! 👑\n\n";
        topUsers.forEach((user, i) => {
            message += `${i + 1}. ${user.rank_title} (Lvl ${user.level}) - ${user.points} pts\n`;
        });
        message += "\n🔥 هل يمكنك منافستهم؟ تفاعل الآن واصعد في الترتيب!\n✨ تم النشر بواسطة Okami Bot ✨";

        try {
            // مكافأة المركز الأول
            if (topUsers.length > 0) {
                db.prepare('UPDATE users SET points = points + 100 WHERE fb_id = ?').run(topUsers[0].fb_id);
            }
            await this.publisher.publishAggregation({ title: 'Weekly Leaderboard' }, []); // استخدام دالة النشر العامة
            logger.info('Weekly leaderboard published.');
        } catch (error) {
            logger.error(`Failed to publish leaderboard: ${error.message}`);
        }
    }

    // نشر إحصائيات اليوم
    async publishDailyStats() {
        const stats = {
            chapters: db.prepare('SELECT COUNT(*) as count FROM chapters WHERE published_at >= date("now")').get().count,
            interactions: db.prepare('SELECT COUNT(*) as count FROM reading_history WHERE updated_at >= date("now")').get().count,
            newUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= date("now")').get().count
        };

        const message = `
📈 إحصائيات Okami Bot اليوم:
🔥 تم نشر ${stats.chapters} فصول جديدة!
👥 ${stats.interactions} تفاعل قراءة اليوم.
✨ رحبوا بـ ${stats.newUsers} أعضاء جدد في القطيع!

🐺 نحن نكبر بفضلكم! استمروا في الاستمتاع.
        `.trim();

        await this.publisher.publishAggregation({ title: 'Daily Stats' }, []);
    }

    // نظام الردود الذكية (Personality)
    static getPersonalityReply(type) {
        const replies = {
            GREETING: ["مرحباً بك في القطيع! 🐺", "أهلاً بك يا أوتاكو، مستعد للقراءة؟", "أوكامي هنا لخدمتك! 🔥"],
            LEVEL_UP: ["واو! لقد تطورت مهاراتك، مبارك المستوى الجديد! 🏆", "رتبة جديدة؟ أنت مذهل! 🐺", "استمر هكذا وستصبح ملك الأوكامي قريباً! 🔥"],
            INACTIVE: ["أين اختفيت؟ القطيع يفتقدك! 😴", "هناك فصول جديدة بانتظارك، لا تتأخر! 😉"],
            SUCCESS: ["تمت العملية بنجاح! 🐺✅", "كل شيء جاهز، استمتع! 🔥"]
        };
        const list = replies[type] || replies.SUCCESS;
        return list[Math.floor(Math.random() * list.length)];
    }
}
