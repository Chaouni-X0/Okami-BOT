from typing import List, Dict, Any
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class TeamXScraper(BaseScraper):
    def __init__(self):
        super().__init__(source_name="TeamX", base_url="https://olympustaff.com")

    async def search(self, query: str) -> List[Dict[str, Any]]:
        # TeamX (olympustaff.com) uses WP-Manga with heavy Cloudflare
        search_url = f"{self.base_url}/?s={query.replace(' ', '+')}&post_type=wp-manga"
        
        soup = await self.fetch_html(search_url, wait_selector=".c-tabs-item__content, .post-title")
        
        results = []
        if not soup: return results
        
        items = soup.select('.c-tabs-item__content, .post-title a')
        for item in items:
            link = item.select_one('a') if not item.name == 'a' else item
            if link and link.get('href'):
                title = link.text.strip()
                url = link.get('href')
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
            'cover': soup.select_one('.summary_image img').get('src') if soup.select_one('.summary_image img') else "",
            'description': soup.select_one('.description-summary').text.strip() if soup.select_one('.description-summary') else "",
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        soup = await self.fetch_html(url, wait_selector=".wp-manga-chapter")
        if not soup: return []
        
        chapters = []
        for ch in soup.select('.wp-manga-chapter a'):
            chapters.append({
                'name': ch.text.strip(),
                'url': ch.get('href')
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url, wait_selector=".reading-content img")
        if not soup: return []
        
        images = []
        for img in soup.select('.reading-content img'):
            src = img.get('src') or img.get('data-src')
            if src and not any(x in src.lower() for x in ["logo", "banner"]):
                images.append(src.strip())
        return images
