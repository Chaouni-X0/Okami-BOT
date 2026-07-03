from typing import List, Dict, Any, Optional
import json
try:
    from core.base_scraper import BaseScraper
except ImportError:
    from ..core.base_scraper import BaseScraper

class GMangaScraper(BaseScraper):
    def __init__(self):
        super().__init__("GManga", "https://gmanga.me", use_cloudscraper=True)

    async def search(self, query: str) -> List[Dict[str, Any]]:
        # GManga API is often protected, try the main site search first
        url = f"{self.base_url}/mangas?search={query}"
        soup = await self.fetch_html(url)
        if not soup: return []
        
        results = []
        # Try to find manga items in the search page
        for item in soup.select('.manga-item, .manga-card, a[href*="/mangas/"]'):
            title_tag = item.select_one('.title, h3, h2') or item
            if '/mangas/' in item.get('href', '') and title_tag.text.strip():
                results.append({
                    'title': title_tag.text.strip(),
                    'url': self.base_url + item['href'] if item['href'].startswith('/') else item['href'],
                    'source': self.source_name
                })
        
        if results: return results

        # Fallback to API if page search fails
        url = f"{self.base_url}/api/mangas/search"
        params = {'title': query}
        headers = {
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': self.base_url
        }
        data = await self.fetch_json(url, params=params, headers=headers)
        if not data: return []
        
        results = []
        for m in data.get('mangas', []):
            results.append({
                'title': m['title'],
                'url': f"{self.base_url}/mangas/{m['id']}/{m['slug']}",
                'id': m['id'],
                'source': self.source_name
            })
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        # GManga often embeds data in the page as JSON
        soup = await self.fetch_html(url)
        if not soup: return {}
        
        # Extract title from meta or h1
        title = soup.select_one('h1.manga-name').text.strip() if soup.select_one('h1.manga-name') else ""
        desc = soup.select_one('.manga-summary').text.strip() if soup.select_one('.manga-summary') else ""
        
        return {
            'title': title,
            'description': desc,
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        manga_id = url.split('/')[-2]
        api_url = f"{self.base_url}/api/mangas/{manga_id}/releases"
        headers = {'X-Requested-With': 'XMLHttpRequest'}
        data = await self.fetch_json(api_url, headers=headers)
        if not data: return []
        
        chapters = []
        for release in data.get('releases', []):
            chapters.append({
                'name': f"Chapter {release['chapter']}",
                'url': f"{self.base_url}/mangas/{manga_id}/releases/{release['id']}",
                'id': release['id']
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        # GManga uses a complex reader, often needs to extract from scripts
        soup = await self.fetch_html(chapter_url)
        if not soup: return []
        
        # Look for the script containing chapter data
        images = []
        # This is a simplified version, real GManga scraping might need more logic
        for img in soup.select('.reader-images img'):
            src = img.get('src') or img.get('data-src')
            if src: images.append(src)
        return images
