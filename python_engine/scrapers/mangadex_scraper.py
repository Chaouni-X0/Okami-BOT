from core.base_scraper import BaseScraper
from typing import List, Dict, Any, Optional

class MangaDexScraper(BaseScraper):
    def __init__(self):
        super().__init__("MangaDex", "https://api.mangadex.org")

    async def search(self, query: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/manga"
        params = {'title': query, 'limit': 10}
        data = await self.fetch_json(url, params=params)
        if not data: return []
        
        results = []
        for manga in data.get('data', []):
            title = manga['attributes']['title'].get('en') or list(manga['attributes']['title'].values())[0]
            results.append({
                'title': title,
                'url': f"https://mangadex.org/title/{manga['id']}",
                'id': manga['id'],
                'source': self.source_name
            })
        return results

    async def get_manga_info(self, url: str) -> Dict[str, Any]:
        manga_id = url.split('/')[-1]
        api_url = f"{self.base_url}/manga/{manga_id}"
        data = await self.fetch_json(api_url)
        if not data: return {}
        
        manga = data['data']
        title = manga['attributes']['title'].get('en') or list(manga['attributes']['title'].values())[0]
        desc = manga['attributes']['description'].get('en') or list(manga['attributes']['description'].values())[0]
        
        return {
            'title': title,
            'description': desc,
            'source': self.source_name
        }

    async def get_chapters(self, url: str) -> List[Dict[str, Any]]:
        manga_id = url.split('/')[-1]
        api_url = f"{self.base_url}/manga/{manga_id}/feed"
        params = {'translatedLanguage[]': ['en', 'ar'], 'limit': 100, 'order[chapter]': 'desc'}
        data = await self.fetch_json(api_url, params=params)
        if not data: return []
        
        chapters = []
        for ch in data.get('data', []):
            chapters.append({
                'name': f"Chapter {ch['attributes']['chapter']} - {ch['attributes']['title'] or ''}",
                'url': f"https://mangadex.org/chapter/{ch['id']}",
                'id': ch['id']
            })
        return chapters

    async def get_chapter_images(self, chapter_url: str) -> List[str]:
        chapter_id = chapter_url.split('/')[-1]
        api_url = f"{self.base_url}/at-home/server/{chapter_id}"
        data = await self.fetch_json(api_url)
        if not data: return []
        
        base_url = data['baseUrl']
        hash = data['chapter']['hash']
        files = data['chapter']['data']
        
        return [f"{base_url}/data/{hash}/{f}" for f in files]
