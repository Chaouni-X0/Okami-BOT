from typing import List, Dict, Any
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class MangaSwatScraper(BaseScraper):
    def __init__(self):
        super().__init__(source_name="MangaSwat", base_url="https://meshmanga.com")

    async def search(self, query: str) -> List[Dict[str, Any]]:
        # MangaSwat (meshmanga.com) is a Next.js site
        search_url = f"{self.base_url}/search?q={query.replace(' ', '+')}"
        
        soup = await self.fetch_html(search_url, wait_selector=".series-card, a[href*='/series/']")
        
        results = []
        if not soup: return results
        
        items = soup.select('.series-card a, a[href*="/series/"]')
        for item in items:
            url = item.get('href')
            if url and '/series/' in url:
                if not url.startswith('http'): url = self.base_url.rstrip('/') + url
                title = item.text.strip()
                if query.lower() in title.lower():
                    results.append({
                        'title': title,
                        'url': url,
                        'source': self.source_name
                    })
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        soup = await self.fetch_html(url, wait_selector="h1")
        if not soup: return {}
        
        return {
            'title': soup.select_one('h1').text.strip() if soup.select_one('h1') else "Unknown",
            'cover': soup.select_one('img[src*="poster"]').get('src') if soup.select_one('img[src*="poster"]') else "",
            'description': soup.select_one('.description').text.strip() if soup.select_one('.description') else "",
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        soup = await self.fetch_html(url, wait_selector="a[href*='/chapter-']")
        if not soup: return []
        
        chapters = []
        for ch in soup.select("a[href*='/chapter-']"):
            href = ch.get('href')
            if not href.startswith('http'): href = self.base_url.rstrip('/') + href
            chapters.append({
                'name': ch.text.strip(),
                'url': href
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url, wait_selector="img[src*='chapter']")
        if not soup: return []
        
        images = []
        for img in soup.select("img[src*='chapter']"):
            src = img.get('src') or img.get('data-src')
            if src:
                if not src.startswith('http'): src = 'https:' + src if src.startswith('//') else src
                images.append(src.strip())
        return images
