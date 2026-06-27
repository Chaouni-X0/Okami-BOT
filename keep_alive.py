# -*- coding: utf-8 -*-

"""
keep_alive.py

خادم ويب بسيط لإبقاء البوت حياً على Replit.

=== لماذا هذا الملف؟ ===
Replit يوقف البرامج التي لا تستجيب لطلبات HTTP بعد فترة.
هذا الخادم يعمل في الخلفية ويستجيب لطلبات ping من خدمات مثل
UptimeRobot لإبقاء البوت يعمل 24/7.

=== كيفية الاستخدام ===
1. شغّل البوت على Replit
2. انسخ رابط الويب الذي يظهر (مثل: https://your-bot.repl.co)
3. أضف الرابط في UptimeRobot (https://uptimerobot.com) كـ HTTP Monitor
4. اضبط فترة التحقق على 5 دقائق
"""

from flask import Flask, jsonify
from threading import Thread
from datetime import datetime

# إنشاء تطبيق Flask
app = Flask(__name__)

# وقت بدء التشغيل
start_time = datetime.now()


@app.route('/')
def home():
    """
    الصفحة الرئيسية - تعرض حالة البوت.
    """
    uptime = datetime.now() - start_time
    return f"""
    <html dir="rtl">
    <head>
        <title>🐺 Okami Bot</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #eee;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
            }}
            .container {{
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                backdrop-filter: blur(10px);
            }}
            h1 {{ font-size: 2.5em; margin-bottom: 10px; }}
            .status {{ color: #00ff88; font-size: 1.2em; }}
            .info {{ color: #aaa; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐺 Okami Bot</h1>
            <p class="status">✅ البوت يعمل بنجاح</p>
            <p class="info">⏱️ مدة التشغيل: {uptime}</p>
            <p class="info">📅 آخر تحقق: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
    </body>
    </html>
    """


@app.route('/ping')
def ping():
    """
    نقطة نهاية ping - للتحقق من أن البوت يعمل.
    تُستخدم من UptimeRobot أو خدمات مشابهة.
    """
    return jsonify({
        "status": "alive",
        "bot": "Okami Bot 🐺",
        "uptime_seconds": (datetime.now() - start_time).total_seconds(),
        "timestamp": datetime.now().isoformat()
    })


@app.route('/health')
def health():
    """
    نقطة نهاية الصحة - معلومات تفصيلية عن حالة البوت.
    """
    return jsonify({
        "status": "healthy",
        "bot_name": "Okami Bot",
        "version": "2.0.0",
        "start_time": start_time.isoformat(),
        "uptime_seconds": (datetime.now() - start_time).total_seconds()
    })


def run_server():
    """
    يشغل خادم Flask على المنفذ 8080.
    """
    app.run(host='0.0.0.0', port=8080)


def keep_alive():
    """
    يشغل خادم الويب في خيط منفصل (Thread) حتى لا يعطل البوت الرئيسي.
    استدعِ هذه الدالة في main.py قبل بدء البوت.
    """
    server_thread = Thread(target=run_server, daemon=True)
    server_thread.start()
    print("🌐 خادم Keep-Alive يعمل على المنفذ 8080")
    print("   💡 أضف الرابط في UptimeRobot لإبقاء البوت حياً 24/7")
