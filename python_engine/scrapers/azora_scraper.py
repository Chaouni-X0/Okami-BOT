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
        soup = await self.fetch_html(url)
        if not soup: return []
        
        results = []
        # Based on the structure seen in browser_navigate
        items = soup.select('a[href^="/series/"]')
        seen_urls = set()
        
        for item in items:
            url = item.get('href')
            if not url or url == '/series/': continue
            if not url.startswith('http'):
                url = self.base_url.rstrip('/') + url
            
            if url in seen_urls: continue
            seen_urls.add(url)
            
            title = item.get('title') or item.text.strip()
            if not title:
                img = item.select_one('img')
                if img and img.get('alt'):
                    title = img['alt']
            
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
