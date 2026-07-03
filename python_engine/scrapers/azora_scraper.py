from typing import List, Dict, Any, Optional
from urllib.parse import quote
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class AzoraScraper(BaseScraper):
    def __init__(self):
        super().__init__("Azora", "https://azorafly.com", use_cloudscraper=True)

    async def search(self, query: str) -> List[Dict[str, Any]]:
        # Azora search uses /series?title=query
        url = f"{self.base_url}/series?title={quote(query)}"
        logger.info(f"[AzoraScraper] Searching: {url}")
        soup = await self.fetch_html(url)
        if not soup: return []
        
        results = []
        # Azora often uses specific card structures
        items = soup.select('a[href^="/series/"]') or \
                soup.select('.series-card a') or \
                soup.select('.manga-item a')
                
        seen_urls = set()
        for item in items:
            href = item.get('href')
            if not href or href == '/series/': continue
            
            manga_url = href
            if not manga_url.startswith('http'):
                manga_url = self.base_url.rstrip('/') + manga_url
            
            # Ensure it's a series link, not a chapter link
            if "/series/" not in manga_url: continue
            
            if manga_url in seen_urls: continue
            seen_urls.add(manga_url)
            
            title = item.get('title') or item.text.strip()
            # If title is empty, try to get it from child elements or alt text
            if not title:
                title_el = item.select_one('h3, .title, .name')
                title = title_el.text.strip() if title_el else ""
            
            if not title:
                img = item.select_one('img')
                title = img.get('alt', '').strip() if img else ""
            
            if title:
                results.append({
                    'title': title,
                    'url': manga_url,
                    'source': self.source_name
                })
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        soup = await self.fetch_html(url)
        if not soup: return {}
        
        title = soup.select_one('h1').text.strip() if soup.select_one('h1') else ""
        cover = ""
        img_tag = soup.select_one('img[src*="storage.azorafly.com"]')
        if img_tag:
            cover = img_tag.get('src')
            
        desc = ""
        desc_tag = soup.select_one('.description') or soup.select_one('p')
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
        # Azora chapter links usually contain '/chapter/'
        for ch in soup.select('a[href*="/chapter/"]'):
            chapters.append({
                'name': ch.text.strip(),
                'url': self.base_url.rstrip('/') + ch.get('href') if not ch.get('href').startswith('http') else ch.get('href')
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url)
        if not soup: return []
        
        images = []
        # Next.js / React sites often store images in a JSON state or specific div
        for img in soup.select('img[src*="storage.azorafly.com"]'):
            src = img.get('src')
            if src:
                images.append(src)
        return images
