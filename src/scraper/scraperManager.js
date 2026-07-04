import logger from '../utils/logger.js';
import cacheService from '../services/cacheService.js';
import pLimit from 'p-limit';
import { AsuraScraper } from './sources/asura.js';
import { MangaSwatScraper } from './sources/mangaswat.js';
import { TeamXScraper } from './sources/teamx.js';
import { AzoraScraper } from './sources/azora.js';

class ScraperManager {
    constructor() {
        this.scrapers = {
            asura: new AsuraScraper(),
            mangaswat: new MangaSwatScraper(),
            teamx: new TeamXScraper(),
            azora: new AzoraScraper()
        };
        // Limit parallel scrapers to 2 to avoid Railway SIGTERM (Memory/CPU spikes)
        this.limit = pLimit(2);
    }

    async search(query) {
        const cacheKey = `search:${query.toLowerCase().trim()}`;
        const cachedResults = await cacheService.get(cacheKey);
        
        if (cachedResults) {
            logger.info(`[ScraperManager] Cache hit for: ${query}`);
            return cachedResults;
        }

        logger.info(`[ScraperManager] Cache miss. Searching for: ${query}`);
        
        const promises = Object.values(this.scrapers).map((scraper) => 
            this.limit(async () => {
                try {
                    const results = await scraper.search(query);
                    return { success: true, source: scraper.sourceName, results };
                } catch (error) {
                    logger.error(`[ScraperManager] Search failed for ${scraper.sourceName}: ${error.message}`);
                    return { success: false, source: scraper.sourceName, error: error.message, results: [] };
                }
            })
        );

        const responses = await Promise.all(promises);
        const allResults = responses.flatMap(r => r.results);
        
        const finalResult = {
            success: true,
            total: allResults.length,
            results: allResults,
            details: responses.map(r => ({ source: r.source, count: r.results.length, success: r.success })),
            timestamp: new Date().toISOString()
        };

        if (allResults.length > 0) {
            await cacheService.set(cacheKey, finalResult, 'multi-source');
        }

        return finalResult;
    }

    async getDetails(sourceId, url) {
        const cacheKey = `details:${url}`;
        const cachedDetails = await cacheService.get(cacheKey);

        if (cachedDetails) {
            logger.info(`[ScraperManager] Cache hit for details: ${url}`);
            return cachedDetails;
        }

        const scraper = this.scrapers[sourceId.toLowerCase()];
        if (!scraper) throw new Error(`Unknown source: ${sourceId}`);

        try {
            const info = await scraper.getMangaInfo(url);
            const chapters = await scraper.getChapters(url);
            const result = { success: true, source: sourceId, info, chapters };
            
            await cacheService.set(cacheKey, result, sourceId);
            return result;
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

export const scraperManager = new ScraperManager();
