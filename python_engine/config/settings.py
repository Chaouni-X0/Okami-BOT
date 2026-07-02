import os
from dotenv import load_dotenv

load_dotenv()

CONFIG = {
    "TEMP_DIR": os.getenv("TEMP_DIR", "temp_images"),
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "FB_MAX_IMAGE_HEIGHT": int(os.getenv("FB_MAX_IMAGE_HEIGHT", 1500)),
    "MAX_RETRIES": int(os.getenv("MAX_RETRIES", 3)),
    "TIMEOUT": int(os.getenv("TIMEOUT", 30)),
    "SOURCES": [
        {"name": "MangaArab", "url": "https://mangaarab.com", "type": "wp-manga"},
        {"name": "MangaLek", "url": "https://mangalek.com", "type": "wp-manga"},
        {"name": "MangaSwat", "url": "https://swatmanga.me", "type": "wp-manga"},
        {"name": "AsuraAR", "url": "https://asuratoon.com", "type": "wp-manga"},
        {"name": "TeamX", "url": "https://teamx.org", "type": "wp-manga"},
        {"name": "MoonManga", "url": "https://moonmanga.com", "type": "wp-manga"},
        {"name": "MangaOnline", "url": "https://onlinemanga.net", "type": "custom"},
        {"name": "GManga", "url": "https://gmanga.me", "type": "custom"},
        {"name": "AsuraEN", "url": "https://asuracomics.gg", "type": "custom"},
        {"name": "ReaperScans", "url": "https://reaperscans.com", "type": "custom"},
        {"name": "MangaDex", "url": "https://api.mangadex.org", "type": "api"},
        {"name": "MangaKakalot", "url": "https://mangakakalot.com", "type": "custom"}
    ]
}
