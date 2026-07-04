import abc
import asyncio
import random
import time
from typing import List, Dict, Any, Optional
from utils.logger import logger
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from bs4 import BeautifulSoup

class BaseScraper(abc.ABC):
    def __init__(self, source_name: str, base_url: str):
        self.source_name = source_name
        self.base_url = base_url
        self.playwright = None
        self.browser = None
        self.context = None
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]

    async def _init_browser(self):
        if not self.browser:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                user_agent=random.choice(self.user_agents),
                viewport={'width': 1280, 'height': 720}
            )
            logger.info(f"[{self.source_name}] Playwright browser initialized.")

    async def fetch_page_content(self, url: str, wait_selector: Optional[str] = None, timeout: int = 30000) -> Optional[str]:
        """Fetch page content using Playwright to handle JS and Cloudflare."""
        await self._init_browser()
        page = await self.context.new_page()
        await stealth_async(page)
        
        try:
            logger.info(f"[{self.source_name}] Navigating to: {url}")
            # Use 'domcontentloaded' for faster response if wait_selector is provided
            await page.goto(url, wait_until='domcontentloaded', timeout=timeout)
            
            # Handle Cloudflare / Wait for content
            if wait_selector:
                try:
                    await page.wait_for_selector(wait_selector, timeout=10000)
                except:
                    logger.warning(f"[{self.source_name}] Timeout waiting for selector: {wait_selector}")
            else:
                # Basic wait if no selector
                await asyncio.sleep(2)
            
            content = await page.content()
            return content
        except Exception as e:
            logger.error(f"[{self.source_name}] Playwright error fetching {url}: {str(e)}")
            return None
        finally:
            await page.close()

    async def fetch_html(self, url: str, wait_selector: Optional[str] = None) -> Optional[BeautifulSoup]:
        content = await self.fetch_page_content(url, wait_selector)
        if content:
            return BeautifulSoup(content, 'html.parser')
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
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.browser = None
        self.playwright = None
        logger.info(f"[{self.source_name}] Playwright browser closed.")
