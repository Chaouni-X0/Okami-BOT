import time
from apscheduler.schedulers.background import BackgroundScheduler
from bot.core import OkamiBotCore
from database.db import get_all_manga

def check_for_new_chapters():
    """
    وظيفة يتم تشغيلها بواسطة المجدول للتحقق من الفصول الجديدة ونشرها.
    """
    print("\n[Scheduler] التحقق من الفصول الجديدة للأعمال المستمرة...")
    bot_core = OkamiBotCore()
    ongoing_manga = get_all_manga(is_ongoing=True)

    for manga in ongoing_manga:
        print(f"[Scheduler] التحقق من المانغا: {manga["title"]}")
        try:
            # هنا نحتاج إلى جلب معلومات المانغا مرة أخرى من الموقع
            # ومقارنة الفصول الموجودة في DB مع الفصول الجديدة
            # ثم نشر الفصول الجديدة فقط.
            # دالة publish_new_chapters_for_manga في bot.core.py تقوم بهذا المنطق.
            bot_core.publish_new_chapters_for_manga(manga["id"], manga["scraper_name"])
        except Exception as e:
            print(f"[Scheduler] خطأ أثناء التحقق من المانغا {manga["title"]}: {e}")
    print("[Scheduler] انتهى التحقق من الفصول الجديدة.")

def start_scheduler():
    """
    يبدأ المجدول للتحقق من الفصول الجديدة بشكل دوري.
    """
    scheduler = BackgroundScheduler()
    # جدولة الوظيفة للتشغيل كل ساعة (يمكن تعديل التردد حسب الحاجة)
    scheduler.add_job(check_for_new_chapters, 'interval', hours=1)
    scheduler.start()
    print("تم بدء المجدول بنجاح. سيتم التحقق من الفصول الجديدة كل ساعة.")

    # لمنع البرنامج من الخروج فوراً إذا كان المجدول يعمل في الخلفية
    # هذا الجزء قد لا يكون ضرورياً إذا كان main.py يحتوي على حلقة لا نهائية أو ينتظر إدخال المستخدم
    # try:
    #     while True:
    #         time.sleep(2)
    # except (KeyboardInterrupt, SystemExit):
    #     scheduler.shutdown()

if __name__ == "__main__":
    # مثال على كيفية بدء المجدول
    print("بدء المجدول للاختبار...")
    start_scheduler()
    print("المجدول يعمل في الخلفية. اضغط Ctrl+C للخروج.")
    try:
        while True:
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        print("تم إيقاف المجدول.")
