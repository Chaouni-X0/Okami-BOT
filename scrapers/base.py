# -*- coding: utf-8 -*-

"""
scrapers/base.py

الكلاس الأساسي لجميع المكشطات. يحدد الواجهة التي يجب أن تتبعها جميع المكشطات
الخاصة بالمواقع المختلفة.
"""

import requests
from bs4 import BeautifulSoup
import os

class BaseScraper:
    def __init__(self, base_url):
        self.base_url = base_url
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def get_soup(self, url):
        """
        يجلب محتوى الصفحة ويحوله إلى كائن BeautifulSoup.
        """
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return BeautifulSoup(response.content, 'html.parser')
        except Exception as e:
            print(f"خطأ في جلب الصفحة {url}: {e}")
            return None

    def search(self, query):
        """
        يبحث عن عمل معين في الموقع. يجب تنفيذه في الكلاسات المشتقة.
        """
        raise NotImplementedError("يجب تنفيذ دالة search في الكلاس المشتق.")

    def get_manga_info(self, manga_url):
        """
        يجلب معلومات المانغا (العنوان، الوصف، الصورة، قائمة الفصول).
        يجب تنفيذه في الكلاسات المشتقة.
        """
        raise NotImplementedError("يجب تنفيذ دالة get_manga_info في الكلاس المشتق.")

    def get_chapter_images(self, chapter_url):
        """
        يجلب روابط الصور لفصل معين.
        يجب تنفيذه في الكلاسات المشتقة.
        """
        raise NotImplementedError("يجب تنفيذ دالة get_chapter_images في الكلاس المشتق.")

    def download_image(self, image_url, save_path):
        """
        يحمل صورة من رابط معين ويحفظها في المسار المحدد.
        """
        try:
            response = requests.get(image_url, headers=self.headers, stream=True)
            response.raise_for_status()
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        except Exception as e:
            print(f"خطأ في تحميل الصورة {image_url}: {e}")
            return False
