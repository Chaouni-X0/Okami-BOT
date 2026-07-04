#!/usr/bin/env python3
import asyncio
import json
import sys
import argparse
import os
from pathlib import Path

# Add the current directory to the path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.manager import ScraperManager
from scrapers.wp_manga_scraper import WPMangaScraper
from scrapers.azora_scraper import AzoraScraper
from utils.logger import logger

async def get_manager():
    """Initialize and return the ScraperManager with all available scrapers."""
    # Updated to 2026 active URLs and requested sites only
    scrapers = [
        # meshmanga.com renders search results client-side via Next.js JS,
        # so it needs the full Playwright browser (use_cloudscraper=False).
        WPMangaScraper("MangaSwat", "https://meshmanga.com", use_cloudscraper=False),
        # asurascans.com and olympustaff.com return usable static HTML for
        # search/details, so the lightweight cloudscraper path is enough and
        # much faster/cheaper than launching a browser for every request.
        WPMangaScraper("Asura", "https://asurascans.com", use_cloudscraper=True),
        WPMangaScraper("TeamX", "https://olympustaff.com", use_cloudscraper=True),
        AzoraScraper() # Custom scraper for Azora (azorafly.com) - always Playwright, Next.js site
    ]
    return ScraperManager(scrapers)

async def run_search(query):
    """Search across all sources."""
    manager = await get_manager()
    try:
        if not query or not query.strip():
            return {"status": "error", "message": "Search query cannot be empty"}
        
        # Clean query
        query = query.strip()
        logger.info(f"[Bridge] Searching for: {query}")
        
        # Increase timeout for search
        results = await manager.search_all(query)
        
        if not results:
            logger.info(f"[Bridge] No results found for: {query}")
            return {"status": "success", "results": []}
        
        logger.info(f"[Bridge] Found {len(results)} results for: {query}")
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"[Bridge] Search error: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

async def run_details(source, url):
    """Get manga details from a specific source."""
    manager = await get_manager()
    try:
        if not source or not url:
            return {"status": "error", "message": "Source and URL are required"}
        
        logger.info(f"[Bridge] Getting details from {source}: {url}")
        
        info = await manager.get_manga_info(source, url)
        chapters = await manager.get_chapters(source, url)
        
        if not info:
            return {"status": "error", "message": f"Could not retrieve manga info from {source}"}
        
        return {
            "status": "success",
            "info": info,
            "chapters": chapters
        }
    except Exception as e:
        logger.error(f"[Bridge] Details error: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

async def run_download(source, title, chapter, url):
    """Download chapter images."""
    manager = await get_manager()
    try:
        if not source or not url:
            return {"status": "error", "message": "Source and URL are required"}
        
        logger.info(f"[Bridge] Downloading chapter from {source}: {url}")
        
        images = await manager.get_chapter_images(source, url)
        
        if not images:
            logger.warning(f"[Bridge] No images found for chapter: {url}")
            return {"status": "success", "images": []}
        
        logger.info(f"[Bridge] Found {len(images)} images")
        return {"status": "success", "images": images}
    except Exception as e:
        logger.error(f"[Bridge] Download error: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        await manager.close_all()

async def main():
    """Main entry point for the bridge."""
    parser = argparse.ArgumentParser(description='Manga Scraper Bridge')
    parser.add_argument('action', choices=['search', 'details', 'download'], 
                       help='Action to perform')
    parser.add_argument('--query', type=str, help='Search query')
    parser.add_argument('--source', type=str, help='Manga source name')
    parser.add_argument('--url', type=str, help='Manga or chapter URL')
    parser.add_argument('--title', type=str, help='Manga title')
    parser.add_argument('--chapter', type=str, help='Chapter name')
    
    args = parser.parse_args()
    
    try:
        if args.action == 'search':
            result = await run_search(args.query)
        elif args.action == 'details':
            result = await run_details(args.source, args.url)
        elif args.action == 'download':
            result = await run_download(args.source, args.title, args.chapter, args.url)
        else:
            result = {"status": "error", "message": f"Unknown action: {args.action}"}
        
        # Ensure ONLY JSON is printed to stdout
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"[Bridge] Fatal error: {str(e)}")
        sys.stdout.write(json.dumps({"status": "error", "message": str(e)}) + "\n")
        sys.stdout.flush()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
