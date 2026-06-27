import requests
from bs4 import BeautifulSoup
from .base import BaseScraper

class MangaArabScraper(BaseScraper):
    def __init__(self):
        super().__init__("https://manga-arab.com") # قد يتغير الرابط

    def search(self, query):
        search_url = f"{self.base_url}/?s={query}"
        soup = self.get_soup(search_url)
        results = []
        if soup:
            items = soup.select(".post-item") 
            for item in items:
                title_tag = item.select_one("h3 a")
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
            'title': soup.select_one("h1.entry-title").get_text(strip=True) if soup.select_one("h1.entry-title") else "غير معروف",
            'description': soup.select_one(".entry-content p").get_text(strip=True) if soup.select_one(".entry-content p") else "",
            'image_url': soup.select_one(".entry-content img")['src'] if soup.select_one(".entry-content img") else None,
            'chapters': []
        }
        
        chapters_list = soup.select(".chapter-item a") 
        for chap_tag in chapters_list:
            if chap_tag:
                info['chapters'].append({
                    'title': chap_tag.get_text(strip=True),
                    'url': chap_tag['href']
                })
        
        info['chapters'].reverse()
        return info

    def get_chapter_images(self, chapter_url):
        soup = self.get_soup(chapter_url)
        images = []
        if soup:
            img_tags = soup.select(".chapter-images img") 
            for img in img_tags:
                src = img.get('src') or img.get('data-src')
                if src:
                    images.append(src.strip())
        return images
