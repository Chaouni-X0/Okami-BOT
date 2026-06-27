# -*- coding: utf-8 -*-

"""
bot/publisher.py

يحتوي على الكلاس FacebookPublisher الذي يتعامل مع Facebook Graph API
لنشر الصور والفصول والمنشورات التجميعية على صفحة فيسبوك.
"""

import requests
import os
from dotenv import load_dotenv
from utils.watermark import add_watermark
from utils.formatter import format_chapter_post, format_compilation_post
from database.notifications import create_notification

# تحميل متغيرات البيئة
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', 'config.env'))

class FacebookPublisher:
    def __init__(self):
        self.page_access_token = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN")
        self.page_id = os.getenv("FACEBOOK_PAGE_ID")
        self.graph_api_url = f"https://graph.facebook.com/v19.0/{self.page_id}"

        if not self.page_access_token or not self.page_id:
            raise ValueError("الرجاء توفير FACEBOOK_PAGE_ACCESS_TOKEN و FACEBOOK_PAGE_ID في ملف config.env")

    def _post_to_facebook(self, endpoint, data, files=None):
        """
        دالة مساعدة لإرسال طلبات إلى Facebook Graph API.
        """
        params = {"access_token": self.page_access_token}
        try:
            response = requests.post(f"{self.graph_api_url}/{endpoint}", params=params, data=data, files=files)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"خطأ في النشر على فيسبوك: {e}")
            if response:
                print(f"استجابة الخطأ: {response.json()}")
            return None

    def upload_photo(self, image_path, caption=""):
        """
        يرفع صورة واحدة إلى فيسبوك.
        """
        with open(image_path, 'rb') as f:
            files = {'source': f}
            data = {'caption': caption}
            response = self._post_to_facebook("photos", data, files)
            if response and 'id' in response:
                print(f"تم رفع الصورة بنجاح. ID: {response['id']}")
                return response['id']
            return None

    def publish_chapter(self, manga_title, chapter_title, chapter_url, image_paths):
        """
        ينشر فصلاً كاملاً (مجموعة صور) على فيسبوك.
        يعيد رابط المنشور على فيسبوك.
        """
        post_ids = []
        media_ids = []

        # 1. رفع الصور كـ unpublished posts للحصول على media_id
        for i, img_path in enumerate(image_paths):
            caption = f"{manga_title} - {chapter_title} - صفحة {i+1}"
            with open(img_path, 'rb') as f:
                files = {'source': f}
                data = {'caption': caption, 'published': False}
                response = self._post_to_facebook("photos", data, files)
                if response and 'id' in response:
                    media_ids.append({"media_fbid": response['id']})
                else:
                    print(f"فشل رفع الصورة {img_path}")
                    return None
        
        if not media_ids:
            print("لم يتم رفع أي صور للفصل.")
            return None

        # 2. إنشاء منشور ألبوم بالصور المرفوعة
        # نص المنشور الرئيسي للفصل
        full_caption = format_chapter_post(chapter_title, chapter_url, manga_title)
        
        data = {
            'message': full_caption,
            'attached_media': media_ids
        }
        response = self._post_to_facebook("feed", data)
        if response and 'id' in response:
            print(f"تم نشر الفصل بنجاح. Post ID: {response['id']}")
            # Facebook Graph API لا يعيد رابط المنشور مباشرة، نحتاج لإنشائه
            post_url = f"https://www.facebook.com/{self.page_id}/posts/{response['id'].split('_')[1]}"
            
            # 🔔 إرسال إشعارات للمتابعين
            notif_count = create_notification(manga_title, chapter_title, post_url)
            if notif_count > 0:
                print(f"   🔔 تم إرسال {notif_count} إشعار للمتابعين.")
            
            return post_url
        return None

    def publish_compilation_post(self, manga_info, chapter_links, cover_image_path):
        """
        ينشر منشوراً تجميعياً للمانغا/المانهوا مع صورة الغلاف.
        """
        # إضافة العلامة المائية لصورة الغلاف
        watermarked_cover_path = f"/tmp/watermarked_{os.path.basename(cover_image_path)}"
        if not add_watermark(cover_image_path, watermarked_cover_path):
            print("فشل إضافة العلامة المائية لصورة الغلاف. سيتم النشر بدون علامة مائية.")
            watermarked_cover_path = cover_image_path

        # تنسيق نص المنشور
        post_text = format_compilation_post(manga_info, chapter_links)

        # رفع الصورة ونشر المنشور
        with open(watermarked_cover_path, 'rb') as f:
            files = {'source': f}
            data = {'caption': post_text}
            response = self._post_to_facebook("photos", data, files)
            if response and 'id' in response:
                print(f"تم نشر المنشور التجميعي بنجاح. Photo ID: {response['id']}")
                post_url = f"https://www.facebook.com/{self.page_id}/posts/{response['id'].split('_')[1]}"
                # حذف الصورة المؤقتة ذات العلامة المائية
                if watermarked_cover_path != cover_image_path and os.path.exists(watermarked_cover_path):
                    os.remove(watermarked_cover_path)
                return post_url
            
            # حذف الصورة المؤقتة حتى لو فشل النشر
            if watermarked_cover_path != cover_image_path and os.path.exists(watermarked_cover_path):
                os.remove(watermarked_cover_path)
            return None

# مثال للاستخدام (يمكن حذفه لاحقاً)
if __name__ == "__main__":
    # تأكد من وجود config.env مع التوكن والمعرف
    # FACEBOOK_PAGE_ACCESS_TOKEN و FACEBOOK_PAGE_ID
    try:
        publisher = FacebookPublisher()
        print("تم تهيئة FacebookPublisher بنجاح.")

        # مثال على رفع صورة واحدة
        # dummy_image_path = "/tmp/test_image.png"
        # Image.new("RGB", (800, 600), color = (73, 109, 137)).save(dummy_image_path)
        # photo_id = publisher.upload_photo(dummy_image_path, "صورة اختبار من Okami Bot 🐺")
        # if photo_id: os.remove(dummy_image_path)

        # مثال على نشر فصل (يتطلب صور حقيقية)
        # manga_title_ex = "مانغا تجريبية"
        # chapter_title_ex = "الفصل 1"
        # chapter_url_ex = "http://example.com/chapter/1"
        # dummy_image_paths = []
        # for i in range(3):
        #     path = f"/tmp/chapter_img_{i+1}.png"
        #     Image.new("RGB", (800, 600), color = (i*50, 100, 200)).save(path)
        #     dummy_image_paths.append(path)
        # fb_post_url = publisher.publish_chapter(manga_title_ex, chapter_title_ex, chapter_url_ex, dummy_image_paths)
        # print(f"رابط منشور الفصل: {fb_post_url}")
        # for p in dummy_image_paths: os.remove(p)

        # مثال على نشر منشور تجميعي
        # manga_info_ex = {
        #     "title": "مانغا تجريبية",
        #     "description": "هذه مانغا تجريبية رائعة لنشرها على فيسبوك."
        # }
        # chapter_links_ex = {
        #     "الفصل 1": "https://www.facebook.com/yourpage/posts/12345",
        #     "الفصل 2": "https://www.facebook.com/yourpage/posts/67890"
        # }
        # cover_image_path_ex = "/tmp/test_cover.png"
        # Image.new("RGB", (1200, 800), color = (200, 150, 100)).save(cover_image_path_ex)
        # compilation_fb_url = publisher.publish_compilation_post(manga_info_ex, chapter_links_ex, cover_image_path_ex)
        # print(f"رابط المنشور التجميعي: {compilation_fb_url}")
        # os.remove(cover_image_path_ex)

    except ValueError as e:
        print(f"خطأ في التهيئة: {e}")
    except Exception as e:
        print(f"حدث خطأ غير متوقع: {e}")
