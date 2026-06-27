# -*- coding: utf-8 -*-

"""
database/users.py

نظام إدارة المستخدمين والميزات الاجتماعية لبوت أوكامي.

=== الميزات ===
1. نظام التقييم والمراجعات: المستخدمون يقيّمون الأعمال ويكتبون مراجعات
2. قائمة "اقرأ لاحقاً": حفظ أعمال لقراءتها لاحقاً
3. نظام التوصيات الذكي: يقترح أعمال مشابهة بناءً على المتابعات
4. إحصائيات القراءة الشخصية: تتبع نشاط المستخدم
5. نظام الحظر: حظر المستخدمين المخالفين
6. سجل العمليات (Logs): تسجيل جميع العمليات
"""

import sqlite3
import os
import random
from datetime import datetime

DATABASE_NAME = "okami_bot.db"


def init_users_db():
    """
    يهيئ جداول المستخدمين والميزات الاجتماعية.
    
    الجداول:
    - users: بيانات المستخدمين الأساسية
    - reviews: التقييمات والمراجعات
    - read_later: قائمة "اقرأ لاحقاً"
    - user_stats: إحصائيات القراءة الشخصية
    - banned_users: المستخدمون المحظورون
    - activity_log: سجل العمليات
    - broadcasts: الرسائل الجماعية
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # جدول المستخدمين
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            username TEXT,
            role TEXT DEFAULT 'user',
            joined_at TEXT DEFAULT (datetime('now')),
            last_active TEXT DEFAULT (datetime('now')),
            total_reads INTEGER DEFAULT 0,
            favorite_genre TEXT
        )
    """)

    # جدول التقييمات والمراجعات
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            manga_title TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            review_text TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, manga_title)
        )
    """)

    # جدول "اقرأ لاحقاً"
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS read_later (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            manga_title TEXT NOT NULL,
            manga_url TEXT,
            added_at TEXT DEFAULT (datetime('now')),
            is_read BOOLEAN DEFAULT 0,
            read_at TEXT,
            reminder_sent BOOLEAN DEFAULT 0,
            UNIQUE(user_id, manga_title)
        )
    """)

    # جدول إحصائيات القراءة الشخصية
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            manga_title TEXT NOT NULL,
            chapters_read INTEGER DEFAULT 0,
            last_chapter_read TEXT,
            started_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT,
            UNIQUE(user_id, manga_title)
        )
    """)

    # جدول المستخدمين المحظورين
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS banned_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            reason TEXT,
            banned_by TEXT,
            banned_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT
        )
    """)

    # جدول سجل العمليات
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            user_id TEXT,
            details TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
        )
    """)

    # جدول الرسائل الجماعية
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL,
            sent_by TEXT,
            sent_at TEXT DEFAULT (datetime('now')),
            recipients_count INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════
# ⭐ نظام التقييم والمراجعات
# ═══════════════════════════════════════════════════════════════

def add_review(user_id, manga_title, rating, review_text=""):
    """
    يضيف تقييم ومراجعة لعمل.
    
    :param user_id: معرف المستخدم
    :param manga_title: اسم العمل
    :param rating: التقييم (1-5 نجوم)
    :param review_text: نص المراجعة (اختياري)
    :return: True إذا نجح، False إذا كان موجوداً
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO reviews (user_id, manga_title, rating, review_text)
            VALUES (?, ?, ?, ?)
        """, (user_id, manga_title, rating, review_text))
        conn.commit()
        # تسجيل في سجل العمليات
        log_activity("review", user_id, f"قيّم '{manga_title}' بـ {rating}/5")
        return True
    except sqlite3.IntegrityError:
        # تحديث التقييم الموجود
        cursor.execute("""
            UPDATE reviews SET rating = ?, review_text = ?, created_at = datetime('now')
            WHERE user_id = ? AND manga_title = ?
        """, (rating, review_text, user_id, manga_title))
        conn.commit()
        return False
    finally:
        conn.close()


def get_manga_reviews(manga_title):
    """
    يسترجع جميع التقييمات والمراجعات لعمل محدد.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, rating, review_text, created_at
        FROM reviews WHERE manga_title LIKE ?
        ORDER BY created_at DESC
    """, (f"%{manga_title}%",))
    reviews = []
    for row in cursor.fetchall():
        reviews.append({
            "user_id": row[0],
            "rating": row[1],
            "review_text": row[2],
            "created_at": row[3]
        })
    conn.close()
    return reviews


def get_manga_average_rating(manga_title):
    """
    يحسب متوسط تقييم عمل محدد.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT AVG(rating), COUNT(*) FROM reviews WHERE manga_title LIKE ?
    """, (f"%{manga_title}%",))
    result = cursor.fetchone()
    conn.close()
    if result and result[1] > 0:
        return {"average": round(result[0], 1), "count": result[1]}
    return {"average": 0, "count": 0}


def get_top_rated_manga(limit=10):
    """
    يسترجع أعلى الأعمال تقييماً.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT manga_title, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM reviews
        GROUP BY manga_title
        HAVING review_count >= 1
        ORDER BY avg_rating DESC, review_count DESC
        LIMIT ?
    """, (limit,))
    results = []
    for row in cursor.fetchall():
        results.append({
            "title": row[0],
            "average_rating": round(row[1], 1),
            "review_count": row[2]
        })
    conn.close()
    return results


# ═══════════════════════════════════════════════════════════════
# 📖 قائمة "اقرأ لاحقاً"
# ═══════════════════════════════════════════════════════════════

def add_to_read_later(user_id, manga_title, manga_url=""):
    """
    يضيف عملاً إلى قائمة "اقرأ لاحقاً".
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO read_later (user_id, manga_title, manga_url)
            VALUES (?, ?, ?)
        """, (user_id, manga_title, manga_url))
        conn.commit()
        log_activity("read_later_add", user_id, f"أضاف '{manga_title}' لقائمة اقرأ لاحقاً")
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False
    finally:
        conn.close()


def remove_from_read_later(user_id, manga_title):
    """
    يزيل عملاً من قائمة "اقرأ لاحقاً".
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM read_later WHERE user_id = ? AND manga_title LIKE ?
    """, (user_id, f"%{manga_title}%"))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def mark_as_read(user_id, manga_title):
    """
    يعلم عملاً بأنه تمت قراءته.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE read_later SET is_read = 1, read_at = datetime('now')
        WHERE user_id = ? AND manga_title LIKE ?
    """, (user_id, f"%{manga_title}%"))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_read_later_list(user_id):
    """
    يسترجع قائمة "اقرأ لاحقاً" للمستخدم.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT manga_title, manga_url, added_at, is_read
        FROM read_later WHERE user_id = ?
        ORDER BY added_at DESC
    """, (user_id,))
    items = []
    for row in cursor.fetchall():
        items.append({
            "title": row[0],
            "url": row[1],
            "added_at": row[2],
            "is_read": bool(row[3])
        })
    conn.close()
    return items


# ═══════════════════════════════════════════════════════════════
# 🎯 نظام التوصيات الذكي
# ═══════════════════════════════════════════════════════════════

def get_recommendations(user_id, limit=5):
    """
    يقترح أعمالاً بناءً على ما يتابعه المستخدم.
    
    الخوارزمية:
    1. يجلب الأعمال التي يتابعها المستخدم
    2. يبحث عن مستخدمين آخرين يتابعون نفس الأعمال
    3. يقترح أعمالاً يتابعها هؤلاء المستخدمون ولا يتابعها المستخدم الحالي
    4. يرتب حسب شعبية العمل (عدد المتابعين)
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # الأعمال التي يتابعها المستخدم
    cursor.execute("""
        SELECT manga_title FROM followers WHERE user_id = ? AND is_active = 1
    """, (user_id,))
    user_follows = [row[0] for row in cursor.fetchall()]

    if not user_follows:
        # إذا لم يتابع شيئاً، نقترح الأكثر شعبية
        cursor.execute("""
            SELECT manga_title, COUNT(*) as followers_count
            FROM followers WHERE is_active = 1
            GROUP BY manga_title
            ORDER BY followers_count DESC
            LIMIT ?
        """, (limit,))
        results = [{"title": row[0], "followers": row[1], "reason": "الأكثر شعبية"} for row in cursor.fetchall()]
        conn.close()
        return results

    # البحث عن مستخدمين مشابهين
    placeholders = ",".join(["?" for _ in user_follows])
    cursor.execute(f"""
        SELECT DISTINCT user_id FROM followers
        WHERE manga_title IN ({placeholders}) AND user_id != ? AND is_active = 1
    """, (*user_follows, user_id))
    similar_users = [row[0] for row in cursor.fetchall()]

    if not similar_users:
        # إذا لم يجد مستخدمين مشابهين، نقترح الأعلى تقييماً
        cursor.execute("""
            SELECT manga_title, AVG(rating) as avg_rating
            FROM reviews
            WHERE manga_title NOT IN ({})
            GROUP BY manga_title
            ORDER BY avg_rating DESC
            LIMIT ?
        """.format(placeholders), (*user_follows, limit))
        results = [{"title": row[0], "rating": round(row[1], 1), "reason": "الأعلى تقييماً"} for row in cursor.fetchall()]
        conn.close()
        return results

    # أعمال يتابعها المستخدمون المشابهون ولا يتابعها المستخدم الحالي
    similar_placeholders = ",".join(["?" for _ in similar_users])
    cursor.execute(f"""
        SELECT manga_title, COUNT(*) as recommendation_score
        FROM followers
        WHERE user_id IN ({similar_placeholders}) AND manga_title NOT IN ({placeholders}) AND is_active = 1
        GROUP BY manga_title
        ORDER BY recommendation_score DESC
        LIMIT ?
    """, (*similar_users, *user_follows, limit))

    results = []
    for row in cursor.fetchall():
        results.append({
            "title": row[0],
            "score": row[1],
            "reason": f"يتابعه {row[1]} مستخدم مشابه لك"
        })

    conn.close()
    return results


def get_random_manga():
    """
    يقترح عملاً عشوائياً من قاعدة البيانات.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT title, description, compilation_post_url FROM manga ORDER BY RANDOM() LIMIT 1")
    result = cursor.fetchone()
    conn.close()
    if result:
        return {"title": result[0], "description": result[1], "url": result[2]}
    return None


# ═══════════════════════════════════════════════════════════════
# 📊 إحصائيات القراءة الشخصية
# ═══════════════════════════════════════════════════════════════

def update_reading_progress(user_id, manga_title, chapter_title):
    """
    يحدث تقدم القراءة للمستخدم.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO user_stats (user_id, manga_title, chapters_read, last_chapter_read)
            VALUES (?, ?, 1, ?)
        """, (user_id, manga_title, chapter_title))
    except sqlite3.IntegrityError:
        cursor.execute("""
            UPDATE user_stats SET chapters_read = chapters_read + 1,
            last_chapter_read = ? WHERE user_id = ? AND manga_title = ?
        """, (chapter_title, user_id, manga_title))
    conn.commit()
    conn.close()


def get_user_reading_stats(user_id):
    """
    يسترجع إحصائيات القراءة الشخصية للمستخدم.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # إجمالي الفصول المقروءة
    cursor.execute("SELECT SUM(chapters_read) FROM user_stats WHERE user_id = ?", (user_id,))
    total_chapters = cursor.fetchone()[0] or 0

    # عدد الأعمال
    cursor.execute("SELECT COUNT(DISTINCT manga_title) FROM user_stats WHERE user_id = ?", (user_id,))
    total_manga = cursor.fetchone()[0] or 0

    # آخر عمل تمت قراءته
    cursor.execute("""
        SELECT manga_title, last_chapter_read FROM user_stats
        WHERE user_id = ? ORDER BY rowid DESC LIMIT 1
    """, (user_id,))
    last_read = cursor.fetchone()

    # الأعمال المكتملة
    cursor.execute("SELECT COUNT(*) FROM user_stats WHERE user_id = ? AND completed_at IS NOT NULL", (user_id,))
    completed = cursor.fetchone()[0] or 0

    conn.close()
    return {
        "total_chapters_read": total_chapters,
        "total_manga": total_manga,
        "completed_manga": completed,
        "last_read": {"title": last_read[0], "chapter": last_read[1]} if last_read else None
    }


# ═══════════════════════════════════════════════════════════════
# 🚫 نظام الحظر (للمطور فقط)
# ═══════════════════════════════════════════════════════════════

def ban_user(user_id, reason="", banned_by="admin"):
    """
    يحظر مستخدماً.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO banned_users (user_id, reason, banned_by)
            VALUES (?, ?, ?)
        """, (user_id, reason, banned_by))
        conn.commit()
        log_activity("ban", banned_by, f"حظر المستخدم '{user_id}' - السبب: {reason}")
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def unban_user(user_id):
    """
    يرفع الحظر عن مستخدم.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM banned_users WHERE user_id = ?", (user_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    if affected > 0:
        log_activity("unban", "admin", f"رفع الحظر عن '{user_id}'")
    return affected > 0


def is_user_banned(user_id):
    """
    يتحقق مما إذا كان المستخدم محظوراً.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM banned_users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result is not None


def get_banned_users():
    """
    يسترجع قائمة المستخدمين المحظورين.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, reason, banned_at FROM banned_users ORDER BY banned_at DESC")
    users = []
    for row in cursor.fetchall():
        users.append({"user_id": row[0], "reason": row[1], "banned_at": row[2]})
    conn.close()
    return users


# ═══════════════════════════════════════════════════════════════
# 📝 سجل العمليات (Logs)
# ═══════════════════════════════════════════════════════════════

def log_activity(action, user_id="system", details=""):
    """
    يسجل عملية في سجل النشاط.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO activity_log (action, user_id, details)
        VALUES (?, ?, ?)
    """, (action, user_id, details))
    conn.commit()
    conn.close()


def get_recent_logs(limit=20):
    """
    يسترجع آخر العمليات المسجلة.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT action, user_id, details, timestamp
        FROM activity_log ORDER BY id DESC LIMIT ?
    """, (limit,))
    logs = []
    for row in cursor.fetchall():
        logs.append({
            "action": row[0],
            "user_id": row[1],
            "details": row[2],
            "timestamp": row[3]
        })
    conn.close()
    return logs


def clear_logs():
    """
    يمسح سجل العمليات بالكامل.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM activity_log")
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════
# 📢 الرسائل الجماعية (Broadcast)
# ═══════════════════════════════════════════════════════════════

def save_broadcast(message, sent_by="admin"):
    """
    يحفظ رسالة جماعية.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # حساب عدد المستلمين (جميع المتابعين النشطين)
    cursor.execute("SELECT COUNT(DISTINCT user_id) FROM followers WHERE is_active = 1")
    recipients = cursor.fetchone()[0] or 0

    cursor.execute("""
        INSERT INTO broadcasts (message, sent_by, recipients_count)
        VALUES (?, ?, ?)
    """, (message, sent_by, recipients))
    conn.commit()
    conn.close()
    log_activity("broadcast", sent_by, f"رسالة جماعية لـ {recipients} مستخدم")
    return recipients


def get_popular_manga(limit=10):
    """
    يسترجع الأعمال الأكثر متابعة.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT manga_title, COUNT(*) as followers_count
        FROM followers WHERE is_active = 1
        GROUP BY manga_title
        ORDER BY followers_count DESC
        LIMIT ?
    """, (limit,))
    results = []
    for row in cursor.fetchall():
        results.append({"title": row[0], "followers": row[1]})
    conn.close()
    return results
