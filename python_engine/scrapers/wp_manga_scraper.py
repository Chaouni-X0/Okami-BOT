from typing import List, Dict, Any
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class WPMangaScraper(BaseScraper):
    async def search(self, query: str) -> List[Dict[str, Any]]:
        search_url = f"{self.base_url}/?s={query.replace(' ', '+')}&post_type=wp-manga"
        
        # Playwright helps bypass Cloudflare 503 and wait for JS results
        soup = await self.fetch_html(search_url, wait_selector=".c-tabs-item__content, .post-title, .search-wrap")
        
        results = []
        if not soup: return results
        
        items = soup.select('.c-tabs-item__content, .manga-item, .post-title a')
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
        soup = await self.fetch_html(url, wait_selector="h1, .post-title")
        if not soup: return {}
        
        return {
            'title': soup.select_one('h1, .post-title').text.strip() if soup.select_one('h1, .post-title') else "Unknown",
            'cover': soup.select_one('.summary_image img, .post-thumb img').get('src') if soup.select_one('.summary_image img, .post-thumb img') else "",
            'description': soup.select_one('.description-summary, .summary__content').text.strip() if soup.select_one('.description-summary, .summary__content') else "",
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        soup = await self.fetch_html(url, wait_selector=".wp-manga-chapter, .chapter-link")
        if not soup: return []
        
        chapters = []
        for ch in soup.select('.wp-manga-chapter a, .chapter-link'):
            chapters.append({
                'name': ch.text.strip(),
                'url': ch.get('href')
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        soup = await self.fetch_html(chapter_url, wait_selector=".reading-content img, .page-break img")
        if not soup: return []
        
        images = []
        for img in soup.select('.reading-content img, .page-break img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src and not any(x in src.lower() for x in ["logo", "banner"]):
                images.append(src.strip())
        return images
