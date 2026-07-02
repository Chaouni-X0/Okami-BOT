import asyncio
import sys
import json
import argparse
import os

# Add the current directory to path to ensure imports work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.manager import ScraperManager
from scrapers.wp_manga_scraper import WPMangaScraper
from scrapers.mangadex_scraper import MangaDexScraper
from scrapers.gmanga_scraper import GMangaScraper
from utils.image_processor import ImageProcessor

async def get_manager():
    scrapers = [
        WPMangaScraper("MangaArab", "https://mangaarab.com"),
        WPMangaScraper("Asura", "https://asuratoon.com"),
        WPMangaScraper("TeamX", "https://teamx.org"),
        WPMangaScraper("MangaLek", "https://mangalek.com"),
        WPMangaScraper("MangaSwat", "https://swatmanga.me"),
        WPMangaScraper("MoonManga", "https://moonmanga.com"),
        MangaDexScraper(),
        GMangaScraper()
    ]
    return ScraperManager(scrapers)

async def run_search(query):
    manager = await get_manager()
    try:
        # Clean query
        query = query.strip()
        results = await manager.search_all(query)
        return {"status": "success", "results": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

async def run_details(source, url):
    manager = await get_manager()
    try:
        info = await manager.get_manga_info(source, url)
        chapters = await manager.get_chapters(source, url)
        return {"status": "success", "info": info, "chapters": chapters}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

async def run_download(source, manga_title, chapter_name, chapter_url):
    manager = await get_manager()
    processor = ImageProcessor(temp_dir="../data/temp")
    try:
        images = await manager.get_chapter_images(source, chapter_url)
        if not images:
            return {"status": "error", "message": "No images found"}
        
        paths = await processor.process_chapter(manga_title, chapter_name, images)
        return {"status": "success", "images": paths}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["search", "details", "download"])
    parser.add_argument("--query")
    parser.add_argument("--source")
    parser.add_argument("--url")
    parser.add_argument("--title")
    parser.add_argument("--chapter")
    
    args = parser.parse_args()
    
    loop = asyncio.get_event_loop()
    try:
        if args.action == "search":
            res = loop.run_until_complete(run_search(args.query))
        elif args.action == "details":
            res = loop.run_until_complete(run_details(args.source, args.url))
        elif args.action == "download":
            res = loop.run_until_complete(run_download(args.source, args.title, args.chapter, args.url))
        else:
            res = {"status": "error", "message": "Invalid action"}
    except Exception as e:
        res = {"status": "error", "message": f"Global error: {str(e)}"}
    
    # Ensure ONLY the JSON is printed to stdout
    print(json.dumps(res))
