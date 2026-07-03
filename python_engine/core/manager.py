import asyncio
import time
from typing import List, Dict, Any, Optional
try:
    from core.base_scraper import BaseScraper
except ImportError:
    from .base_scraper import BaseScraper
from utils.logger import logger

class ScraperManager:
    # Class-level cache to persist across instances in the same process
    _search_cache = {}
    CACHE_DURATION = 900 # 15 minutes

    def __init__(self, scrapers: List[BaseScraper]):
        self.scrapers = {scraper.source_name: scraper for scraper in scrapers}
        logger.info(f"Initialized ScraperManager with {len(self.scrapers)} scrapers.")

    async def search_all(self, query: str) -> List[Dict[str, Any]]:
        query = query.strip().lower()
        
        # Check Cache
        current_time = time.time()
        if query in self._search_cache:
            cache_data, timestamp = self._search_cache[query]
            if current_time - timestamp < self.CACHE_DURATION:
                logger.info(f"[Cache] Returning cached results for: {query}")
                return cache_data

        # Parallel Execution
        tasks = []
        for name, scraper in self.scrapers.items():
            tasks.append(self._safe_search(scraper, query))
        
        logger.info(f"[Manager] Starting parallel search for: {query}")
        results_lists = await asyncio.gather(*tasks)
        
        all_results = []
        for i, res in enumerate(results_lists):
            if res:
                all_results.extend(res)
        
        # Final unique check based on URL
        unique_results = []
        seen_urls = set()
        for item in all_results:
            if item['url'] not in seen_urls:
                unique_results.append(item)
                seen_urls.add(item['url'])

        logger.info(f"[Manager] Total unique results found: {len(unique_results)}")
        
        # Save to Cache
        self._search_cache[query] = (unique_results, current_time)
        
        return unique_results

    async def _safe_search(self, scraper: BaseScraper, query: str) -> List[Dict[str, Any]]:
        try:
            start_time = time.time()
            results = await scraper.search(query)
            duration = time.time() - start_time
            logger.info(f"[{scraper.source_name}] Found {len(results)} results in {duration:.2f}s")
            return results
        except Exception as e:
            logger.error(f"[{scraper.source_name}] Search failed: {str(e)}")
            return []

    async def get_manga_info(self, source_name: str, url: str) -> Optional[Dict[str, Any]]:
        scraper = self.scrapers.get(source_name)
        if not scraper: return None
        try:
            return await scraper.get_manga_info(url)
        except Exception as e:
            logger.error(f"[{source_name}] Info error: {str(e)}")
            return None

    async def get_chapters(self, source_name: str, url: str) -> List[Dict[str, Any]]:
        scraper = self.scrapers.get(source_name)
        if not scraper: return []
        try:
            return await scraper.get_chapters(url)
        except Exception as e:
            logger.error(f"[{source_name}] Chapters error: {str(e)}")
            return []

    async def get_chapter_images(self, source_name: str, chapter_url: str) -> List[str]:
        scraper = self.scrapers.get(source_name)
        if not scraper: return []
        try:
            return await scraper.get_chapter_images(chapter_url)
        except Exception as e:
            logger.error(f"[{source_name}] Images error: {str(e)}")
            return []

    async def close_all(self):
        tasks = [scraper.close() for scraper in self.scrapers.values()]
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("All scrapers closed.")
