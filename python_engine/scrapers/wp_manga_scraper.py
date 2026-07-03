from typing import List, Dict, Any, Optional
import json
from urllib.parse import quote
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class WPMangaScraper(BaseScraper):
    """Optimized scraper for sites using WP-Manga or Next.js transitions."""
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        query_plus = query.replace(' ', '+')
        
        # Optimized: Removed /search?q= path as it returns 404
        search_urls = [
            f"{self.base_url}/?s={query_plus}&post_type=wp-manga", # Primary for Madara
            f"{self.base_url}/?s={query_plus}" # Fallback
        ]
        
        results = []
        seen_urls = set()
        
        for url in search_urls:
            logger.info(f"[{self.source_name}] Searching: {url}")
            soup = await self.fetch_html(url)
            
            if not soup:
                continue

            # Diagnostic: Print HTML snippet if no results are found to debug MangaSwat
            html_content = str(soup)
            html_snippet = html_content[:1000]
            
            # Selectors updated to be more inclusive for Next.js and Modern Madara
            # Added more specific selectors for MangaSwat's potential Next.js structure
            items = soup.select('a[href*="/series/"], a[href*="/manga/"], a[href*="/comics/"]') or \
                    soup.select('.c-tabs-item__content') or \
                    soup.select('.search-wrap .manga-item') or \
                    soup.select('.post-title a') or \
                    soup.select('h3 a')
            
            found_in_this_url = 0
            for item in items:
                manga_url = item.get('href')
                if not manga_url or manga_url in seen_urls: continue
                
                if any(x in manga_url for x in ['/genres/', '/tags/', '/author/', '/plans/']): continue
                
                if manga_url.startswith('/'):
                    manga_url = self.base_url.rstrip('/') + manga_url
                
                title = item.text.strip()
                if not title:
                    title_tag = item.select_one('h3, h4, .post-title, .title')
                    title = title_tag.text.strip() if title_tag else ""
                
                if not title:
                    img = item.select_one('img')
                    title = img.get('alt', '').strip() if img else ""

                if title:
                    query_words = query.lower().split()
                    if any(word in title.lower() for word in query_words):
                        results.append({
                            'title': title,
                            'url': manga_url,
                            'source': self.source_name
                        })
                        seen_urls.add(manga_url)
                        found_in_this_url += 1
            
            if found_in_this_url > 0:
                logger.info(f"[{self.source_name}] Found {found_in_this_url} matches at {url}")
                break
            else:
                # Log snippet for debugging MangaSwat (meshmanga.com)
                logger.warning(f"[{self.source_name}] 0 results at {url}. HTML Snippet (first 1000 chars): {html_snippet}")
            
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        soup = await self.fetch_html(url)
        if not soup: return {}
        
        title = ""
        title_tag = soup.select_one('h1') or soup.select_one('.post-title h1') or soup.select_one('.title h1')
        if title_tag: title = title_tag.text.strip()
            
        cover = ""
        img_tag = soup.select_one('img[src*="poster"], .summary_image img, .post-thumb img')
        if img_tag:
            cover = img_tag.get('src') or img_tag.get('data-src') or img_tag.get('data-lazy-src')
            
        desc = ""
        desc_tag = soup.select_one('.description-summary, .manga-excerpt, .summary__content, #summary, .post-content')
        if desc_tag: desc = desc_tag.text.strip()
        
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
        # inclusive selectors for chapters
        chapter_items = soup.select('a[href*="/chapter-"], .wp-manga-chapter a, li.wp-manga-chapter a, .chapter-link')
        
        for ch in chapter_items:
            href = ch['href']
            if href.startswith('/'): href = self.base_url.rstrip('/') + href
            chapters.append({
                'name': ch.text.strip(),
                'url': href
            })
            
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url)
        if not soup: return []
        
        images = []
        image_tags = soup.select('img[src*="chapter"], .reading-content img, .wp-manga-chapter-img, .page-break img, .chapter-img')
        
        for img in image_tags:
            src = img.get('src') or \
                  img.get('data-src') or \
                  img.get('data-lazy-src') or \
                  img.get('data-cdn') or \
                  img.get('data-original')
            
            if src:
                src = src.strip()
                if any(x in src.lower() for x in ["logo", "banner", "favicon", "credit"]):
                    continue
                if src.startswith('//'): src = 'https:' + src
                if src not in images:
                    images.append(src)
        return images
