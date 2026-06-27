# -*- coding: utf-8 -*-

"""
scrapers/azora.py

مكشط خاص بموقع أزورا مون (Azora Moon).
"""

from .base import BaseScraper

class AzoraScraper(BaseScraper):
    def __init__(self):
        super().__init__("https://azoramoon.com")

    def search(self, query):
        """
        البحث عن عمل في أزورا مون.
        ملاحظة: البنية قد تختلف بناءً على تحديثات الموقع.
        """
        search_url = f"{self.base_url}/?s={query}&post_type=wp-manga"
        soup = self.get_soup(search_url)
        results = []
        if soup:
            items = soup.select(".c-tabs-item__content")
            for item in items:
                title_tag = item.select_one(".post-title h3 a")
                if title_tag:
                    results.append({
                        'title': title_tag.get_text(strip=True),
                        'url': title_tag['href']
                    })
        return results

    def get_manga_info(self, manga_url):
        soup = self.get_soup(manga_url)
        if not soup:
            return None
        
        info = {
            'title': soup.select_one(".post-title h1").get_text(strip=True) if soup.select_one(".post-title h1") else "غير معروف",
            'description': soup.select_one(".description-summary .summary__content").get_text(strip=True) if soup.select_one(".description-summary .summary__content") else "",
            'image_url': soup.select_one(".summary_image img")['src'] if soup.select_one(".summary_image img") else None,
            'chapters': []
        }
        
        chapters_list = soup.select(".wp-manga-chapter")
        for chap in chapters_list:
            chap_tag = chap.select_one("a")
            if chap_tag:
                info['chapters'].append({
                    'title': chap_tag.get_text(strip=True),
                    'url': chap_tag['href']
                })
        
        # ترتيب الفصول من الأقدم للأحدث
        info['chapters'].reverse()
        return info

    def get_chapter_images(self, chapter_url):
        soup = self.get_soup(chapter_url)
        images = []
        if soup:
            img_tags = soup.select(".reading-content .page-break img")
            for img in img_tags:
                src = img.get('src') or img.get('data-src')
                if src:
                    images.append(src.strip())
        return images
