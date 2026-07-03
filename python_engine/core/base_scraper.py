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
        if 'Referer' not in headers and "mangadex.org" not in self.base_url:
            headers['Referer'] = self.base_url
        session = await self.get_session()
        
        if self.use_cloudscraper:
            for attempt in range(retries):
                try:
                    # Cloudscraper is synchronous, so we run it in a thread
                    loop = asyncio.get_event_loop()
                    # Ensure we pass params correctly to cloudscraper/requests
                    params = kwargs.get('params')
                    
                    # Madara sites often need specific headers to bypass Cloudflare
                    headers.update({
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                        'Cache-Control': 'max-age=0',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1'
                    })
                    
                    def _request():
                        return session.request(method, url, headers=headers, timeout=timeout, params=params, **{k: v for k, v in kwargs.items() if k != 'params'})
                    
                    response = await loop.run_in_executor(None, _request)
                    response.raise_for_status()
                    return BeautifulSoup(response.text, 'html.parser')
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url} using cloudscraper: {e}")
                    try:
                        if hasattr(e, 'response') and e.response is not None:
                            logger.error(f"Response content: {e.response.text[:500]}")
                    except: pass
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
        if 'Referer' not in headers and "mangadex.org" not in self.base_url:
            headers['Referer'] = self.base_url
        session = await self.get_session()
        
        if self.use_cloudscraper:
            for attempt in range(retries):
                try:
                    loop = asyncio.get_event_loop()
                    params = kwargs.get('params')
                    
                    headers.update({
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
                        'Sec-Ch-Ua-Mobile': '?0',
                        'Sec-Ch-Ua-Platform': '"Windows"',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    })
                    

                    def _request():
                        return session.request(method, url, headers=headers, timeout=timeout, params=params, **{k: v for k, v in kwargs.items() if k != 'params'})
                    
                    response = await loop.run_in_executor(None, _request)
                    response.raise_for_status()
                    return response.json()
                except Exception as e:
                    logger.error(f"Attempt {attempt + 1} failed for {url} using cloudscraper: {e}")
                    try:
                        if hasattr(e, 'response') and e.response is not None:
                            logger.error(f"Response content: {e.response.text[:500]}")
                    except: pass
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
