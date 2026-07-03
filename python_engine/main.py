import asyncio
from core.manager import ScraperManager
from scrapers.wp_manga_scraper import WPMangaScraper
from scrapers.azora_scraper import AzoraScraper
from utils.image_processor import ImageProcessor
from utils.logger import logger

async def main():
    # Initialize scrapers for the requested 4 sites only
    # Updated with 2026 active URLs
    scrapers = [
        WPMangaScraper("MangaSwat", "https://meshmanga.com", use_cloudscraper=True),
        WPMangaScraper("Asura", "https://asurascans.com", use_cloudscraper=True),
        WPMangaScraper("TeamX", "https://olympustaff.com", use_cloudscraper=True),
        AzoraScraper()
    ]
    
    manager = ScraperManager(scrapers)
    processor = ImageProcessor()

    try:
        # Example Search
        query = "Solo Leveling"
        print(f"🔍 Searching for: {query} in requested sites...")
        results = await manager.search_all(query)
        
        if not results:
            print("❌ No results found.")
            return

        print(f"✅ Found {len(results)} total results.")
        for i, res in enumerate(results[:10]):
            print(f"{i+1}. {res['title']} ({res['source']})")

    finally:
        await manager.close_all()

if __name__ == "__main__":
    asyncio.run(main())
