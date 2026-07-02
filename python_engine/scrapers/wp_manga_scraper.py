from core.base_scraper import BaseScraper
from typing import List, Dict, Any, Optional
import re

class WPMangaScraper(BaseScraper):
    """Generic scraper for sites using the WP-Manga (Madara) theme."""
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/?s={query}&post_type=wp-manga"
        soup = await self.fetch_html(url)
        if not soup: return []
        
        results = []
        for item in soup.select('.c-tabs-item__content, .search-wrap .manga-item'):
            title_tag = item.select_one('h3 a, .post-title a')
            if title_tag:
                results.append({
                    'title': title_tag.text.strip(),
                    'url': title_tag['href'],
                    'source': self.source_name
                })
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        soup = await self.fetch_html(url)
        if not soup: return {}
        
        title = soup.select_one('.post-title h1').text.strip() if soup.select_one('.post-title h1') else ""
        cover = soup.select_one('.summary_image img')['src'] if soup.select_one('.summary_image img') else ""
        desc = soup.select_one('.description-summary').text.strip() if soup.select_one('.description-summary') else ""
        
        return {
            'title': title,
            'cover': cover,
            'description': desc,
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        # WP-Manga often loads chapters via AJAX
        manga_id = None
        soup = await self.fetch_html(url)
        if soup:
            id_tag = soup.select_one('.wp-manga-action-button[data-id]')
            if id_tag: manga_id = id_tag['data-id']
        
        if manga_id:
            ajax_url = f"{self.base_url}/wp-admin/admin-ajax.php"
            data = {'action': 'manga_get_chapters', 'manga': manga_id}
            # Note: fetch_html needs to support POST if we want to use it here, 
            # or we can use a simpler approach if the chapters are in the initial HTML
            # Many Madara sites have them in the initial HTML now.
            
        chapters = []
        if soup:
            for ch in soup.select('.wp-manga-chapter a'):
                chapters.append({
                    'name': ch.text.strip(),
                    'url': ch['href']
                })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url)
        if not soup: return []
        
        images = []
        for img in soup.select('.reading-content img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src:
                images.append(src.strip())
        return images
