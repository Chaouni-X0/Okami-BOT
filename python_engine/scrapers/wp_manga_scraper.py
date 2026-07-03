from typing import List, Dict, Any, Optional
import re
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class WPMangaScraper(BaseScraper):
    """Generic scraper for sites using the WP-Manga (Madara) theme."""
    
    async def search(self, query: str) -> List[Dict[str, Any]]:
        from urllib.parse import quote
        
        # Try AJAX search first as it's often less protected on Madara sites
        try:
            ajax_url = f"{self.base_url}/wp-admin/admin-ajax.php"
            # Some sites use different actions, but 'wp-manga-search-manga' is standard
            params = {
                'action': 'wp-manga-search-manga',
                'title': query
            }
            data = await self.fetch_json(ajax_url, method='POST', params=params)
            if data and isinstance(data, dict) and data.get('success'):
                results = []
                # Process AJAX results if they are in the expected format
                # This depends on the specific site, but let's try a generic approach
                pass 
        except: pass

        # Fallback to standard search
        if "mangaarabia.com" in self.base_url:
            url = f"{self.base_url}/search?query={quote(query)}"
        else:
            url = f"{self.base_url}/?s={quote(query)}&post_type=wp-manga"
        soup = await self.fetch_html(url)
        
        if not soup or not (soup.select('.c-tabs-item__content') or soup.select('.post-title a')):
            # If search page fails or is empty, try a different search method or just log it
            logger.info(f"Search page for {self.source_name} seems empty or blocked. Trying alternative...")
            # Some sites use /?s=query without post_type
            alt_url = f"{self.base_url}/?s={quote(query)}"
            soup = await self.fetch_html(alt_url)

        if not soup: return []
        
        results = []
        # Try multiple common selectors for Madara theme search results
        items = soup.select('.c-tabs-item__content') or \
                soup.select('.search-wrap .manga-item') or \
                soup.select('.row.c-tabs-item__content') or \
                soup.select('.tabbed-content .post-title a') or \
                soup.select('.c-tabs-item__content .post-title a') or \
                soup.select('.manga-item .post-title a')
        
        if not items:
            # Fallback to any link that looks like a manga link in a search context
            items = soup.select('.post-title a') or soup.select('h3 a')

        seen_urls = set()
        for item in items:
            title_tag = item if item.name == 'a' else item.select_one('h3 a, .post-title a, a')
            if title_tag and title_tag.get('href'):
                url = title_tag['href']
                # Normalize URL
                if url.startswith('/'):
                    url = self.base_url.rstrip('/') + url
                
                if url in seen_urls: continue
                seen_urls.add(url)
                
                title = title_tag.text.strip()
                if not title:
                    # Try to get title from img alt or other attributes
                    img = item.select_one('img')
                    if img and img.get('alt'):
                        title = img['alt'].strip()
                
                if title:
                    results.append({
                        'title': title,
                        'url': url,
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
