# -*- coding: utf-8 -*-

"""
database/notifications.py

نظام الإشعارات وقائمة المتابعة.
يسمح للمستخدمين بمتابعة أعمال محددة وتلقي إشعارات عند نشر فصول جديدة.

=== كيف يعمل ===
1. المستخدم يضيف عملاً إلى قائمة متابعته (follow <اسم>)
2. عند نشر فصل جديد لهذا العمل، يُرسل إشعار للمستخدم
3. الإشعار يحتوي على اسم العمل + رقم الفصل + رابط المنشور
4. المستخدم يمكنه إزالة العمل من قائمته (unfollow <اسم>)
"""

import sqlite3
import os
from datetime import datetime

DATABASE_NAME = "okami_bot.db"


def init_notifications_db():
    """
    يهيئ جداول الإشعارات في قاعدة البيانات.
    - جدول followers: يخزن المستخدمين المتابعين لكل عمل
    - جدول notifications: يخزن الإشعارات المرسلة/المعلقة
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # جدول المتابعين - يربط المستخدمين بالأعمال التي يتابعونها
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS followers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            manga_title TEXT NOT NULL,
            followed_at TEXT DEFAULT (datetime('now')),
            is_active BOOLEAN DEFAULT 1,
            UNIQUE(user_id, manga_title)
        )
    """)

    # جدول الإشعارات - يخزن الإشعارات المرسلة والمعلقة
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            manga_title TEXT NOT NULL,
            chapter_title TEXT NOT NULL,
            facebook_post_url TEXT,
            message TEXT,
            is_sent BOOLEAN DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            sent_at TEXT
        )
    """)

    conn.commit()
    conn.close()


def follow_manga(user_id, manga_title):
    """
    يضيف عملاً إلى قائمة متابعة المستخدم.
    
    :param user_id: معرف المستخدم (يمكن أن يكون اسم أو رقم)
    :param manga_title: اسم المانغا/المانهوا
    :return: True إذا تمت الإضافة بنجاح، False إذا كان يتابعه بالفعل
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO followers (user_id, manga_title)
            VALUES (?, ?)
        """, (user_id, manga_title))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        # المستخدم يتابع هذا العمل بالفعل - نعيد تفعيله إذا كان معطلاً
        cursor.execute("""
            UPDATE followers SET is_active = 1 WHERE user_id = ? AND manga_title = ?
        """, (user_id, manga_title))
        conn.commit()
        conn.close()
        return False


def unfollow_manga(user_id, manga_title):
    """
    يزيل عملاً من قائمة متابعة المستخدم.
    
    :param user_id: معرف المستخدم
    :param manga_title: اسم المانغا/المانهوا
    :return: True إذا تمت الإزالة، False إذا لم يكن يتابعه
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE followers SET is_active = 0 WHERE user_id = ? AND manga_title = ?
    """, (user_id, manga_title))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_user_follows(user_id):
    """
    يسترجع قائمة الأعمال التي يتابعها المستخدم.
    
    :param user_id: معرف المستخدم
    :return: قائمة بأسماء الأعمال المتابعة
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT manga_title, followed_at FROM followers 
        WHERE user_id = ? AND is_active = 1
        ORDER BY followed_at DESC
    """, (user_id,))
    follows = [(row[0], row[1]) for row in cursor.fetchall()]
    conn.close()
    return follows


def get_followers_for_manga(manga_title):
    """
    يسترجع قائمة المستخدمين المتابعين لعمل محدد.
    
    :param manga_title: اسم المانغا/المانهوا
    :return: قائمة بمعرفات المستخدمين
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    # بحث دقيق أولاً
    cursor.execute("""
        SELECT user_id FROM followers 
        WHERE manga_title = ? AND is_active = 1
    """, (manga_title,))
    followers = [row[0] for row in cursor.fetchall()]
    
    # إذا لم يجد، بحث جزئي
    if not followers:
        cursor.execute("""
            SELECT user_id FROM followers 
            WHERE manga_title LIKE ? AND is_active = 1
        """, (f"%{manga_title}%",))
        followers = [row[0] for row in cursor.fetchall()]
    
    conn.close()
    return followers


def create_notification(manga_title, chapter_title, facebook_post_url):
    """
    ينشئ إشعارات لجميع المتابعين عند نشر فصل جديد.
    
    :param manga_title: اسم المانغا
    :param chapter_title: عنوان الفصل الجديد
    :param facebook_post_url: رابط المنشور على فيسبوك
    :return: عدد الإشعارات التي تم إنشاؤها
    """
    followers = get_followers_for_manga(manga_title)
    if not followers:
        return 0

    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # إنشاء رسالة الإشعار
    message = f"""
╔═══════════════════════════════════════════════════╗
║ 🔔 إشعار فصل جديد! 🔔
║
║ 📚 العمل: {manga_title}
║ 📖 الفصل: {chapter_title}
║ 🔗 الرابط: {facebook_post_url}
║
║ 🐺 Okami Bot
╚═══════════════════════════════════════════════════╝
"""

    count = 0
    for user_id in followers:
        cursor.execute("""
            INSERT INTO notifications (user_id, manga_title, chapter_title, facebook_post_url, message)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, manga_title, chapter_title, facebook_post_url, message))
        count += 1

    conn.commit()
    conn.close()
    return count


def get_pending_notifications(user_id=None):
    """
    يسترجع الإشعارات المعلقة (غير المرسلة).
    
    :param user_id: معرف المستخدم (اختياري - إذا None يجلب الكل)
    :return: قائمة الإشعارات المعلقة
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    if user_id:
        cursor.execute("""
            SELECT id, user_id, manga_title, chapter_title, facebook_post_url, message, created_at
            FROM notifications WHERE user_id = ? AND is_sent = 0
            ORDER BY created_at ASC
        """, (user_id,))
    else:
        cursor.execute("""
            SELECT id, user_id, manga_title, chapter_title, facebook_post_url, message, created_at
            FROM notifications WHERE is_sent = 0
            ORDER BY created_at ASC
        """)

    notifications = []
    for row in cursor.fetchall():
        notifications.append({
            "id": row[0],
            "user_id": row[1],
            "manga_title": row[2],
            "chapter_title": row[3],
            "facebook_post_url": row[4],
            "message": row[5],
            "created_at": row[6]
        })
    conn.close()
    return notifications


def mark_notification_sent(notification_id):
    """
    يعلم إشعاراً بأنه تم إرساله.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE notifications SET is_sent = 1, sent_at = datetime('now')
        WHERE id = ?
    """, (notification_id,))
    conn.commit()
    conn.close()


def mark_all_notifications_sent(user_id):
    """
    يعلم جميع إشعارات مستخدم بأنها تم إرسالها.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE notifications SET is_sent = 1, sent_at = datetime('now')
        WHERE user_id = ? AND is_sent = 0
    """, (user_id,))
    conn.commit()
    conn.close()


def get_notification_stats():
    """
    يعرض إحصائيات الإشعارات.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM followers WHERE is_active = 1")
    total_follows = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT user_id) FROM followers WHERE is_active = 1")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM notifications WHERE is_sent = 0")
    pending = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM notifications WHERE is_sent = 1")
    sent = cursor.fetchone()[0]

    conn.close()
    return {
        "total_follows": total_follows,
        "total_users": total_users,
        "pending_notifications": pending,
        "sent_notifications": sent
    }
