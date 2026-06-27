# -*- coding: utf-8 -*-

"""
bot/handlers.py

يتعامل مع الأوامر الواردة من المستخدم ويوجهها إلى الوظائف المناسبة.
يفصل بين أوامر المطور (تحتاج كلمة سر) وأوامر المستخدم العادي.

═══════════════════════════════════════════════════════════════
🔐 أوامر المطور (تحتاج تسجيل دخول بكلمة السر):
═══════════════════════════════════════════════════════════════
  - chaouni_x_2013-2     : تسجيل دخول المطور + تشغيل وضع النشر
  - publish <موقع> <اسم> : نشر مباشر
  - cleanup <id>          : حذف بيانات مانغا
  - refresh <id>          : تحديث فصول يدوياً
  - ban <user_id>         : حظر مستخدم
  - unban <user_id>       : إلغاء حظر
  - broadcast <رسالة>     : إرسال رسالة لجميع المتابعين
  - scheduler_status      : حالة المجدول
  - force_check           : فحص فوري للفصول الجديدة
  - set_interval <ساعات>  : تغيير فترة التحقق
  - logs                  : سجل العمليات
  - export                : تصدير قاعدة البيانات
  - reset_db              : إعادة تعيين قاعدة البيانات
  - banned_list           : قائمة المحظورين

═══════════════════════════════════════════════════════════════
👤 أوامر المستخدم العادي (متاحة للجميع):
═══════════════════════════════════════════════════════════════
  - search <اسم>         : البحث عن مانغا منشورة
  - follow <اسم>         : متابعة عمل
  - unfollow <اسم>       : إلغاء متابعة
  - mylist               : قائمة متابعاتي
  - notifications        : إشعاراتي
  - latest               : آخر الأعمال المنشورة
  - popular              : الأعمال الأكثر متابعة
  - info <اسم>           : معلومات تفصيلية عن عمل
  - random               : اقتراح عمل عشوائي
  - rate <اسم> <1-5>     : تقييم عمل
  - review <اسم>         : كتابة مراجعة
  - reviews <اسم>        : عرض مراجعات عمل
  - readlater <اسم>      : إضافة لقائمة "اقرأ لاحقاً"
  - myreads              : قائمة "اقرأ لاحقاً"
  - recommend            : توصيات مخصصة لك
  - mystats              : إحصائيات قراءتي
  - top                  : أعلى الأعمال تقييماً
  - browse <موقع>        : تصفح أحدث الأعمال
  - help                 : المساعدة
  - about                : معلومات عن البوت
═══════════════════════════════════════════════════════════════
"""

import os
import json
import shutil
from datetime import datetime

from bot.core import OkamiBotCore
from scrapers import SUPPORTED_SCRAPERS
from database.db import (
    get_storage_stats, get_all_manga, cleanup_manga_after_publish,
    get_manga, get_published_chapters_for_manga, get_manga_by_title
)
from database.notifications import (
    init_notifications_db, follow_manga, unfollow_manga,
    get_user_follows, get_pending_notifications,
    mark_all_notifications_sent, get_notification_stats
)
from database.users import (
    init_users_db, add_review, get_manga_reviews, get_manga_average_rating,
    get_top_rated_manga, add_to_read_later, remove_from_read_later,
    mark_as_read, get_read_later_list, get_recommendations, get_random_manga,
    get_user_reading_stats, ban_user, unban_user, is_user_banned,
    get_banned_users, log_activity, get_recent_logs, clear_logs,
    save_broadcast, get_popular_manga
)

# ═══════════════════════════════════════════════════════════════
# 🔧 تهيئة
# ═══════════════════════════════════════════════════════════════

# تهيئة نواة البوت وقواعد البيانات
bot_core = OkamiBotCore()
init_notifications_db()
init_users_db()

# معرف المستخدم الحالي (للوضع المحلي)
CURRENT_USER = os.environ.get("ADMIN_USER_ID", "admin")

# كلمة سر المطور (من config.env أو افتراضية)
DEVELOPER_PASSWORD = os.environ.get("DEVELOPER_PASSWORD", "chaouni_x_2013-2")

# حالة تسجيل دخول المطور (في الجلسة الحالية)
developer_logged_in = False


# ═══════════════════════════════════════════════════════════════
# 🎨 عرض الشعار والبانر
# ═══════════════════════════════════════════════════════════════

def display_banner():
    """
    يعرض شعار البوت عند التشغيل مع تصميم مميز.
    """
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║            ██████╗ ██╗  ██╗ █████╗ ███╗   ███╗██╗                    ║
║           ██╔═══██╗██║ ██╔╝██╔══██╗████╗ ████║██║                    ║
║           ██║   ██║█████╔╝ ███████║██╔████╔██║██║                    ║
║           ██║   ██║██╔═██╗ ██╔══██║██║╚██╔╝██║██║                    ║
║           ╚██████╔╝██║  ██╗██║  ██║██║ ╚═╝ ██║██║                    ║
║            ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝                    ║
║                                                                       ║
║                  🐺 Okami Bot v3.0 - بوت أوكامي 🐺                   ║
║            لنشر المانغا والمانهوا على فيسبوك تلقائياً                ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║  📋 الأوامر السريعة:                                                 ║
║     • search <اسم>     ← البحث عن مانغا                             ║
║     • follow <اسم>     ← متابعة عمل                                 ║
║     • recommend        ← توصيات مخصصة لك                            ║
║     • random           ← اقتراح عمل عشوائي                          ║
║     • popular          ← الأكثر شعبية                                ║
║     • help             ← جميع الأوامر                                ║
║                                                                       ║
║  🔐 للمطور: أدخل كلمة السر لفتح أوامر النشر والإدارة                ║
╚═══════════════════════════════════════════════════════════════════════╝
""")


def display_supported_scrapers():
    """
    يعرض قائمة بالمواقع المدعومة بتصميم جميل.
    """
    print("\n╔═══════════════════════════════════════════════════════════════╗")
    print("║              🌐 المواقع المدعومة للنشر 🌐                   ║")
    print("╠═══════════════════════════════════════════════════════════════╣")
    for i, scraper_name in enumerate(SUPPORTED_SCRAPERS.keys(), 1):
        print(f"║   {i}. 📚 {scraper_name}")
    print("╚═══════════════════════════════════════════════════════════════╝\n")


# ═══════════════════════════════════════════════════════════════
# 🔐 التحقق من صلاحيات المطور
# ═══════════════════════════════════════════════════════════════

def check_developer_access():
    """
    يتحقق مما إذا كان المطور مسجل الدخول.
    """
    global developer_logged_in
    if not developer_logged_in:
        print("🔒 هذا الأمر متاح للمطور فقط.")
        print("   💡 أدخل كلمة سر المطور أولاً لفتح أوامر الإدارة.")
        return False
    return True


def handle_developer_login():
    """
    يسجل دخول المطور ويفتح أوامر الإدارة والنشر.
    """
    global developer_logged_in
    developer_logged_in = True
    log_activity("developer_login", CURRENT_USER, "تسجيل دخول المطور")
    print("""
╔═══════════════════════════════════════════════════════════════╗
║ 🔓 تم تسجيل دخول المطور بنجاح!                             ║
╠═══════════════════════════════════════════════════════════════╣
║ 🎛️ الأوامر المتاحة الآن:                                    ║
║                                                               ║
║ 📌 النشر:                                                    ║
║   • publish <موقع> <اسم>  - نشر مباشر                       ║
║   • force_check            - فحص فوري للفصول الجديدة        ║
║   • refresh <id>           - تحديث فصول يدوياً              ║
║                                                               ║
║ 🛡️ الإدارة:                                                  ║
║   • ban <user_id> <سبب>   - حظر مستخدم                      ║
║   • unban <user_id>        - إلغاء حظر                      ║
║   • banned_list            - قائمة المحظورين                 ║
║   • broadcast <رسالة>      - رسالة جماعية                   ║
║                                                               ║
║ ⚙️ النظام:                                                   ║
║   • scheduler_status       - حالة المجدول                   ║
║   • set_interval <ساعات>   - تغيير فترة التحقق             ║
║   • cleanup <id>           - حذف بيانات مانغا               ║
║   • logs                   - سجل العمليات                   ║
║   • export                 - تصدير البيانات                  ║
║   • reset_db               - إعادة تعيين (⚠️ خطير)          ║
║   • stats                  - إحصائيات شاملة                 ║
╚═══════════════════════════════════════════════════════════════╝
""")
    # بدء وضع النشر التفاعلي
    try:
        start_publish = input("🚀 هل تريد بدء وضع النشر الآن؟ (y/n): ").strip().lower()
        if start_publish == 'y':
            handle_publish_command()
    except (KeyboardInterrupt, EOFError):
        pass


# ═══════════════════════════════════════════════════════════════
# 🔐 أوامر المطور
# ═══════════════════════════════════════════════════════════════

def handle_publish_command():
    """
    يتعامل مع أمر النشر التفاعلي (للمطور فقط).
    """
    display_supported_scrapers()
    while True:
        try:
            choice = input("🔢 اختر رقم الموقع: ").strip()
            scraper_names = list(SUPPORTED_SCRAPERS.keys())
            selected_index = int(choice) - 1
            if 0 <= selected_index < len(scraper_names):
                selected_scraper_name = scraper_names[selected_index]
                print(f"\n✅ تم اختيار: {selected_scraper_name}")
                break
            else:
                print("❌ رقم غير صالح.")
        except ValueError:
            print("❌ أدخل رقماً صحيحاً.")
        except (KeyboardInterrupt, EOFError):
            print("\n⚠️ تم الإلغاء.")
            return

    try:
        manga_query = input(f"\n📝 اسم المانغا/المانهوا: ").strip()
        if not manga_query:
            print("❌ لم يتم إدخال اسم.")
            return
    except (KeyboardInterrupt, EOFError):
        print("\n⚠️ تم الإلغاء.")
        return

    print(f"\n🚀 بدء النشر: '{manga_query}' من {selected_scraper_name}...")
    print("═" * 60 + "\n")
    log_activity("publish_start", CURRENT_USER, f"نشر '{manga_query}' من {selected_scraper_name}")
    bot_core.publish_new_manga(selected_scraper_name, manga_query)
    print("\n" + "═" * 60)
    print("✅ اكتملت عملية النشر.")
    print("═" * 60 + "\n")


def handle_direct_publish(args):
    """
    نشر مباشر (للمطور فقط).
    """
    if not check_developer_access():
        return

    parts = args.split(" ", 1)
    if len(parts) < 2:
        print("❌ الاستخدام: publish <اسم_الموقع> <اسم_المانغا>")
        print("   مثال: publish teamx سولو ليفلنج")
        return

    scraper_name = parts[0].strip()
    manga_query = parts[1].strip()

    matched_scraper = None
    for name in SUPPORTED_SCRAPERS.keys():
        if scraper_name.lower() in name.lower():
            matched_scraper = name
            break

    if not matched_scraper:
        print(f"❌ الموقع '{scraper_name}' غير مدعوم.")
        display_supported_scrapers()
        return

    print(f"🚀 نشر مباشر: '{manga_query}' من {matched_scraper}")
    log_activity("publish_direct", CURRENT_USER, f"نشر مباشر '{manga_query}' من {matched_scraper}")
    bot_core.publish_new_manga(matched_scraper, manga_query)


def handle_ban_command(args):
    """
    حظر مستخدم (للمطور فقط).
    """
    if not check_developer_access():
        return

    parts = args.split(" ", 1)
    user_id = parts[0].strip()
    reason = parts[1].strip() if len(parts) > 1 else "مخالفة القوانين"

    if not user_id:
        print("❌ الاستخدام: ban <user_id> <سبب>")
        return

    if ban_user(user_id, reason, CURRENT_USER):
        print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 🚫 تم حظر المستخدم                                          ║
╠═══════════════════════════════════════════════════════════════╣
║ 👤 المستخدم: {user_id}
║ 📝 السبب: {reason}
║ 📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
╚═══════════════════════════════════════════════════════════════╝
""")
    else:
        print(f"⚠️ المستخدم '{user_id}' محظور بالفعل.")


def handle_unban_command(args):
    """
    إلغاء حظر مستخدم (للمطور فقط).
    """
    if not check_developer_access():
        return

    if not args:
        print("❌ الاستخدام: unban <user_id>")
        return

    if unban_user(args.strip()):
        print(f"✅ تم رفع الحظر عن '{args.strip()}'.")
    else:
        print(f"⚠️ المستخدم '{args.strip()}' غير محظور.")


def handle_banned_list_command():
    """
    عرض قائمة المحظورين (للمطور فقط).
    """
    if not check_developer_access():
        return

    banned = get_banned_users()
    if not banned:
        print("✅ لا يوجد مستخدمون محظورون.")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 🚫 المستخدمون المحظورون ({len(banned)})")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for user in banned:
        print(f"║ 👤 {user['user_id']}")
        print(f"║    📝 السبب: {user['reason']}")
        print(f"║    📅 التاريخ: {user['banned_at']}")
        print(f"║ ─────────────────────────────────────────────────────────")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_broadcast_command(message):
    """
    إرسال رسالة جماعية (للمطور فقط).
    """
    if not check_developer_access():
        return

    if not message:
        print("❌ الاستخدام: broadcast <الرسالة>")
        return

    recipients = save_broadcast(message, CURRENT_USER)
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 📢 تم إرسال الرسالة الجماعية                                ║
╠═══════════════════════════════════════════════════════════════╣
║ 📝 الرسالة: {message[:50]}{'...' if len(message) > 50 else ''}
║ 👥 المستلمون: {recipients} مستخدم
║ 📅 التاريخ: {datetime.now().strftime('%Y-%m-%d %H:%M')}
╚═══════════════════════════════════════════════════════════════╝
""")


def handle_scheduler_status_command():
    """
    عرض حالة المجدول (للمطور فقط).
    """
    if not check_developer_access():
        return

    interval = os.environ.get("CHECK_INTERVAL_HOURS", "1")
    ongoing_manga = get_all_manga(is_ongoing=True)

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ ⏰ حالة المجدول                                              ║
╠═══════════════════════════════════════════════════════════════╣
║ 🟢 الحالة: يعمل
║ ⏱️ فترة التحقق: كل {interval} ساعة
║ 📚 أعمال مستمرة قيد المتابعة: {len(ongoing_manga)}
║ 📅 آخر تحقق: {datetime.now().strftime('%Y-%m-%d %H:%M')}
╠═══════════════════════════════════════════════════════════════╣
║ 📋 الأعمال المتابعة:
""")
    for i, manga in enumerate(ongoing_manga[:10], 1):
        print(f"║   {i}. {manga['title']}")
    if len(ongoing_manga) > 10:
        print(f"║   ... و {len(ongoing_manga) - 10} أعمال أخرى")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_force_check_command():
    """
    فحص فوري للفصول الجديدة (للمطور فقط).
    """
    if not check_developer_access():
        return

    print("🔄 بدء الفحص الفوري للفصول الجديدة...")
    log_activity("force_check", CURRENT_USER, "فحص فوري يدوي")

    ongoing_manga = get_all_manga(is_ongoing=True)
    if not ongoing_manga:
        print("📭 لا توجد أعمال مستمرة للتحقق منها.")
        return

    for manga in ongoing_manga:
        print(f"   🔍 التحقق من: {manga['title']}...")
        try:
            bot_core.publish_new_chapters_for_manga(manga["id"], manga["scraper_name"])
        except Exception as e:
            print(f"   ❌ خطأ: {e}")

    print("✅ اكتمل الفحص الفوري.")


def handle_set_interval_command(args):
    """
    تغيير فترة التحقق من الفصول (للمطور فقط).
    """
    if not check_developer_access():
        return

    try:
        hours = float(args)
        if hours < 0.5:
            print("❌ الحد الأدنى هو 0.5 ساعة (30 دقيقة).")
            return
        os.environ["CHECK_INTERVAL_HOURS"] = str(hours)
        log_activity("set_interval", CURRENT_USER, f"تغيير الفترة إلى {hours} ساعة")
        print(f"✅ تم تغيير فترة التحقق إلى {hours} ساعة.")
        print("   ⚠️ ملاحظة: يتطلب إعادة تشغيل البوت لتطبيق التغيير على المجدول.")
    except ValueError:
        print("❌ أدخل رقماً صحيحاً (مثال: set_interval 2)")


def handle_logs_command():
    """
    عرض سجل العمليات (للمطور فقط).
    """
    if not check_developer_access():
        return

    logs = get_recent_logs(25)
    if not logs:
        print("📭 سجل العمليات فارغ.")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 📝 سجل العمليات (آخر {len(logs)} عملية)")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for log in logs:
        icon = "🔧" if log["action"].startswith("dev") else "👤" if log["user_id"] != "system" else "⚙️"
        print(f"║ {icon} [{log['timestamp']}] {log['action']}")
        if log["details"]:
            print(f"║    └─ {log['details']}")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")

    try:
        clear = input("🗑️ مسح السجل؟ (y/n): ").strip().lower()
        if clear == 'y':
            clear_logs()
            print("✅ تم مسح السجل.")
    except (KeyboardInterrupt, EOFError):
        pass


def handle_reset_db_command():
    """
    إعادة تعيين قاعدة البيانات (للمطور فقط - خطير!).
    """
    if not check_developer_access():
        return

    print("\n⚠️ ═══════════════════════════════════════════════════════════")
    print("⚠️  تحذير! هذا سيحذف جميع البيانات نهائياً!")
    print("⚠️ ═══════════════════════════════════════════════════════════\n")

    try:
        confirm1 = input("⚠️ هل أنت متأكد؟ اكتب 'DELETE ALL': ").strip()
        if confirm1 != "DELETE ALL":
            print("⚠️ تم الإلغاء.")
            return

        # حذف قاعدة البيانات
        db_path = "okami_bot.db"
        if os.path.exists(db_path):
            os.remove(db_path)
            print("🗑️ تم حذف قاعدة البيانات.")

        # إعادة التهيئة
        from database.db import init_db
        init_db()
        init_notifications_db()
        init_users_db()
        log_activity("reset_db", CURRENT_USER, "إعادة تعيين قاعدة البيانات")
        print("✅ تم إعادة تعيين قاعدة البيانات بنجاح.")
    except (KeyboardInterrupt, EOFError):
        print("\n⚠️ تم الإلغاء.")


def handle_cleanup_command(manga_id_str):
    """
    حذف بيانات مانغا (للمطور فقط).
    """
    if not check_developer_access():
        return

    try:
        manga_id = int(manga_id_str)
        manga = get_manga(manga_id)
        if not manga:
            print(f"❌ لم يتم العثور على مانغا بالمعرف {manga_id}.")
            return

        print(f"\n🗑️ حذف بيانات: {manga['title']} (ID={manga_id})")
        confirm = input("⚠️ هل أنت متأكد؟ (y/n): ").strip().lower()
        if confirm == 'y':
            cleanup_manga_after_publish(manga_id)
            log_activity("cleanup", CURRENT_USER, f"حذف بيانات '{manga['title']}'")
            print("✅ تم الحذف. تم الاحتفاظ برابط المنشور التجميعي فقط.")
        else:
            print("⚠️ تم الإلغاء.")
    except ValueError:
        print("❌ أدخل معرفاً رقمياً صحيحاً.")


def handle_refresh_command(manga_id_str):
    """
    تحديث فصول مانغا يدوياً (للمطور فقط).
    """
    if not check_developer_access():
        return

    try:
        manga_id = int(manga_id_str)
        manga = get_manga(manga_id)
        if not manga:
            print(f"❌ لم يتم العثور على مانغا بالمعرف {manga_id}.")
            return

        print(f"🔄 تحديث فصول: {manga['title']}...")
        log_activity("refresh", CURRENT_USER, f"تحديث '{manga['title']}'")
        bot_core.publish_new_chapters_for_manga(manga_id, manga['scraper_name'])
    except ValueError:
        print("❌ أدخل معرفاً رقمياً صحيحاً.")


def handle_export_command():
    """
    تصدير قاعدة البيانات (للمطور فقط).
    """
    if not check_developer_access():
        return

    all_manga = get_all_manga()
    export_data = {
        "exported_at": datetime.now().isoformat(),
        "bot_name": "Okami Bot 🐺",
        "version": "3.0.0",
        "manga_count": len(all_manga),
        "manga": []
    }

    for manga in all_manga:
        chapters = get_published_chapters_for_manga(manga["id"])
        export_data["manga"].append({
            "title": manga["title"],
            "scraper": manga["scraper_name"],
            "compilation_url": manga.get("compilation_post_url", ""),
            "is_ongoing": manga["is_ongoing"],
            "chapters": chapters
        })

    export_path = "okami_export.json"
    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)

    log_activity("export", CURRENT_USER, f"تصدير {len(all_manga)} عمل")
    print(f"✅ تم تصدير قاعدة البيانات إلى: {export_path}")
    print(f"   📊 عدد الأعمال: {len(all_manga)}")


# ═══════════════════════════════════════════════════════════════
# 👤 أوامر المستخدم العادي
# ═══════════════════════════════════════════════════════════════

def handle_search_command(manga_title_query):
    """
    البحث عن مانغا منشورة.
    """
    if not manga_title_query:
        print("❌ الاستخدام: search <اسم المانغا>")
        return

    print(f"\n🔍 البحث عن '{manga_title_query}'...")
    result_link = bot_core.search_manga_for_user(manga_title_query)
    if result_link:
        # جلب معلومات إضافية
        manga_data = get_manga_by_title(manga_title_query)
        rating = get_manga_average_rating(manga_title_query)

        print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 🔍 نتيجة البحث                                              ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 العمل: {manga_data['title'] if manga_data else manga_title_query}
║ 🔗 الرابط: {result_link}
║ ⭐ التقييم: {'⭐' * int(rating['average'])} ({rating['average']}/5 - {rating['count']} تقييم)
║                                                               ║
║ 💡 أوامر مفيدة:                                              ║
║   • follow {manga_title_query} ← متابعة                     ║
║   • rate {manga_title_query} 5 ← تقييم                      ║
║   • info {manga_title_query}   ← معلومات أكثر               ║
╚═══════════════════════════════════════════════════════════════╝
""")
    else:
        print(f"❌ لم يتم العثور على '{manga_title_query}' في قاعدة البيانات.")
        print(f"   💡 جرب: browse <موقع> لتصفح الأعمال المتاحة")


def handle_browse_command(scraper_name_query):
    """
    تصفح أحدث الأعمال على موقع.
    """
    if not scraper_name_query:
        display_supported_scrapers()
        return

    matched_scraper = None
    for name in SUPPORTED_SCRAPERS.keys():
        if scraper_name_query.lower() in name.lower():
            matched_scraper = name
            break

    if not matched_scraper:
        print(f"❌ الموقع '{scraper_name_query}' غير مدعوم.")
        display_supported_scrapers()
        return

    print(f"\n🌐 تصفح أحدث الأعمال على {matched_scraper}...")
    scraper_class = SUPPORTED_SCRAPERS[matched_scraper]
    scraper = scraper_class()

    try:
        latest = scraper.get_latest_updates()
        if latest:
            print(f"\n╔═══════════════════════════════════════════════════════════════╗")
            print(f"║ 📰 أحدث الأعمال على {matched_scraper}")
            print(f"╠═══════════════════════════════════════════════════════════════╣")
            for i, item in enumerate(latest[:15], 1):
                title = item.get("title", "بدون عنوان")
                chapter = item.get("latest_chapter", "")
                print(f"║ {i:2}. 📖 {title}")
                if chapter:
                    print(f"║     └─ آخر فصل: {chapter}")
            print(f"╚═══════════════════════════════════════════════════════════════╝\n")
        else:
            print("⚠️ لم يتم العثور على تحديثات.")
    except Exception as e:
        print(f"❌ خطأ في التصفح: {e}")


def handle_follow_command(manga_title):
    """
    متابعة عمل لتلقي إشعارات.
    """
    if not manga_title:
        print("❌ الاستخدام: follow <اسم المانغا>")
        return

    result = follow_manga(CURRENT_USER, manga_title)
    if result:
        print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ ✅ تمت المتابعة بنجاح!                                      ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 العمل: {manga_title}
║ 🔔 ستتلقى إشعاراً عند نشر كل فصل جديد
║ 💡 لإلغاء المتابعة: unfollow {manga_title}
╚═══════════════════════════════════════════════════════════════╝
""")
    else:
        print(f"ℹ️ أنت تتابع '{manga_title}' بالفعل. تم إعادة تفعيل المتابعة.")


def handle_unfollow_command(manga_title):
    """
    إلغاء متابعة عمل.
    """
    if not manga_title:
        print("❌ الاستخدام: unfollow <اسم المانغا>")
        return

    result = unfollow_manga(CURRENT_USER, manga_title)
    if result:
        print(f"✅ تم إلغاء متابعة '{manga_title}'.")
    else:
        print(f"⚠️ أنت لا تتابع '{manga_title}'.")


def handle_mylist_command():
    """
    عرض قائمة المتابعات.
    """
    follows = get_user_follows(CURRENT_USER)
    if not follows:
        print("""
╔═══════════════════════════════════════════════════════════════╗
║ 📭 قائمة المتابعة فارغة                                     ║
║ 💡 لمتابعة عمل: follow <اسم المانغا>                        ║
╚═══════════════════════════════════════════════════════════════╝
""")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 📋 قائمة متابعاتك ({len(follows)} عمل)")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for i, (title, date) in enumerate(follows, 1):
        print(f"║ {i:2}. 📚 {title}")
        print(f"║     └─ منذ: {date}")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_notifications_command():
    """
    عرض الإشعارات الجديدة.
    """
    notifications = get_pending_notifications(CURRENT_USER)
    if not notifications:
        print("✅ لا توجد إشعارات جديدة. 🎉")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 🔔 إشعارات جديدة ({len(notifications)})")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for notif in notifications:
        print(f"║ 📚 {notif['manga_title']} - {notif['chapter_title']}")
        if notif['facebook_post_url']:
            print(f"║ 🔗 {notif['facebook_post_url']}")
        print(f"║ 📅 {notif['created_at']}")
        print(f"║ ─────────────────────────────────────────────────────────")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")

    try:
        mark_read = input("📖 تعليم الكل كمقروء؟ (y/n): ").strip().lower()
        if mark_read == 'y':
            mark_all_notifications_sent(CURRENT_USER)
            print("✅ تم تعليم جميع الإشعارات كمقروءة.")
    except (KeyboardInterrupt, EOFError):
        pass


def handle_latest_command():
    """
    عرض آخر الأعمال المنشورة.
    """
    all_manga = get_all_manga()
    if not all_manga:
        print("📭 لا توجد أعمال منشورة بعد.")
        return

    # ترتيب حسب الأحدث (آخر 10)
    recent = all_manga[-10:]
    recent.reverse()

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 🆕 آخر الأعمال المنشورة")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for i, manga in enumerate(recent, 1):
        status = "✅" if manga.get("is_fully_published") else "🔄"
        link = manga.get("compilation_post_url", "—")
        print(f"║ {i:2}. {status} {manga['title']}")
        if link and link != "—":
            print(f"║     └─ 🔗 {link}")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_popular_command():
    """
    عرض الأعمال الأكثر متابعة.
    """
    popular = get_popular_manga(10)
    if not popular:
        print("📭 لا توجد بيانات كافية بعد.")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 🔥 الأعمال الأكثر شعبية")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for i, item in enumerate(popular, 1):
        bar = "█" * min(item['followers'], 20)
        print(f"║ {i:2}. 📚 {item['title']}")
        print(f"║     └─ 👥 {item['followers']} متابع {bar}")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_info_command(manga_title):
    """
    عرض معلومات تفصيلية عن عمل.
    """
    if not manga_title:
        print("❌ الاستخدام: info <اسم المانغا>")
        return

    manga_data = get_manga_by_title(manga_title)
    if not manga_data:
        print(f"❌ لم يتم العثور على '{manga_title}'.")
        return

    rating = get_manga_average_rating(manga_title)
    reviews = get_manga_reviews(manga_title)

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 📖 معلومات العمل                                            ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 العنوان: {manga_data['title']}
║ 🌐 المصدر: {manga_data['scraper_name']}
║ 📌 الحالة: {'مستمر 🔄' if manga_data['is_ongoing'] else 'مكتمل ✅'}
║ 📖 الفصول: {manga_data.get('total_chapters', 0)} فصل
║ ⭐ التقييم: {'⭐' * int(rating['average'])} ({rating['average']}/5 - {rating['count']} تقييم)
║ 🔗 المنشور: {manga_data.get('compilation_post_url', '—')}
║ 📝 الوصف: {(manga_data.get('description', '') or 'غير متوفر')[:80]}
╠═══════════════════════════════════════════════════════════════╣
║ 💬 آخر المراجعات:""")
    if reviews:
        for rev in reviews[:3]:
            stars = "⭐" * rev['rating']
            print(f"║   {stars} - {rev.get('review_text', '')[:40]}")
    else:
        print(f"║   لا توجد مراجعات بعد. كن أول من يراجع!")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_random_command():
    """
    اقتراح عمل عشوائي.
    """
    manga = get_random_manga()
    if not manga:
        print("📭 لا توجد أعمال في قاعدة البيانات بعد.")
        return

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 🎲 اقتراح عشوائي لك!                                        ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 {manga['title']}
║ 📝 {(manga.get('description') or 'بدون وصف')[:60]}
║ 🔗 {manga.get('url') or '—'}
╠═══════════════════════════════════════════════════════════════╣
║ 💡 أعجبك؟ جرب:                                              ║
║   • follow {manga['title']}                                  ║
║   • rate {manga['title']} 5                                  ║
╚═══════════════════════════════════════════════════════════════╝
""")


def handle_rate_command(args):
    """
    تقييم عمل (1-5 نجوم).
    الاستخدام: rate <اسم> <1-5>
    """
    if not args:
        print("❌ الاستخدام: rate <اسم المانغا> <1-5>")
        print("   مثال: rate سولو ليفلنج 5")
        return

    # استخراج التقييم (آخر رقم)
    parts = args.rsplit(" ", 1)
    if len(parts) < 2 or not parts[1].isdigit():
        print("❌ الاستخدام: rate <اسم المانغا> <1-5>")
        return

    manga_title = parts[0].strip()
    rating = int(parts[1])

    if rating < 1 or rating > 5:
        print("❌ التقييم يجب أن يكون بين 1 و 5.")
        return

    is_new = add_review(CURRENT_USER, manga_title, rating)
    stars = "⭐" * rating
    if is_new:
        print(f"✅ تم تقييم '{manga_title}' بـ {stars} ({rating}/5)")
    else:
        print(f"✅ تم تحديث تقييم '{manga_title}' إلى {stars} ({rating}/5)")


def handle_review_command(manga_title):
    """
    كتابة مراجعة لعمل.
    """
    if not manga_title:
        print("❌ الاستخدام: review <اسم المانغا>")
        return

    try:
        rating_str = input(f"⭐ تقييمك لـ '{manga_title}' (1-5): ").strip()
        rating = int(rating_str)
        if rating < 1 or rating > 5:
            print("❌ التقييم يجب أن يكون بين 1 و 5.")
            return

        review_text = input("📝 اكتب مراجعتك (أو اضغط Enter للتخطي): ").strip()

        add_review(CURRENT_USER, manga_title, rating, review_text)
        print(f"\n✅ تم حفظ مراجعتك لـ '{manga_title}'!")
        print(f"   ⭐ التقييم: {'⭐' * rating}")
        if review_text:
            print(f"   📝 المراجعة: {review_text}")
    except (ValueError, KeyboardInterrupt, EOFError):
        print("\n⚠️ تم الإلغاء.")


def handle_reviews_command(manga_title):
    """
    عرض مراجعات عمل.
    """
    if not manga_title:
        print("❌ الاستخدام: reviews <اسم المانغا>")
        return

    reviews = get_manga_reviews(manga_title)
    rating = get_manga_average_rating(manga_title)

    if not reviews:
        print(f"📭 لا توجد مراجعات لـ '{manga_title}' بعد.")
        print(f"   💡 كن أول من يراجع: review {manga_title}")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 💬 مراجعات: {manga_title}")
    print(f"║ ⭐ المتوسط: {rating['average']}/5 ({rating['count']} تقييم)")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for rev in reviews[:10]:
        stars = "⭐" * rev['rating']
        print(f"║ {stars} - بواسطة {rev['user_id']}")
        if rev['review_text']:
            print(f"║   📝 {rev['review_text'][:60]}")
        print(f"║   📅 {rev['created_at']}")
        print(f"║ ─────────────────────────────────────────────────────────")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_readlater_command(manga_title):
    """
    إضافة عمل لقائمة "اقرأ لاحقاً".
    """
    if not manga_title:
        print("❌ الاستخدام: readlater <اسم المانغا>")
        return

    if add_to_read_later(CURRENT_USER, manga_title):
        print(f"✅ تمت إضافة '{manga_title}' لقائمة 'اقرأ لاحقاً' 📖")
        print(f"   💡 لعرض القائمة: myreads")
    else:
        print(f"ℹ️ '{manga_title}' موجود بالفعل في قائمتك.")


def handle_myreads_command():
    """
    عرض قائمة "اقرأ لاحقاً".
    """
    items = get_read_later_list(CURRENT_USER)
    if not items:
        print("""
╔═══════════════════════════════════════════════════════════════╗
║ 📖 قائمة "اقرأ لاحقاً" فارغة                               ║
║ 💡 لإضافة عمل: readlater <اسم المانغا>                      ║
╚═══════════════════════════════════════════════════════════════╝
""")
        return

    unread = [i for i in items if not i['is_read']]
    read = [i for i in items if i['is_read']]

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 📖 قائمة 'اقرأ لاحقاً' ({len(unread)} غير مقروء / {len(read)} مقروء)")
    print(f"╠═══════════════════════════════════════════════════════════════╣")

    if unread:
        print(f"║ 📌 غير مقروء:")
        for i, item in enumerate(unread, 1):
            print(f"║   {i}. 📚 {item['title']}")
            print(f"║      └─ أُضيف: {item['added_at']}")

    if read:
        print(f"║")
        print(f"║ ✅ تمت قراءته:")
        for item in read[:5]:
            print(f"║   ✓ {item['title']}")

    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_recommend_command():
    """
    توصيات مخصصة بناءً على متابعات المستخدم.
    """
    recommendations = get_recommendations(CURRENT_USER, 5)
    if not recommendations:
        print("📭 لا توجد توصيات كافية بعد.")
        print("   💡 تابع بعض الأعمال أولاً: follow <اسم>")
        return

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 🎯 توصيات مخصصة لك                                          ║
╠═══════════════════════════════════════════════════════════════╣""")
    for i, rec in enumerate(recommendations, 1):
        print(f"║ {i}. 📚 {rec['title']}")
        print(f"║    └─ 💡 {rec.get('reason', '')}")
    print(f"""╠═══════════════════════════════════════════════════════════════╣
║ 💡 لمتابعة أي عمل: follow <اسم>                             ║
║ 🎲 لاقتراح عشوائي: random                                   ║
╚═══════════════════════════════════════════════════════════════╝
""")


def handle_mystats_command():
    """
    إحصائيات القراءة الشخصية.
    """
    stats = get_user_reading_stats(CURRENT_USER)
    follows = get_user_follows(CURRENT_USER)

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ 📊 إحصائياتك الشخصية                                        ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 أعمال متابعة:        {len(follows)}
║ 📖 فصول مقروءة:         {stats['total_chapters_read']}
║ 📕 أعمال مكتملة:        {stats['completed_manga']}
║ 📚 إجمالي الأعمال:      {stats['total_manga']}""")
    if stats['last_read']:
        print(f"║ 🕐 آخر قراءة:           {stats['last_read']['title']}")
        print(f"║    └─ الفصل: {stats['last_read']['chapter']}")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_top_command():
    """
    أعلى الأعمال تقييماً.
    """
    top = get_top_rated_manga(10)
    if not top:
        print("📭 لا توجد تقييمات كافية بعد.")
        print("   💡 قيّم عملاً: rate <اسم> <1-5>")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 🏆 أعلى الأعمال تقييماً")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for i, item in enumerate(top, 1):
        stars = "⭐" * int(item['average_rating'])
        print(f"║ {i:2}. {stars} {item['title']}")
        print(f"║     └─ {item['average_rating']}/5 ({item['review_count']} تقييم)")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


# ═══════════════════════════════════════════════════════════════
# 📊 أوامر مشتركة (إحصائيات + معلومات)
# ═══════════════════════════════════════════════════════════════

def handle_stats_command():
    """
    إحصائيات شاملة (للمطور: كاملة، للمستخدم: مختصرة).
    """
    storage_stats = get_storage_stats()
    notif_stats = get_notification_stats()

    if developer_logged_in:
        # إحصائيات كاملة للمطور
        print(f"""
╔═══════════════════════════════════════════════════════════════╗
║              📊 إحصائيات بوت أوكامي (مطور) 📊                ║
╠═══════════════════════════════════════════════════════════════╣
║ 💾 التخزين:                                                  ║
║    📁 ملفات نشطة:         {storage_stats['active_files']}
║    🗑️ ملفات محذوفة:        {storage_stats['deleted_files']}
║    ✅ مانغا مكتملة:         {storage_stats['fully_published_manga']}
║    🔄 مانغا قيد النشر:      {storage_stats['in_progress_manga']}
║    💾 المساحة:             {storage_stats['storage_used_mb']} MB
║                                                               ║
║ 🔔 الإشعارات:                                                ║
║    👥 مستخدمون متابعون:    {notif_stats['total_users']}
║    📚 إجمالي المتابعات:    {notif_stats['total_follows']}
║    📬 إشعارات معلقة:       {notif_stats['pending_notifications']}
║    ✉️ إشعارات مرسلة:       {notif_stats['sent_notifications']}
║                                                               ║
║ 🛡️ النظام:                                                   ║
║    🚫 محظورون:             {len(get_banned_users())}
║    📝 سجلات:              {len(get_recent_logs(100))}
╚═══════════════════════════════════════════════════════════════╝
""")
    else:
        # إحصائيات مختصرة للمستخدم
        all_manga = get_all_manga()
        print(f"""
╔═══════════════════════════════════════════════════════════════╗
║              📊 إحصائيات بوت أوكامي 📊                       ║
╠═══════════════════════════════════════════════════════════════╣
║ 📚 إجمالي الأعمال:        {len(all_manga)}
║ ✅ أعمال مكتملة:           {storage_stats['fully_published_manga']}
║ 🔄 أعمال مستمرة:           {storage_stats['in_progress_manga']}
║ 👥 مستخدمون نشطون:        {notif_stats['total_users']}
║ 📚 إجمالي المتابعات:      {notif_stats['total_follows']}
╚═══════════════════════════════════════════════════════════════╝
""")


def handle_list_command():
    """
    عرض المانغا المحفوظة.
    """
    all_manga = get_all_manga()
    if not all_manga:
        print("📭 لا توجد مانغا محفوظة.")
        return

    print(f"\n╔═══════════════════════════════════════════════════════════════╗")
    print(f"║ 📋 المانغا المحفوظة ({len(all_manga)} عمل)")
    print(f"╠═══════════════════════════════════════════════════════════════╣")
    for manga in all_manga:
        status = "✅" if manga.get("is_fully_published") else "🔄"
        ongoing = "📌 مستمر" if manga.get("is_ongoing") else "📕 مكتمل"
        link = manga.get("compilation_post_url", "—")
        print(f"║ {status} [{manga['id']}] {manga['title']}")
        print(f"║    {ongoing} | 🔗 {link}")
        print(f"║ ─────────────────────────────────────────────────────────")
    print(f"╚═══════════════════════════════════════════════════════════════╝\n")


def handle_about_command():
    """
    معلومات عن البوت.
    """
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                     🐺 Okami Bot - بوت أوكامي 🐺                     ║
║                         الإصدار 3.0.0                                ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  📋 الوصف:                                                           ║
║     بوت بايثون متقدم لنشر المانغا والمانهوا من المواقع العربية       ║
║     على صفحات فيسبوك تلقائياً مع علامة مائية وتصميم مميز.           ║
║                                                                       ║
║  ✨ الميزات:                                                          ║
║     • نشر آلي كامل من 7+ مواقع عربية                                ║
║     • تقسيم ذكي للصور الطويلة بأعلى جودة                            ║
║     • علامة مائية تلقائية "Okami Bot 🐺"                             ║
║     • نظام إشعارات ومتابعة متقدم                                    ║
║     • ⭐ نظام تقييم ومراجعات                                         ║
║     • 📖 قائمة "اقرأ لاحقاً"                                        ║
║     • 🎯 توصيات ذكية مخصصة                                          ║
║     • 📊 إحصائيات قراءة شخصية                                       ║
║     • حذف تلقائي لتوفير المساحة                                     ║
║     • جدولة تلقائية للفصول الأسبوعية                                ║
║     • متوافق مع Replit (24/7)                                        ║
║                                                                       ║
║  🌐 المواقع المدعومة:                                                ║
║     أزورا مون • سوات مانغا • تيم إكس • مانجا العرب                  ║
║     جالاكسي مانجا • مانجا ليك • أريس مانجا                          ║
║                                                                       ║
║  👨‍💻 المطور: Okami Team                                               ║
║  📅 آخر تحديث: 2024                                                  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
""")


def handle_help_command():
    """
    عرض جميع الأوامر المتاحة (حسب مستوى الصلاحية).
    """
    # أوامر المستخدم العادي (دائماً ظاهرة)
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║                       📖 دليل الأوامر 📖                             ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  ═══ 🔍 البحث والتصفح ═══                                           ║
║  search <اسم>           البحث عن مانغا منشورة                       ║
║  browse <موقع>          تصفح أحدث الأعمال على موقع                  ║
║  info <اسم>             معلومات تفصيلية عن عمل                      ║
║  latest                  آخر الأعمال المنشورة                        ║
║  popular                 الأعمال الأكثر شعبية                        ║
║  random                  اقتراح عمل عشوائي 🎲                        ║
║                                                                       ║
║  ═══ 🔔 المتابعة والإشعارات ═══                                     ║
║  follow <اسم>           متابعة عمل (إشعار عند فصل جديد)            ║
║  unfollow <اسم>         إلغاء متابعة                                ║
║  mylist                  قائمة متابعاتك                              ║
║  notifications           إشعاراتك الجديدة                           ║
║                                                                       ║
║  ═══ ⭐ التقييم والمراجعات ═══                                       ║
║  rate <اسم> <1-5>       تقييم عمل                                   ║
║  review <اسم>           كتابة مراجعة                                ║
║  reviews <اسم>          عرض مراجعات عمل                             ║
║  top                     أعلى الأعمال تقييماً 🏆                      ║
║                                                                       ║
║  ═══ 📖 القراءة والتوصيات ═══                                       ║
║  readlater <اسم>        إضافة لقائمة "اقرأ لاحقاً"                 ║
║  myreads                 عرض قائمة القراءة                           ║
║  recommend               توصيات مخصصة لك 🎯                          ║
║  mystats                 إحصائيات قراءتك 📊                          ║
║                                                                       ║
║  ═══ ℹ️ عامة ═══                                                     ║
║  stats                   إحصائيات البوت                              ║
║  list                    عرض جميع الأعمال                            ║
║  about                   معلومات عن البوت                            ║
║  help                    هذه الصفحة                                  ║
║  exit                    الخروج                                      ║
║                                                                       ║""")

    if developer_logged_in:
        print("""║  ═══════════════════════════════════════════════════════════════════  ║
║  🔐 أوامر المطور (مفعّلة):                                          ║
║  publish <موقع> <اسم>   نشر مباشر                                   ║
║  force_check             فحص فوري للفصول الجديدة                    ║
║  refresh <id>            تحديث فصول يدوياً                          ║
║  cleanup <id>            حذف بيانات مانغا                           ║
║  ban <user_id> <سبب>    حظر مستخدم                                  ║
║  unban <user_id>         إلغاء حظر                                  ║
║  banned_list             قائمة المحظورين                             ║
║  broadcast <رسالة>       رسالة جماعية                               ║
║  scheduler_status        حالة المجدول                               ║
║  set_interval <ساعات>    تغيير فترة التحقق                         ║
║  logs                    سجل العمليات                               ║
║  export                  تصدير البيانات                              ║
║  reset_db                إعادة تعيين (⚠️ خطير)                       ║
║                                                                       ║""")
    else:
        print("""║  ═══════════════════════════════════════════════════════════════════  ║
║  🔐 أوامر المطور: أدخل كلمة السر لفتح أوامر النشر والإدارة         ║
║                                                                       ║""")

    print("""╚═══════════════════════════════════════════════════════════════════════╝
""")


# ═══════════════════════════════════════════════════════════════
# 🎯 الموجه الرئيسي للأوامر
# ═══════════════════════════════════════════════════════════════

def handle_command(command_text):
    """
    الدالة الرئيسية لمعالجة الأوامر.
    تحلل النص المدخل وتوجهه للدالة المناسبة.
    تفصل بين أوامر المطور وأوامر المستخدم العادي.
    """
    global developer_logged_in

    command_text = command_text.strip()
    if not command_text:
        return

    # التحقق من الحظر
    if is_user_banned(CURRENT_USER):
        print("🚫 حسابك محظور. تواصل مع المسؤول.")
        return

    # تحليل الأمر والمعاملات
    parts = command_text.split(" ", 1)
    cmd = parts[0].lower()
    args = parts[1].strip() if len(parts) > 1 else ""

    # ═══ تسجيل دخول المطور ═══
    if command_text == DEVELOPER_PASSWORD:
        handle_developer_login()
        return

    # ═══ أوامر المطور (تحتاج تسجيل دخول) ═══
    if cmd == "publish":
        handle_direct_publish(args)
    elif cmd == "ban":
        handle_ban_command(args)
    elif cmd == "unban":
        handle_unban_command(args)
    elif cmd == "banned_list":
        handle_banned_list_command()
    elif cmd == "broadcast":
        handle_broadcast_command(args)
    elif cmd == "scheduler_status":
        handle_scheduler_status_command()
    elif cmd == "force_check":
        handle_force_check_command()
    elif cmd == "set_interval":
        handle_set_interval_command(args)
    elif cmd == "logs":
        handle_logs_command()
    elif cmd == "reset_db":
        handle_reset_db_command()
    elif cmd == "cleanup":
        handle_cleanup_command(args)
    elif cmd == "refresh":
        handle_refresh_command(args)
    elif cmd == "export":
        handle_export_command()

    # ═══ أوامر المستخدم العادي ═══
    elif cmd == "search":
        handle_search_command(args)
    elif cmd == "browse":
        handle_browse_command(args)
    elif cmd == "follow":
        handle_follow_command(args)
    elif cmd == "unfollow":
        handle_unfollow_command(args)
    elif cmd == "mylist":
        handle_mylist_command()
    elif cmd in ("notifications", "notif"):
        handle_notifications_command()
    elif cmd == "latest":
        handle_latest_command()
    elif cmd == "popular":
        handle_popular_command()
    elif cmd == "info":
        handle_info_command(args)
    elif cmd == "random":
        handle_random_command()
    elif cmd == "rate":
        handle_rate_command(args)
    elif cmd == "review":
        handle_review_command(args)
    elif cmd == "reviews":
        handle_reviews_command(args)
    elif cmd == "readlater":
        handle_readlater_command(args)
    elif cmd == "myreads":
        handle_myreads_command()
    elif cmd == "recommend":
        handle_recommend_command()
    elif cmd == "mystats":
        handle_mystats_command()
    elif cmd == "top":
        handle_top_command()

    # ═══ أوامر مشتركة ═══
    elif cmd == "stats":
        handle_stats_command()
    elif cmd == "list":
        handle_list_command()
    elif cmd == "about":
        handle_about_command()
    elif cmd == "help":
        handle_help_command()
    elif cmd in ("exit", "quit", "q"):
        print("\n👋 وداعاً! - Okami Bot 🐺")
        exit(0)

    # ═══ أمر غير معروف ═══
    else:
        print(f"❓ أمر غير معروف: '{cmd}'")
        print("💡 أدخل 'help' لعرض الأوامر المتاحة.")
        print(f"   أو جرب: search {command_text}")
