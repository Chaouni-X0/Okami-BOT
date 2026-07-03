from typing import List, Dict, Any, Optional
import re
from urllib.parse import quote
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class WPMangaScraper(BaseScraper):
    """Optimized scraper for sites using the WP-Manga (Madara) theme."""
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        # Optimized: Directly use the correct search path
        # First attempt: With post_type for better accuracy
        # Second attempt: Generic search if first fails
        search_paths = [
            f"{self.base_url}/?s={quote(query)}&post_type=wp-manga",
            f"{self.base_url}/?s={quote(query)}"
        ]
        
        results = []
        seen_urls = set()
        
        for url in search_paths:
            logger.info(f"[{self.source_name}] Searching: {url}")
            soup = await self.fetch_html(url)
            if not soup: continue
            
            # Selectors based on Tachiyomi Madara implementation
            items = soup.select('.c-tabs-item__content') or \
                    soup.select('.search-wrap .manga-item') or \
                    soup.select('.row.c-tabs-item__content') or \
                    soup.select('.tab-content-wrap .post-title a') or \
                    soup.select('.manga-item .post-title a') or \
                    soup.select('.post-title a')
            
            for item in items:
                title_tag = item if item.name == 'a' else item.select_one('h3 a, .post-title a, a')
                if title_tag and title_tag.get('href'):
                    manga_url = title_tag['href']
                    if manga_url.startswith('/'):
                        manga_url = self.base_url.rstrip('/') + manga_url
                    
                    if manga_url in seen_urls: continue
                    seen_urls.add(manga_url)
                    
                    title = title_tag.text.strip()
                    if not title:
                        img = item.select_one('img')
                        title = img.get('alt', '').strip() if img else ""
                    
                    # Double check if the title actually contains parts of the query (Filtering fix)
                    query_words = query.lower().split()
                    if any(word in title.lower() for word in query_words):
                        results.append({
                            'title': title,
                            'url': manga_url,
                            'source': self.source_name
                        })
            
            if results: 
                logger.info(f"[{self.source_name}] Found {len(results)} matches.")
                break
            
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        soup = await self.fetch_html(url)
        if not soup: return {}
        
        title = ""
        title_tag = soup.select_one('.post-title h1') or soup.select_one('h1')
        if title_tag:
            title = title_tag.text.strip()
            
        cover = ""
        img_tag = soup.select_one('.summary_image img') or soup.select_one('.post-thumb img')
        if img_tag:
            cover = img_tag.get('src') or img_tag.get('data-src') or img_tag.get('data-lazy-src')
            
        desc = ""
        desc_tag = soup.select_one('.description-summary') or soup.select_one('.manga-excerpt') or soup.select_one('.summary__content')
        if desc_tag:
            desc = desc_tag.text.strip()
        
        return {
            'title': title,
            'cover': cover,
            'description': desc,
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        soup = await self.fetch_html(url)
        if not soup: return []
        
        chapters = []
        chapter_items = soup.select('.wp-manga-chapter a') or \
                        soup.select('.listing-chapters_wrap .wp-manga-chapter a') or \
                        soup.select('li.wp-manga-chapter a')
        
        for ch in chapter_items:
            chapters.append({
                'name': ch.text.strip(),
                'url': ch['href']
            })
            
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url)
        if not soup: return []
        
        images = []
        image_tags = soup.select('.reading-content img') or \
                     soup.select('.wp-manga-chapter-img') or \
                     soup.select('.page-break img')
        
        for img in image_tags:
            src = img.get('src') or \
                  img.get('data-src') or \
                  img.get('data-lazy-src') or \
                  img.get('data-cdn') or \
                  img.get('data-original')
            
            if src:
                src = src.strip()
                if any(x in src.lower() for x in ["logo", "banner", "favicon"]):
                    continue
                if src.startswith('//'): src = 'https:' + src
                if src not in images:
                    images.append(src)
        return images
