# -*- coding: utf-8 -*-

"""
database/db.py

يدير التفاعلات مع قاعدة بيانات SQLite لتخزين معلومات المانغا/المانهوا،
الفصول المنشورة، وروابط فيسبوك.

=== وضع الحذف ===
بعد نشر المانهوا بالكامل، يتم حذف جميع بيانات الفصول والصور المحلية
ويُحتفظ فقط برابط المنشور التجميعي على فيسبوك لتوفير المساحة.
"""

import sqlite3
import os

DATABASE_NAME = "okami_bot.db"


def init_db():
    """
    يهيئ قاعدة البيانات وينشئ الجداول إذا لم تكن موجودة.
    - جدول manga: يخزن معلومات المانغا الأساسية + رابط المنشور التجميعي
    - جدول chapters: يخزن الفصول وروابطها على فيسبوك
    - جدول downloaded_files: يتتبع الملفات المحملة مؤقتاً لحذفها بعد النشر
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # جدول المانغا - يحتوي على رابط المنشور التجميعي
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS manga (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL UNIQUE,
            scraper_name TEXT NOT NULL,
            manga_url TEXT NOT NULL,
            image_url TEXT,
            description TEXT,
            is_ongoing BOOLEAN DEFAULT 1,
            is_fully_published BOOLEAN DEFAULT 0,
            compilation_post_url TEXT,
            last_checked TEXT,
            total_chapters INTEGER DEFAULT 0,
            published_chapters_count INTEGER DEFAULT 0
        )
    """)

    # جدول الفصول
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            manga_id INTEGER NOT NULL,
            chapter_title TEXT NOT NULL,
            chapter_number REAL DEFAULT 0,
            chapter_url TEXT NOT NULL,
            facebook_post_url TEXT,
            is_published BOOLEAN DEFAULT 0,
            is_cleaned BOOLEAN DEFAULT 0,
            published_at TEXT,
            FOREIGN KEY (manga_id) REFERENCES manga(id)
        )
    """)

    # جدول الملفات المحملة - لتتبع الملفات المؤقتة وحذفها
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS downloaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT DEFAULT 'image',
            is_deleted BOOLEAN DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
        )
    """)

    conn.commit()
    conn.close()
    print("✅ تم تهيئة قاعدة البيانات بنجاح.")


def save_manga(title, scraper_name, manga_url, image_url, description, is_ongoing=True):
    """
    يحفظ معلومات مانغا جديدة في قاعدة البيانات.
    يعيد معرف المانغا (manga_id).
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO manga (title, scraper_name, manga_url, image_url, description, is_ongoing)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (title, scraper_name, manga_url, image_url, description, is_ongoing))
        manga_id = cursor.lastrowid
        conn.commit()
        return manga_id
    except sqlite3.IntegrityError:
        print(f"⚠️ المانغا '{title}' موجودة بالفعل في قاعدة البيانات.")
        cursor.execute("SELECT id FROM manga WHERE title = ?", (title,))
        return cursor.fetchone()[0]
    finally:
        conn.close()


def get_manga(manga_id):
    """
    يسترجع معلومات مانغا بناءً على معرفها.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM manga WHERE id = ?", (manga_id,))
    manga = cursor.fetchone()
    conn.close()
    if manga:
        return {
            "id": manga[0],
            "title": manga[1],
            "scraper_name": manga[2],
            "manga_url": manga[3],
            "image_url": manga[4],
            "description": manga[5],
            "is_ongoing": bool(manga[6]),
            "is_fully_published": bool(manga[7]),
            "compilation_post_url": manga[8],
            "last_checked": manga[9],
            "total_chapters": manga[10],
            "published_chapters_count": manga[11]
        }
    return None


def get_manga_by_title(title):
    """
    يسترجع معلومات مانغا بناءً على عنوانها (بحث جزئي).
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    # بحث دقيق أولاً
    cursor.execute("SELECT * FROM manga WHERE title = ?", (title,))
    manga = cursor.fetchone()
    # إذا لم يجد، بحث جزئي
    if not manga:
        cursor.execute("SELECT * FROM manga WHERE title LIKE ?", (f"%{title}%",))
        manga = cursor.fetchone()
    conn.close()
    if manga:
        return {
            "id": manga[0],
            "title": manga[1],
            "scraper_name": manga[2],
            "manga_url": manga[3],
            "image_url": manga[4],
            "description": manga[5],
            "is_ongoing": bool(manga[6]),
            "is_fully_published": bool(manga[7]),
            "compilation_post_url": manga[8],
            "last_checked": manga[9],
            "total_chapters": manga[10],
            "published_chapters_count": manga[11]
        }
    return None


def get_all_manga(is_ongoing=None):
    """
    يسترجع جميع المانغا أو المانغا المستمرة فقط.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    if is_ongoing is not None:
        cursor.execute("SELECT * FROM manga WHERE is_ongoing = ?", (is_ongoing,))
    else:
        cursor.execute("SELECT * FROM manga")
    manga_list = []
    for manga in cursor.fetchall():
        manga_list.append({
            "id": manga[0],
            "title": manga[1],
            "scraper_name": manga[2],
            "manga_url": manga[3],
            "image_url": manga[4],
            "description": manga[5],
            "is_ongoing": bool(manga[6]),
            "is_fully_published": bool(manga[7]),
            "compilation_post_url": manga[8],
            "last_checked": manga[9],
            "total_chapters": manga[10],
            "published_chapters_count": manga[11]
        })
    conn.close()
    return manga_list


def update_manga_chapters(manga_id, chapters_data):
    """
    يحدث فصول مانغا معينة. chapters_data هو قاموس يحتوي على عنوان الفصل ورابطه.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    for chapter_title, chapter_url in chapters_data.items():
        cursor.execute("""
            INSERT OR IGNORE INTO chapters (manga_id, chapter_title, chapter_url)
            VALUES (?, ?, ?)
        """, (manga_id, chapter_title, chapter_url))
    # تحديث عدد الفصول الكلي
    cursor.execute("UPDATE manga SET total_chapters = (SELECT COUNT(*) FROM chapters WHERE manga_id = ?) WHERE id = ?",
                   (manga_id, manga_id))
    conn.commit()
    conn.close()


def get_unpublished_chapters(manga_id):
    """
    يسترجع الفصول غير المنشورة لمانغا معينة.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chapters WHERE manga_id = ? AND is_published = 0 ORDER BY id ASC", (manga_id,))
    chapters = []
    for chap in cursor.fetchall():
        chapters.append({
            "id": chap[0],
            "manga_id": chap[1],
            "chapter_title": chap[2],
            "chapter_number": chap[3],
            "chapter_url": chap[4],
            "facebook_post_url": chap[5],
            "is_published": bool(chap[6]),
            "is_cleaned": bool(chap[7]),
            "published_at": chap[8]
        })
    conn.close()
    return chapters


def mark_chapter_as_published(chapter_id, facebook_post_url):
    """
    يعلم فصلاً بأنه تم نشره ويحفظ رابط منشور فيسبوك.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE chapters
        SET is_published = 1, facebook_post_url = ?, published_at = datetime('now')
        WHERE id = ?
    """, (facebook_post_url, chapter_id))
    # تحديث عداد الفصول المنشورة في جدول المانغا
    cursor.execute("""
        UPDATE manga SET published_chapters_count = (
            SELECT COUNT(*) FROM chapters WHERE manga_id = (
                SELECT manga_id FROM chapters WHERE id = ?
            ) AND is_published = 1
        ) WHERE id = (SELECT manga_id FROM chapters WHERE id = ?)
    """, (chapter_id, chapter_id))
    conn.commit()
    conn.close()


def get_published_chapters_for_manga(manga_id):
    """
    يسترجع جميع الفصول المنشورة لمانغا معينة مع روابط فيسبوك الخاصة بها.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT chapter_title, facebook_post_url FROM chapters WHERE manga_id = ? AND is_published = 1 ORDER BY id ASC", (manga_id,))
    chapters = {}
    for chap_title, fb_url in cursor.fetchall():
        chapters[chap_title] = fb_url
    conn.close()
    return chapters


def save_compilation_post_url(manga_id, compilation_url):
    """
    يحفظ رابط المنشور التجميعي في قاعدة البيانات.
    هذا الرابط هو الوحيد الذي يُحتفظ به بعد الحذف.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE manga SET compilation_post_url = ? WHERE id = ?
    """, (compilation_url, manga_id))
    conn.commit()
    conn.close()
    print(f"✅ تم حفظ رابط المنشور التجميعي للمانغا ID={manga_id}")


def track_downloaded_file(chapter_id, file_path, file_type="image"):
    """
    يسجل ملفاً محملاً في قاعدة البيانات لتتبعه وحذفه لاحقاً.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO downloaded_files (chapter_id, file_path, file_type)
        VALUES (?, ?, ?)
    """, (chapter_id, file_path, file_type))
    conn.commit()
    conn.close()


def get_files_for_chapter(chapter_id):
    """
    يسترجع جميع الملفات المحملة لفصل معين.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM downloaded_files WHERE chapter_id = ? AND is_deleted = 0", (chapter_id,))
    files = [row[0] for row in cursor.fetchall()]
    conn.close()
    return files


def mark_files_as_deleted(chapter_id):
    """
    يعلم جميع ملفات فصل معين بأنها تم حذفها.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE downloaded_files SET is_deleted = 1 WHERE chapter_id = ?", (chapter_id,))
    cursor.execute("UPDATE chapters SET is_cleaned = 1 WHERE id = ?", (chapter_id,))
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════
# 🗑️ وضع الحذف - يحذف كل شيء ما عدا رابط المنشور التجميعي
# ═══════════════════════════════════════════════════════════════

def cleanup_manga_after_publish(manga_id):
    """
    🗑️ وضع الحذف التلقائي:
    بعد نشر المانهوا بالكامل على فيسبوك، يقوم بـ:
    1. حذف جميع الملفات المحلية (الصور المحملة)
    2. حذف سجلات الملفات من جدول downloaded_files
    3. حذف بيانات الفصول التفصيلية (يبقي فقط رابط فيسبوك في جدول manga)
    4. تعليم المانغا كـ "منشورة بالكامل"
    
    يُحتفظ فقط بـ:
    - اسم المانغا
    - رابط المنشور التجميعي على فيسبوك
    - معلومات أساسية (الوصف، الموقع المصدر)
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    print(f"\n🗑️ بدء وضع الحذف للمانغا ID={manga_id}...")

    # 1. حذف جميع الملفات المحلية المسجلة
    cursor.execute("SELECT file_path FROM downloaded_files WHERE chapter_id IN (SELECT id FROM chapters WHERE manga_id = ?)", (manga_id,))
    files_to_delete = cursor.fetchall()
    deleted_count = 0
    for (file_path,) in files_to_delete:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                deleted_count += 1
            except OSError as e:
                print(f"⚠️ فشل حذف الملف {file_path}: {e}")
    print(f"   🗑️ تم حذف {deleted_count} ملف محلي.")

    # 2. حذف سجلات الملفات من قاعدة البيانات
    cursor.execute("DELETE FROM downloaded_files WHERE chapter_id IN (SELECT id FROM chapters WHERE manga_id = ?)", (manga_id,))
    print(f"   🗑️ تم حذف سجلات الملفات من قاعدة البيانات.")

    # 3. حذف بيانات الفصول (نحتفظ فقط بالروابط في المنشور التجميعي)
    cursor.execute("DELETE FROM chapters WHERE manga_id = ?", (manga_id,))
    print(f"   🗑️ تم حذف بيانات الفصول التفصيلية.")

    # 4. تعليم المانغا كمنشورة بالكامل
    cursor.execute("""
        UPDATE manga SET is_fully_published = 1, image_url = NULL WHERE id = ?
    """, (manga_id,))
    print(f"   ✅ تم تعليم المانغا كمنشورة بالكامل.")

    conn.commit()
    conn.close()

    print(f"🗑️ اكتمل وضع الحذف. تم الاحتفاظ فقط برابط المنشور التجميعي.\n")


def cleanup_chapter_files(chapter_id):
    """
    يحذف الملفات المحلية لفصل واحد بعد نشره مباشرة.
    يُستخدم لتوفير المساحة أثناء عملية النشر (حذف فوري بعد كل فصل).
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT file_path FROM downloaded_files WHERE chapter_id = ? AND is_deleted = 0", (chapter_id,))
    files = cursor.fetchall()
    deleted_count = 0
    for (file_path,) in files:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                deleted_count += 1
            except OSError as e:
                print(f"⚠️ فشل حذف {file_path}: {e}")

    # تعليم الملفات كمحذوفة
    cursor.execute("UPDATE downloaded_files SET is_deleted = 1 WHERE chapter_id = ?", (chapter_id,))
    cursor.execute("UPDATE chapters SET is_cleaned = 1 WHERE id = ?", (chapter_id,))
    conn.commit()
    conn.close()

    if deleted_count > 0:
        print(f"   🗑️ تم حذف {deleted_count} ملف للفصل ID={chapter_id}")


def get_storage_stats():
    """
    يعرض إحصائيات التخزين: عدد الملفات المحملة، المحذوفة، والمساحة المستخدمة.
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM downloaded_files WHERE is_deleted = 0")
    active_files = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM downloaded_files WHERE is_deleted = 1")
    deleted_files = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM manga WHERE is_fully_published = 1")
    fully_published = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM manga WHERE is_fully_published = 0")
    in_progress = cursor.fetchone()[0]

    conn.close()

    # حساب المساحة المستخدمة من الملفات النشطة
    total_size = 0
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM downloaded_files WHERE is_deleted = 0")
    for (file_path,) in cursor.fetchall():
        if os.path.exists(file_path):
            total_size += os.path.getsize(file_path)
    conn.close()

    return {
        "active_files": active_files,
        "deleted_files": deleted_files,
        "fully_published_manga": fully_published,
        "in_progress_manga": in_progress,
        "storage_used_mb": round(total_size / (1024 * 1024), 2)
    }


def delete_manga_data(manga_id):
    """
    يحذف جميع بيانات المانغا والفصول المرتبطة بها من قاعدة البيانات بالكامل.
    ⚠️ هذا حذف نهائي - يحذف حتى رابط المنشور التجميعي!
    """
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    # حذف الملفات المحلية أولاً
    cursor.execute("SELECT file_path FROM downloaded_files WHERE chapter_id IN (SELECT id FROM chapters WHERE manga_id = ?)", (manga_id,))
    for (file_path,) in cursor.fetchall():
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
    cursor.execute("DELETE FROM downloaded_files WHERE chapter_id IN (SELECT id FROM chapters WHERE manga_id = ?)", (manga_id,))
    cursor.execute("DELETE FROM chapters WHERE manga_id = ?", (manga_id,))
    cursor.execute("DELETE FROM manga WHERE id = ?", (manga_id,))
    conn.commit()
    conn.close()
    print(f"🗑️ تم حذف جميع بيانات المانغا ذات المعرف {manga_id} نهائياً.")
