# Okami-BOT Development Log - July 03, 2026

## Goal
Improve the search system and ensure Arabic manga sites work at 100% efficiency on Railway.

## Current Findings
- **MangaDex**: API search was returning 403/400 due to incorrect parameter handling in `base_scraper.py` and `mangadex_scraper.py`.
- **Arabic Sites**:
    - `mangaarab.com` -> `www.mangaarabia.com` (Working)
    - `lek-manga.net` (Working, uses Madara, Cloudflare protected)
    - `asurascans.com` (Working, uses Madara, Cloudflare protected)
    - `swatmanga.me` (Working, uses Madara, Cloudflare protected)
    - `teamxmanga.store` (Potential working domain for TeamX)
    - `gmanga.me` (Cloudflare Error 1000, needs investigation or alternative)
- **Madara Scraper**: Selectors were outdated for some sites.
- **Railway Deployment**: Log showed `SIGTERM` and `ModuleNotFoundError`, indicating dependency and environment issues.

## Actions Taken
1.  **Dependencies**: Installed `aiohttp`, `cloudscraper`, `beautifulsoup4` in the sandbox. Updated `requirements.txt`.
2.  **Base Scraper**: Fixed `fetch_html` and `fetch_json` to correctly pass `params` to `cloudscraper` and added `Referer` header.
3.  **MangaDex**: Simplified search parameters to fix 400 errors.
4.  **Madara Scraper**: Improved search selectors and added duplicate URL filtering.
5.  **Manager**: Added `asyncio.wait_for` and `return_exceptions=True` to `search_all` to prevent slow sources from blocking the entire search.
6.  **Bridge**: Updated domains and enabled `use_cloudscraper=True` for Arabic sites.

## Next Steps
- Test the updated engine with the fixed `params` handling.
- Verify `GManga` alternative or fix.
- Finalize the search system and push to GitHub.
