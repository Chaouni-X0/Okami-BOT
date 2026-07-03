import abc
import asyncio
import aiohttp
import random
import cloudscraper
import time
from typing import List, Dict, Any, Optional
from utils.logger import logger

try:
    from bs4 import BeautifulSoup
except ImportError:
    import BeautifulSoup

class BaseScraper(abc.ABC):
    def __init__(self, source_name: str, base_url: str, use_cloudscraper: bool = False):
        self.source_name = source_name
        self.base_url = base_url
        self.use_cloudscraper = use_cloudscraper
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        self._session = None

    async def get_session(self):
        if self._session is None:
            if self.use_cloudscraper:
                self._session = cloudscraper.create_scraper()
            else:
                self._session = aiohttp.ClientSession()
        return self._session

    async def fetch_html(self, url: str, method: str = 'GET', retries: int = 2, timeout: int = 15, **kwargs) -> Optional[BeautifulSoup]:
        headers = kwargs.pop('headers', {})
        if 'User-Agent' not in headers:
            headers['User-Agent'] = random.choice(self.user_agents)
        headers['Referer'] = url if url.startswith(self.base_url) else self.base_url
        
        session = await self.get_session()
        
        for attempt in range(retries):
            try:
                # First attempt uses shorter timeout
                current_timeout = 5 if attempt == 0 else timeout
                
                if self.use_cloudscraper:
                    loop = asyncio.get_event_loop()
                    def _request():
                        return session.request(method, url, headers=headers, timeout=current_timeout, **kwargs)
                    
                    response = await loop.run_in_executor(None, _request)
                    
                    if response.status_code == 404:
                        logger.warning(f"[Scraper] 404 Not Found for {url} - Skipping retries.")
                        return None
                        
                    response.raise_for_status()
                    return BeautifulSoup(response.text, 'html.parser')
                else:
                    async with session.request(method, url, headers=headers, timeout=current_timeout, **kwargs) as response:
                        if response.status == 404:
                            logger.warning(f"[Scraper] 404 Not Found for {url} - Skipping retries.")
                            return None
                        
                        response.raise_for_status()
                        html = await response.text()
                        return BeautifulSoup(html, 'html.parser')
                        
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed for {url}: {str(e)}")
                if attempt < retries - 1:
                    await asyncio.sleep(1)
        return None

    @abc.abstractmethod
    async def search(self, query: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        pass

    async def close(self):
        if self._session:
            if not self.use_cloudscraper:
                await self._session.close()
            else:
                self._session.close()
            self._session = None
