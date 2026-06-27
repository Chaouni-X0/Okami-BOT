# -*- coding: utf-8 -*-

from .azora import AzoraScraper
from .swat import SwatScraper
from .teamx import TeamXScraper
from .mangaarab import MangaArabScraper
from .galaxymanga import GalaxyMangaScraper
from .mangalek import MangaLekScraper
from .aresmanga import AresMangaScraper

# قائمة المواقع المدعومة
SUPPORTED_SCRAPERS = {
    'Azora Moon': AzoraScraper,
    'Swat Manga': SwatScraper,
    'Team X': TeamXScraper,
    'Manga Al-Arab': MangaArabScraper,
    'Galaxy Manga': GalaxyMangaScraper,
    'Manga Lek': MangaLekScraper,
    'Ares Manga': AresMangaScraper,
}
