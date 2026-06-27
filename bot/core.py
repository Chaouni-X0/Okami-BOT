# -*- coding: utf-8 -*-

"""
bot/core.py

يحتوي على المنطق الأساسي للبوت، بما في ذلك:
- عملية الكشط وتحميل الصور
- تقسيم الصور الطويلة لتناسب فيسبوك بأعلى جودة
- إضافة العلامة المائية
- النشر على فيسبوك
- 🗑️ وضع الحذف التلقائي بعد النشر (حذف الصور والملفات المحلية)

=== وضع الحذف ===
بعد نشر كل فصل، يتم حذف صوره المحلية فوراً لتوفير المساحة.
بعد نشر المانهوا بالكامل، يتم حذف كل البيانات المحلية ويُحتفظ فقط
برابط المنشور التجميعي على فيسبوك.
"""

import os
import shutil
from datetime import datetime
from PIL import Image

from scrapers import SUPPORTED_SCRAPERS
from bot.publisher import FacebookPublisher
from database.db import (
    init_db, save_manga, get_manga, get_manga_by_title, get_unpublished_chapters,
    mark_chapter_as_published, get_published_chapters_for_manga, delete_manga_data,
    save_compilation_post_url, track_downloaded_file, cleanup_chapter_files,
    cleanup_manga_after_publish, update_manga_chapters, get_storage_stats
)
from utils.watermark import add_watermark
from utils.image_processor import split_image_for_facebook, optimize_image_quality


class OkamiBotCore:
    """
    النواة الأساسية لبوت أوكامي.
    تدير عمليات الكشط، التحميل، المعالجة، النشر، والحذف.
    """

    def __init__(self):
        # تهيئة قاعدة البيانات
        init_db()
        # تهيئة ناشر فيسبوك
        self.publisher = FacebookPublisher()
        # مجلد التحميلات المؤقتة
        self.temp_dir = "/tmp/okami_bot_temp"
        os.makedirs(self.temp_dir, exist_ok=True)
        # إعدادات الصور لفيسبوك
        self.fb_max_width = 2048       # أقصى عرض لصور فيسبوك
        self.fb_max_height = 2048      # أقصى ارتفاع لصور فيسبوك
        self.fb_optimal_width = 1200   # العرض المثالي لفيسبوك
        self.split_threshold = 3000    # إذا تجاوز ارتفاع الصورة هذا الحد، يتم تقسيمها

    def _get_scraper(self, scraper_name):
        """
        يحصل على كائن المكشط بناءً على اسمه.
        """
        scraper_class = SUPPORTED_SCRAPERS.get(scraper_name)
        if not scraper_class:
            raise ValueError(f"❌ المكشط '{scraper_name}' غير مدعوم.")
        return scraper_class()

    def _download_and_process_images(self, scraper, image_urls, chapter_dir, chapter_id=None):
        """
        يحمل الصور، يقسمها إذا كانت طويلة، يحسن جودتها، ويضيف العلامة المائية.
        
        خطوات المعالجة:
        1. تحميل الصورة الأصلية
        2. تقسيم الصور الطويلة (المانهوا عادة صور طويلة جداً)
        3. تحسين الجودة وضبط الأبعاد لتناسب فيسبوك
        4. إضافة العلامة المائية
        5. تسجيل الملفات في قاعدة البيانات للحذف لاحقاً
        """
        processed_image_paths = []

        for i, img_url in enumerate(image_urls):
            original_image_path = os.path.join(chapter_dir, f"original_page_{i+1}.jpg")

            # === الخطوة 1: تحميل الصورة الأصلية ===
            if not scraper.download_image(img_url, original_image_path):
                print(f"   ⚠️ فشل تحميل الصورة {i+1}: {img_url}")
                continue

            # تسجيل الملف المحمل في قاعدة البيانات
            if chapter_id:
                track_downloaded_file(chapter_id, original_image_path, "original")

            # === الخطوة 2: تقسيم الصور الطويلة ===
            try:
                img = Image.open(original_image_path)
                width, height = img.size

                # إذا كانت الصورة طويلة جداً (مانهوا)، نقسمها
                if height > self.split_threshold:
                    print(f"   ✂️ تقسيم الصورة {i+1} (الارتفاع: {height}px)...")
                    split_paths = split_image_for_facebook(
                        original_image_path,
                        chapter_dir,
                        max_height=self.fb_max_height,
                        optimal_width=self.fb_optimal_width,
                        page_index=i+1
                    )
                    # معالجة كل جزء مقسم
                    for split_path in split_paths:
                        watermarked_path = split_path.replace(".png", "_wm.png")
                        optimized_path = split_path.replace(".png", "_opt.png")

                        # تحسين الجودة
                        optimize_image_quality(split_path, optimized_path, self.fb_optimal_width)

                        # إضافة العلامة المائية
                        if add_watermark(optimized_path, watermarked_path):
                            processed_image_paths.append(watermarked_path)
                            if chapter_id:
                                track_downloaded_file(chapter_id, watermarked_path, "processed")
                        else:
                            processed_image_paths.append(optimized_path)

                        # حذف الملفات الوسيطة
                        if os.path.exists(split_path) and split_path != optimized_path:
                            os.remove(split_path)
                        if os.path.exists(optimized_path) and optimized_path != watermarked_path:
                            os.remove(optimized_path)
                else:
                    # === الخطوة 3: تحسين الجودة للصور العادية ===
                    optimized_path = os.path.join(chapter_dir, f"optimized_page_{i+1}.png")
                    optimize_image_quality(original_image_path, optimized_path, self.fb_optimal_width)

                    # === الخطوة 4: إضافة العلامة المائية ===
                    watermarked_path = os.path.join(chapter_dir, f"watermarked_page_{i+1}.png")
                    if add_watermark(optimized_path, watermarked_path):
                        processed_image_paths.append(watermarked_path)
                        if chapter_id:
                            track_downloaded_file(chapter_id, watermarked_path, "processed")
                    else:
                        processed_image_paths.append(optimized_path)

                    # حذف الملف الوسيط
                    if os.path.exists(optimized_path) and optimized_path != watermarked_path:
                        os.remove(optimized_path)

                img.close()

            except Exception as e:
                print(f"   ❌ خطأ في معالجة الصورة {i+1}: {e}")
                # في حالة الخطأ، نستخدم الصورة الأصلية مع العلامة المائية
                watermarked_path = os.path.join(chapter_dir, f"watermarked_page_{i+1}.png")
                if add_watermark(original_image_path, watermarked_path):
                    processed_image_paths.append(watermarked_path)

            # === حذف الصورة الأصلية بعد المعالجة لتوفير المساحة ===
            if os.path.exists(original_image_path):
                os.remove(original_image_path)

        return processed_image_paths

    def publish_new_manga(self, scraper_name, manga_title_query):
        """
        ينشر مانغا جديدة بالكامل من أول فصل لآخر فصل.
        بعد النشر الكامل، يتم تفعيل وضع الحذف تلقائياً.
        """
        scraper = self._get_scraper(scraper_name)
        print(f"\n🔍 البحث عن '{manga_title_query}' في {scraper_name}...")
        search_results = scraper.search(manga_title_query)

        if not search_results:
            print(f"❌ لم يتم العثور على مانغا بعنوان '{manga_title_query}' في {scraper_name}.")
            return

        # عرض نتائج البحث للمستخدم
        print(f"\n📋 نتائج البحث ({len(search_results)} نتيجة):")
        for idx, result in enumerate(search_results[:10], 1):
            print(f"   {idx}. {result['title']}")

        # اختيار أول نتيجة (يمكن تحسين هذا للسماح للمستخدم بالاختيار)
        if len(search_results) > 1:
            try:
                choice = input("\n🔢 اختر رقم العمل (أو اضغط Enter للأول): ").strip()
                if choice and choice.isdigit():
                    selected_idx = int(choice) - 1
                    if 0 <= selected_idx < len(search_results):
                        selected_manga = search_results[selected_idx]
                    else:
                        selected_manga = search_results[0]
                else:
                    selected_manga = search_results[0]
            except (ValueError, EOFError):
                selected_manga = search_results[0]
        else:
            selected_manga = search_results[0]

        manga_url = selected_manga["url"]
        print(f"\n✅ تم اختيار: {selected_manga['title']}")
        print(f"🔗 الرابط: {manga_url}")
        print(f"📥 جلب المعلومات...")

        manga_info = scraper.get_manga_info(manga_url)
        if not manga_info:
            print("❌ فشل جلب معلومات المانغا.")
            return

        # حفظ معلومات المانغا في قاعدة البيانات
        manga_db_id = save_manga(
            manga_info["title"],
            scraper_name,
            manga_url,
            manga_info.get("image_url", ""),
            manga_info.get("description", "")
        )
        if not manga_db_id:
            print("❌ فشل حفظ المانغا في قاعدة البيانات.")
            return

        # تحديث الفصول في قاعدة البيانات
        chapters_dict = {chap["title"]: chap["url"] for chap in manga_info.get("chapters", [])}
        update_manga_chapters(manga_db_id, chapters_dict)

        print(f"\n📚 تم حفظ '{manga_info['title']}' - عدد الفصول: {len(chapters_dict)}")
        print(f"═══════════════════════════════════════════════════")

        # نشر الفصول
        self.publish_new_chapters_for_manga(manga_db_id, scraper_name, manga_info)

    def publish_new_chapters_for_manga(self, manga_db_id, scraper_name, manga_info=None):
        """
        ينشر الفصول الجديدة لمانغا موجودة في قاعدة البيانات.
        
        === وضع الحذف الفوري ===
        بعد نشر كل فصل بنجاح، يتم حذف صوره المحلية فوراً.
        بعد نشر جميع الفصول، يتم حذف كل البيانات المحلية.
        """
        manga_data = get_manga(manga_db_id)
        if not manga_data:
            print(f"❌ لم يتم العثور على مانغا بالمعرف {manga_db_id}.")
            return

        scraper = self._get_scraper(scraper_name)

        if not manga_info:
            manga_info = scraper.get_manga_info(manga_data["manga_url"])
            if not manga_info:
                print(f"❌ فشل جلب معلومات المانغا من {manga_data['manga_url']}.")
                return

        # تحديث الفصول في قاعدة البيانات
        chapters_from_site = {chap["title"]: chap["url"] for chap in manga_info.get("chapters", [])}
        update_manga_chapters(manga_db_id, chapters_from_site)

        # جلب الفصول غير المنشورة
        unpublished_chapters = get_unpublished_chapters(manga_db_id)
        if not unpublished_chapters:
            print(f"✅ لا توجد فصول جديدة غير منشورة للمانغا '{manga_data['title']}'.")
            return

        print(f"\n🚀 بدء نشر {len(unpublished_chapters)} فصل للمانغا '{manga_data['title']}'")
        print(f"═══════════════════════════════════════════════════\n")

        chapter_facebook_links = {}
        total = len(unpublished_chapters)

        for idx, chapter in enumerate(unpublished_chapters, 1):
            chapter_title = chapter["chapter_title"]
            chapter_url = chapter["chapter_url"]
            chapter_id = chapter["id"]

            print(f"📖 [{idx}/{total}] نشر: {chapter_title}...")

            # جلب صور الفصل
            chapter_images_urls = scraper.get_chapter_images(chapter_url)
            if not chapter_images_urls:
                print(f"   ⚠️ فشل جلب صور الفصل {chapter_title}.")
                continue

            print(f"   📷 عدد الصور: {len(chapter_images_urls)}")

            # إنشاء مجلد مؤقت للفصل
            chapter_temp_dir = os.path.join(self.temp_dir, f"chapter_{chapter_id}")
            os.makedirs(chapter_temp_dir, exist_ok=True)

            # تحميل ومعالجة الصور (تقسيم + تحسين + علامة مائية)
            processed_paths = self._download_and_process_images(
                scraper, chapter_images_urls, chapter_temp_dir, chapter_id
            )

            if not processed_paths:
                print(f"   ❌ فشل معالجة صور الفصل {chapter_title}.")
                shutil.rmtree(chapter_temp_dir, ignore_errors=True)
                continue

            print(f"   ✅ تم معالجة {len(processed_paths)} صورة (بعد التقسيم والتحسين)")

            # نشر الفصل على فيسبوك
            fb_post_url = self.publisher.publish_chapter(
                manga_data["title"], chapter_title, chapter_url, processed_paths
            )

            if fb_post_url:
                mark_chapter_as_published(chapter_id, fb_post_url)
                chapter_facebook_links[chapter_title] = fb_post_url
                print(f"   ✅ تم النشر: {fb_post_url}")
            else:
                print(f"   ❌ فشل نشر الفصل {chapter_title} على فيسبوك.")

            # ═══════════════════════════════════════════════════
            # 🗑️ حذف فوري - حذف صور الفصل بعد نشره مباشرة
            # ═══════════════════════════════════════════════════
            print(f"   🗑️ حذف الملفات المؤقتة للفصل...")
            cleanup_chapter_files(chapter_id)
            shutil.rmtree(chapter_temp_dir, ignore_errors=True)
            print(f"   ✅ تم حذف الملفات المحلية للفصل.\n")

        # ═══════════════════════════════════════════════════════════
        # 📋 نشر المنشور التجميعي بعد الانتهاء من جميع الفصول
        # ═══════════════════════════════════════════════════════════
        if chapter_facebook_links:
            print("\n📋 نشر المنشور التجميعي...")
            all_published_chapters = get_published_chapters_for_manga(manga_db_id)

            # تحميل صورة الغلاف
            cover_image_path = os.path.join(self.temp_dir, f"cover_{manga_db_id}.jpg")
            if manga_data["image_url"] and scraper.download_image(manga_data["image_url"], cover_image_path):
                compilation_fb_url = self.publisher.publish_compilation_post(
                    manga_data, all_published_chapters, cover_image_path
                )
                if compilation_fb_url:
                    # حفظ رابط المنشور التجميعي
                    save_compilation_post_url(manga_db_id, compilation_fb_url)
                    print(f"   ✅ تم نشر المنشور التجميعي: {compilation_fb_url}")
                else:
                    print("   ❌ فشل نشر المنشور التجميعي.")

                # حذف صورة الغلاف
                if os.path.exists(cover_image_path):
                    os.remove(cover_image_path)
            else:
                print("   ⚠️ فشل تحميل صورة الغلاف.")

            # ═══════════════════════════════════════════════════════════
            # 🗑️ وضع الحذف النهائي - حذف كل شيء بعد النشر الكامل
            # ═══════════════════════════════════════════════════════════
            # التحقق مما إذا كانت المانغا مكتملة (غير مستمرة)
            remaining = get_unpublished_chapters(manga_db_id)
            if not remaining and not manga_data["is_ongoing"]:
                print("\n🗑️ ═══════════════════════════════════════════════════")
                print("🗑️  تفعيل وضع الحذف النهائي (المانغا مكتملة)")
                print("🗑️ ═══════════════════════════════════════════════════")
                cleanup_manga_after_publish(manga_db_id)
            elif not remaining and manga_data["is_ongoing"]:
                print("\n📌 المانغا مستمرة - سيتم متابعة الفصول الجديدة تلقائياً.")
                print("   🗑️ تم حذف الملفات المحلية. الروابط محفوظة.")

        # تنظيف المجلد المؤقت العام
        self._cleanup_temp_dir()

        # عرض إحصائيات التخزين
        stats = get_storage_stats()
        print(f"\n📊 إحصائيات التخزين:")
        print(f"   📁 ملفات نشطة: {stats['active_files']}")
        print(f"   🗑️ ملفات محذوفة: {stats['deleted_files']}")
        print(f"   💾 المساحة المستخدمة: {stats['storage_used_mb']} MB")
        print(f"\n✅ اكتملت عملية نشر '{manga_data['title']}'.")

    def search_manga_for_user(self, manga_title_query):
        """
        يبحث عن مانغا منشورة في قاعدة البيانات ويعيد رابط المنشور التجميعي.
        """
        manga_data = get_manga_by_title(manga_title_query)
        if manga_data:
            # إذا كان هناك رابط تجميعي محفوظ، نعيده مباشرة
            if manga_data.get("compilation_post_url"):
                return manga_data["compilation_post_url"]

            # وإلا نبحث في الفصول المنشورة
            published_chapters = get_published_chapters_for_manga(manga_data["id"])
            if published_chapters:
                first_chapter_link = list(published_chapters.values())[0]
                return first_chapter_link
            else:
                print(f"⚠️ تم العثور على '{manga_data['title']}' ولكن لا توجد فصول منشورة.")
                return None
        else:
            print(f"❌ لم يتم العثور على مانغا بعنوان '{manga_title_query}'.")
            return None

    def force_cleanup(self, manga_id=None):
        """
        🗑️ حذف يدوي - يمكن للمستخدم تشغيله لحذف بيانات مانغا محددة أو جميع البيانات المحلية.
        """
        if manga_id:
            cleanup_manga_after_publish(manga_id)
        else:
            # حذف جميع الملفات المؤقتة
            self._cleanup_temp_dir()
            print("✅ تم تنظيف جميع الملفات المؤقتة.")

    def _cleanup_temp_dir(self):
        """
        ينظف المجلد المؤقت بالكامل.
        """
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            os.makedirs(self.temp_dir, exist_ok=True)
            print("🗑️ تم تنظيف المجلد المؤقت.")
