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
    """Generic scraper for sites using the WP-Manga (Madara) theme or similar structures."""
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        # Try multiple search methods (Tachiyomi-style)
        search_urls = [
            f"{self.base_url}/?s={quote(query)}&post_type=wp-manga",
            f"{self.base_url}/manga?s={quote(query)}&post_type=wp-manga",
            f"{self.base_url}/?s={quote(query)}"
        ]
        
        results = []
        seen_urls = set()
        
        for url in search_urls:
            logger.info(f"[WPMangaScraper] Searching: {url}")
            soup = await self.fetch_html(url)
            if not soup: continue
            
            # Common Madara search selectors
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
                    
                    if title:
                        results.append({
                            'title': title,
                            'url': manga_url,
                            'source': self.source_name
                        })
            
            if results: break # Stop if we found results
            
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
        # Standard Madara chapter selectors
        chapter_items = soup.select('.wp-manga-chapter a') or \
                        soup.select('.listing-chapters_wrap .wp-manga-chapter a') or \
                        soup.select('li.wp-manga-chapter a')
        
        if not chapter_items:
            # Try to find manga_id for AJAX fallback if needed (though most sites have them in HTML now)
            manga_id = None
            id_tag = soup.select_one('.wp-manga-action-button[data-id]') or soup.select_one('#manga-chapters-holder[data-id]')
            if id_tag:
                manga_id = id_tag.get('data-id')
            
            if manga_id:
                # If we really need AJAX, we could implement it here, but let's try more selectors first
                pass

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
        # Common image selectors for Madara and similar themes
        image_tags = soup.select('.reading-content img') or \
                     soup.select('.wp-manga-chapter-img') or \
                     soup.select('.page-break img') or \
                     soup.select('.v-comics-chapter-image img')
        
        for img in image_tags:
            # Check all possible image attributes (Tachiyomi-style)
            src = img.get('src') or \
                  img.get('data-src') or \
                  img.get('data-lazy-src') or \
                  img.get('data-full-url') or \
                  img.get('data-cdn') or \
                  img.get('data-original')
            
            if src:
                src = src.strip()
                # Filter out small icons/logos
                if "logo" in src.lower() or "banner" in src.lower() or "favicon" in src.lower():
                    continue
                    
                if src.startswith('//'):
                    src = 'https:' + src
                elif src.startswith('/'):
                    src = self.base_url.rstrip('/') + src
                
                if src not in images:
                    images.append(src)
        return images
