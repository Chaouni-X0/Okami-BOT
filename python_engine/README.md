# Professional Multi-Source Manga Scraper

A production-ready Python system for scraping manga from multiple Arabic and English sources, designed for scalability and integration with bots (Facebook, Telegram, etc.).

## Features
- **Multi-Source Support**: Built-in support for 12+ major manga sites.
- **Async Architecture**: Powered by `asyncio` and `aiohttp` for high performance.
- **Bypass Protection**: Integrated `cloudscraper` for Cloudflare protection.
- **Facebook Optimized**: Automatic image slicing to fit Facebook's image height limits.
- **Modular Design**: Easy to add new sources by extending `BaseScraper`.
- **Fallback System**: Automatically handles failures across multiple sources.

## Project Structure
- `core/`: Base classes and Scraper Manager.
- `scrapers/`: Individual site implementations.
- `utils/`: Image processing, logging, and helpers.
- `config/`: Global settings and environment variables.
- `main.py`: Example CLI usage.

## Installation
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run the example:
   ```bash
   python main.py
   ```

## Supported Sites
1. Manga Arab
2. Manga Lek
3. Manga Swat
4. Asura (AR)
5. Team X
6. Moon Manga
7. Manga Online
8. GManga
9. Asura Scans (EN)
10. Reaper Scans
11. MangaDex (API)
12. MangaKakalot
