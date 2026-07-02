import asyncio
import sys
import json
import argparse
from core.manager import ScraperManager
from scrapers.wp_manga_scraper import WPMangaScraper
from scrapers.mangadex_scraper import MangaDexScraper
from scrapers.gmanga_scraper import GMangaScraper
from utils.image_processor import ImageProcessor
from config.settings import CONFIG

async def run_search(query):
    scrapers = [
        WPMangaScraper("MangaArab", "https://mangaarab.com"),
        WPMangaScraper("Asura", "https://asuratoon.com"),
        WPMangaScraper("TeamX", "https://teamx.org"),
        MangaDexScraper(),
        GMangaScraper()
    ]
    manager = ScraperManager(scrapers)
    try:
        results = await manager.search_all(query)
        return results
    finally:
        await manager.close_all()

async def run_details(source, url):
    scrapers = [
        WPMangaScraper("MangaArab", "https://mangaarab.com"),
        WPMangaScraper("Asura", "https://asuratoon.com"),
        WPMangaScraper("TeamX", "https://teamx.org"),
        MangaDexScraper(),
        GMangaScraper()
    ]
    manager = ScraperManager(scrapers)
    try:
        info = await manager.get_manga_info(source, url)
        chapters = await manager.get_chapters(source, url)
        return {"info": info, "chapters": chapters}
    finally:
        await manager.close_all()

async def run_download(source, manga_title, chapter_name, chapter_url):
    scrapers = [
        WPMangaScraper("MangaArab", "https://mangaarab.com"),
        WPMangaScraper("Asura", "https://asuratoon.com"),
        WPMangaScraper("TeamX", "https://teamx.org"),
        MangaDexScraper(),
        GMangaScraper()
    ]
    manager = ScraperManager(scrapers)
    processor = ImageProcessor(temp_dir="../data/temp")
    try:
        images = await manager.get_chapter_images(source, chapter_url)
        if not images:
            return {"error": "No images found"}
        
        paths = await processor.process_chapter(manga_title, chapter_name, images)
        return {"images": paths}
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
    if args.action == "search":
        res = loop.run_until_complete(run_search(args.query))
    elif args.action == "details":
        res = loop.run_until_complete(run_details(args.source, args.url))
    elif args.action == "download":
        res = loop.run_until_complete(run_download(args.source, args.title, args.chapter, args.url))
    
    print(json.dumps(res))
