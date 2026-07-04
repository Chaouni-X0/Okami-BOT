const logger = require('../utils/logger');
const AsuraScraper = require('./sources/asura');
const MangaSwatScraper = require('./sources/mangaswat');
const TeamXScraper = require('./sources/teamx');
const AzoraScraper = require('./sources/azora');

class ScraperManager {
    constructor() {
        this.scrapers = {
            asura: new AsuraScraper(),
            mangaswat: new MangaSwatScraper(),
            teamx: new TeamXScraper(),
            azora: new AzoraScraper()
        };
    }

    async search(query) {
        logger.info(`[ScraperManager] Searching for: ${query}`);
        const promises = Object.values(this.scrapers).map(async (scraper) => {
            try {
                const results = await scraper.search(query);
                return { success: true, source: scraper.sourceName, results };
            } catch (error) {
                logger.error(`[ScraperManager] Search failed for ${scraper.sourceName}: ${error.message}`);
                return { success: false, source: scraper.sourceName, error: error.message, results: [] };
            }
        });

        const responses = await Promise.all(promises);
        const allResults = responses.flatMap(r => r.results);
        
        return {
            success: true,
            total: allResults.length,
            results: allResults,
            details: responses.map(r => ({ source: r.source, count: r.results.length, success: r.success }))
        };
    }

    async getDetails(sourceId, url) {
        const scraper = this.scrapers[sourceId.toLowerCase()];
        if (!scraper) throw new Error(`Unknown source: ${sourceId}`);

        try {
            const info = await scraper.getMangaInfo(url);
            const chapters = await scraper.getChapters(url);
            return { success: true, source: sourceId, info, chapters };
        } catch (error) {
            logger.error(`[ScraperManager] Details failed for ${sourceId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async getChapterImages(sourceId, url) {
        const scraper = this.scrapers[sourceId.toLowerCase()];
        if (!scraper) throw new Error(`Unknown source: ${sourceId}`);

        try {
            const images = await scraper.getChapterImages(url);
            return { success: true, source: sourceId, images };
        } catch (error) {
            logger.error(`[ScraperManager] Download failed for ${sourceId}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async closeAll() {
        await Promise.all(Object.values(this.scrapers).map(s => s.close()));
    }
}

module.exports = new ScraperManager();
