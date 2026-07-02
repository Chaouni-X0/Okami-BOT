import asyncio
from core.manager import ScraperManager
from scrapers.wp_manga_scraper import WPMangaScraper
from scrapers.mangadex_scraper import MangaDexScraper
from scrapers.gmanga_scraper import GMangaScraper
from utils.image_processor import ImageProcessor
from utils.logger import logger

async def main():
    # Initialize scrapers
    scrapers = [
        WPMangaScraper("MangaArab", "https://mangaarab.com"),
        WPMangaScraper("Asura", "https://asuratoon.com"),
        WPMangaScraper("TeamX", "https://teamx.org"),
        MangaDexScraper(),
        GMangaScraper()
    ]
    
    manager = ScraperManager(scrapers)
    processor = ImageProcessor()

    try:
        # 1. Search
        query = "Solo Leveling"
        print(f"🔍 Searching for: {query}...")
        results = await manager.search_all(query)
        
        if not results:
            print("❌ No results found.")
            return

        for i, res in enumerate(results[:5]):
            print(f"{i+1}. {res['title']} ({res['source']})")

        # 2. Get Details & Chapters (using first result)
        selected = results[0]
        print(f"\n📖 Getting details for: {selected['title']} from {selected['source']}...")
        info = await manager.get_manga_info(selected['source'], selected['url'])
        chapters = await manager.get_chapters(selected['source'], selected['url'])
        
        print(f"✅ Found {len(chapters)} chapters.")
        if chapters:
            latest = chapters[0]
            print(f"🚀 Latest Chapter: {latest['name']}")
            
            # 3. Get Images
            print(f"🖼️ Fetching images for {latest['name']}...")
            images = await manager.get_chapter_images(selected['source'], latest['url'])
            print(f"✅ Found {len(images)} images.")
            
            # 4. Process Images (Slicing for FB)
            if images:
                print("⚙️ Processing and slicing images for Facebook...")
                paths = await processor.process_chapter(selected['title'], latest['name'], images)
                print(f"✅ Done! {len(paths)} image parts saved in temp_images/")

    finally:
        await manager.close_all()

if __name__ == "__main__":
    asyncio.run(main())
