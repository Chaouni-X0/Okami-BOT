# -*- coding: utf-8 -*-

"""
main.py

نقطة الدخول الرئيسية لبوت أوكامي (Okami Bot) 🐺
يشغل البوت في الوضع التفاعلي (CLI) مع دعم Replit.

═══════════════════════════════════════════════════════════════
الاستخدام:
  python main.py
  
على Replit:
  يتم تشغيله تلقائياً مع Keep-Alive
═══════════════════════════════════════════════════════════════
"""

import os
import sys
import threading
from pathlib import Path
from dotenv import load_dotenv

# ═══════════════════════════════════════════════════════════════
# 📂 تحميل الإعدادات من config.env
# ═══════════════════════════════════════════════════════════════
config_path = Path(__file__).parent / "config.env"
if config_path.exists():
    load_dotenv(config_path)
    print("✅ تم تحميل الإعدادات من config.env")
else:
    print("⚠️ ملف config.env غير موجود! يرجى إنشاؤه.")
    print("   📋 انسخ config.env.example وعدّل القيم.")

# ═══════════════════════════════════════════════════════════════
# 🌐 تشغيل Keep-Alive لـ Replit
# ═══════════════════════════════════════════════════════════════
IS_REPLIT = os.environ.get("REPL_ID") is not None or os.environ.get("REPLIT_KEEP_ALIVE", "false").lower() == "true"

if IS_REPLIT:
    try:
        from keep_alive import keep_alive
        keep_alive()
        print("🌐 Keep-Alive مفعّل (Replit Mode)")
    except ImportError:
        print("⚠️ ملف keep_alive.py غير موجود.")

# ═══════════════════════════════════════════════════════════════
# 🗄️ تهيئة قاعدة البيانات
# ═══════════════════════════════════════════════════════════════
from database.db import init_db
from database.notifications import init_notifications_db
from database.users import init_users_db

init_db()
init_notifications_db()
init_users_db()
print("🗄️ قاعدة البيانات جاهزة.")

# ═══════════════════════════════════════════════════════════════
# ⏰ تشغيل المجدول التلقائي (في خيط منفصل)
# ═══════════════════════════════════════════════════════════════
scheduler_enabled = os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true"

if scheduler_enabled:
    from bot.scheduler import start_scheduler
    scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
    scheduler_thread.start()
    print("⏰ المجدول التلقائي يعمل في الخلفية.")
else:
    print("⏰ المجدول التلقائي معطّل.")

# ═══════════════════════════════════════════════════════════════
# 🎯 الحلقة التفاعلية الرئيسية
# ═══════════════════════════════════════════════════════════════
from bot.handlers import handle_command, display_banner

def main():
    """
    الحلقة الرئيسية للبوت.
    تعرض الشعار ثم تنتظر أوامر المستخدم.
    """
    # عرض الشعار
    display_banner()

    # التحقق من إعدادات فيسبوك
    fb_token = os.environ.get("FACEBOOK_PAGE_ACCESS_TOKEN", "")
    fb_page_id = os.environ.get("FACEBOOK_PAGE_ID", "")

    if not fb_token or fb_token == "your_page_access_token_here":
        print("⚠️ ═══════════════════════════════════════════════════════════")
        print("⚠️  لم يتم تعيين توكن فيسبوك!")
        print("⚠️  عدّل ملف config.env وأضف FACEBOOK_PAGE_ACCESS_TOKEN")
        print("⚠️ ═══════════════════════════════════════════════════════════\n")

    if not fb_page_id or fb_page_id == "your_page_id_here":
        print("⚠️ ═══════════════════════════════════════════════════════════")
        print("⚠️  لم يتم تعيين معرف صفحة فيسبوك!")
        print("⚠️  عدّل ملف config.env وأضف FACEBOOK_PAGE_ID")
        print("⚠️ ═══════════════════════════════════════════════════════════\n")

    print("═" * 65)
    print("🐺 بوت أوكامي جاهز! أدخل أمراً أو اكتب 'help' للمساعدة.")
    print("═" * 65 + "\n")

    # حلقة الأوامر
    while True:
        try:
            user_input = input("🐺 Okami > ").strip()
            if user_input:
                handle_command(user_input)
        except KeyboardInterrupt:
            print("\n\n👋 وداعاً! - Okami Bot 🐺")
            sys.exit(0)
        except EOFError:
            print("\n\n👋 وداعاً! - Okami Bot 🐺")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ خطأ غير متوقع: {e}")
            print("💡 حاول مرة أخرى أو اكتب 'help' للمساعدة.\n")


if __name__ == "__main__":
    main()
