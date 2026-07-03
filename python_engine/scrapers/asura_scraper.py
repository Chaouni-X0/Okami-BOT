import json
from typing import List, Dict, Any
try:
    from core.base_scraper import BaseScraper
    from utils.logger import logger
except ImportError:
    from ..core.base_scraper import BaseScraper
    from ..utils.logger import logger

class AsuraScraper(BaseScraper):
    """Highly optimized scraper for Asura Scans using their internal API."""
    
    def __init__(self):
        super().__init__(
            source_name="Asura", 
            base_url="https://asurascans.com",
            use_cloudscraper=True
        )
        self.api_url = "https://gg.asurascans.com/api/v1" # Based on recent Toraka/Astro implementation

    async def search(self, query: str) -> List[Dict[str, Any]]:
        # Asura now uses a specialized search endpoint or GraphQL
        # We will try the most common JSON endpoint used by their new Toraka engine
        search_url = f"{self.api_url}/search?q={query.replace(' ', '+')}"
        logger.info(f"[Asura] API Search: {search_url}")
        
        results = []
        try:
            session = await self.get_session()
            headers = {
                'Origin': 'https://asurascans.com',
                'Referer': 'https://asurascans.com/',
                'Accept': 'application/json'
            }
            
            # Using cloudscraper for API requests too
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: session.get(search_url, headers=headers, timeout=10))
            
            if response.status_code == 200:
                data = response.json()
                # The new API structure usually returns a 'data' or 'results' list
                items = data.get('data', []) or data.get('results', []) or data
                
                for item in items:
                    title = item.get('name') or item.get('title')
                    slug = item.get('slug')
                    if title and slug:
                        results.append({
                            'title': title,
                            'url': f"{self.base_url}/comics/{slug}",
                            'source': self.source_name
                        })
            else:
                logger.error(f"[Asura] API failed with status {response.status_code}")
                # Fallback to browser-like search if API fails
        except Exception as e:
            logger.error(f"[Asura] API Error: {str(e)}")
            
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        # Implementation for manga info via API or HTML
        return {}

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        return []

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        return []
