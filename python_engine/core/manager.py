import asyncio
from typing import List, Dict, Any, Optional

from core.base_scraper import BaseScraper
from utils.logger import logger

class ScraperManager:
    def __init__(self, scrapers: List[BaseScraper]):
        self.scrapers = {scraper.source_name: scraper for scraper in scrapers}
        logger.info(f"Initialized ScraperManager with {len(self.scrapers)} scrapers.")

    async def search_all(self, query: str) -> List[Dict[str, Any]]:
        tasks = []
        for name, scraper in self.scrapers.items():
            tasks.append(self._run_search_with_fallback(scraper, query))
        
        results = await asyncio.gather(*tasks)
        
        all_results = []
        for res_list in results:
            if res_list:
                all_results.extend(res_list)
        
        logger.info(f"Found {len(all_results)} results for query: {query}")
        return all_results

    async def _run_search_with_fallback(self, scraper: BaseScraper, query: str) -> List[Dict[str, Any]]:
        try:
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
            return await scraper.get_chapter_images(chapter_url)
        except Exception as e:
            logger.error(f"Failed to get chapter images from {source_name} ({chapter_url}): {e}")
            return []

    async def close_all(self):
        for scraper in self.scrapers.values():
            await scraper.close()
        logger.info("All scrapers closed.")
