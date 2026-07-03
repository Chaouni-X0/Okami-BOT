import asyncio
from typing import List, Dict, Any, Optional
try:
    from core.base_scraper import BaseScraper
except ImportError:
    from .base_scraper import BaseScraper
from utils.logger import logger

class ScraperManager:
    def __init__(self, scrapers: List[BaseScraper]):
        self.scrapers = {scraper.source_name: scraper for scraper in scrapers}
        logger.info(f"Initialized ScraperManager with {len(self.scrapers)} scrapers.")

    async def search_all(self, query: str) -> List[Dict[str, Any]]:
        tasks = []
        for name, scraper in self.scrapers.items():
            # Add timeout to each scraper task to prevent one slow source from blocking all
            tasks.append(asyncio.wait_for(self._run_search_with_fallback(scraper, query), timeout=25.0))
        
        # Use return_exceptions=True to ensure one failure doesn't crash the whole search
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_results = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"Scraper task failed: {res}")
                continue
            if res:
                all_results.extend(res)
        
        logger.info(f"Found {len(all_results)} results for query: {query}")
        return all_results

    async def _run_search_with_fallback(self, scraper: BaseScraper, query: str) -> List[Dict[str, Any]]:
        try:
            await scraper.get_session()
            return await scraper.search(query)
        except Exception as e:
            logger.error(f"Search failed for {scraper.source_name}: {e}")
            return []

    async def get_manga_info(self, source_name: str, url: str) -> Optional[Dict[str, Any]]:
        scraper = self.scrapers.get(source_name)
        if not scraper:
            logger.warning(f"Scraper for source {source_name} not found.")
            return None
        try:
            await scraper.get_session()
            return await scraper.get_manga_info(url)
        except Exception as e:
            logger.error(f"Failed to get manga info from {source_name} ({url}): {e}")
            return None

    async def get_chapters(self, source_name: str, url: str) -> List[Dict[str, Any]]:
        scraper = self.scrapers.get(source_name)
        if not scraper:
            logger.warning(f"Scraper for source {source_name} not found.")
            return []
        try:
            await scraper.get_session()
            return await scraper.get_chapters(url)
        except Exception as e:
            logger.error(f"Failed to get chapters from {source_name} ({url}): {e}")
            return []

    async def get_chapter_images(self, source_name: str, chapter_url: str) -> List[str]:
        scraper = self.scrapers.get(source_name)
        if not scraper:
            logger.warning(f"Scraper for source {source_name} not found.")
            return []
        try:
            await scraper.get_session()
            return await scraper.get_chapter_images(chapter_url)
        except Exception as e:
            logger.error(f"Failed to get chapter images from {source_name} ({chapter_url}): {e}")
            return []

    async def close_all(self):
        for scraper in self.scrapers.values():
            try:
                await scraper.close()
            except:
                pass
        logger.info("All scrapers closed.")
