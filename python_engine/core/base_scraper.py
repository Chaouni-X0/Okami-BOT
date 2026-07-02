import abc
import asyncio
import aiohttp
import random
import cloudscraper
try:
    from bs4 import BeautifulSoup
except ImportError:
    try:
        from BeautifulSoup import BeautifulSoup
    except ImportError:
        # This will raise a clear error if not installed
        import BeautifulSoup
from typing import List, Dict, Any, Optional
from utils.logger import logger

class BaseScraper(abc.ABC):
    def __init__(self, source_name: str, base_url: str, use_cloudscraper: bool = False):
        self.source_name = source_name
        self.base_url = base_url
        self.use_cloudscraper = use_cloudscraper
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/108.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:108.0) Gecko/20100101 Firefox/108.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:108.0) Gecko/20100101 Firefox/108.0'
        ]
        self._session = None

    async def get_session(self):
        if self._session is None:
            if self.use_cloudscraper:
                self._session = cloudscraper.create_scraper()
            else:
                self._session = aiohttp.ClientSession()
        return self._session

    async def fetch_html(self, url: str, method: str = 'GET', retries: int = 3, timeout: int = 30, **kwargs) -> Optional[BeautifulSoup]:
        headers = kwargs.pop('headers', {})
        if 'User-Agent' not in headers:
            headers['User-Agent'] = random.choice(self.user_agents)
        session = await self.get_session()
        
        if self.use_cloudscraper:
            for attempt in range(retries):
                try:
                    # Cloudscraper is synchronous, so we run it in a thread
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, lambda: session.request(method, url, headers=headers, timeout=timeout, **kwargs))
                    response.raise_for_status()
                    return BeautifulSoup(response.text, 'html.parser')
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url} using cloudscraper: {e}")
                    if attempt < retries - 1:
                        await asyncio.sleep(2 ** attempt)
            return None
        else:
            for attempt in range(retries):
                try:
                    async with session.request(method, url, headers=headers, timeout=timeout, **kwargs) as response:
                        response.raise_for_status()
                        html = await response.text()
                        return BeautifulSoup(html, 'html.parser')
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url}: {e}")
                    if attempt < retries - 1:
                        await asyncio.sleep(2 ** attempt)
            return None

    async def fetch_json(self, url: str, method: str = 'GET', retries: int = 3, timeout: int = 30, **kwargs) -> Optional[Dict[str, Any]]:
        headers = kwargs.pop('headers', {})
        if 'User-Agent' not in headers:
            headers['User-Agent'] = random.choice(self.user_agents)
        session = await self.get_session()
        
        if self.use_cloudscraper:
            for attempt in range(retries):
                try:
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(None, lambda: session.request(method, url, headers=headers, timeout=timeout, **kwargs))
                    response.raise_for_status()
                    return response.json()
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url} using cloudscraper: {e}")
                    if attempt < retries - 1:
                        await asyncio.sleep(2 ** attempt)
            return None
        else:
            for attempt in range(retries):
                try:
                    async with session.request(method, url, headers=headers, timeout=timeout, **kwargs) as response:
                        response.raise_for_status()
                        return await response.json()
                except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url}: {e}")
                    if attempt < retries - 1:
                        await asyncio.sleep(2 ** attempt)
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
