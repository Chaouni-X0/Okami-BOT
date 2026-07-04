import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import scraperManager from '../scraper/scraperManager.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
    }

    getSupportedSources() {
        return this.sources;
    }

    /**
     * Search across all sources using Node.js Playwright Engine
     */
    async searchAll(query) {
        logger.info(`[Scraper] Searching all sources for: ${query} using Node.js Engine`);
        try {
            const result = await scraperManager.search(query);
            if (result.success) {
                return result.results.map(res => ({
                    title: res.title,
                    url: res.url,
                    sourceId: res.source,
                    sourceName: res.sourceName
                }));
            }
            throw new Error(result.error || 'Search failed');
        } catch (error) {
            logger.error(`[Scraper] Node.js searchAll failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Search a specific source
     */
    async search(sourceId, query) {
        logger.info(`[Scraper] Searching ${sourceId} for: ${query}`);
        const allResults = await this.searchAll(query);
        return allResults.filter(r => r.sourceId === sourceId);
    }

    async getMangaDetails(sourceId, mangaUrl) {
        logger.info(`[Scraper] Getting details for ${mangaUrl} using Node.js Engine`);
        try {
            const result = await scraperManager.getDetails(sourceId, mangaUrl);
            if (result.success) {
                return {
                    title: result.info.title,
                    coverUrl: result.info.cover,
                    description: result.info.description,
                    status: 'Unknown',
                    chapters: result.chapters.map((ch, i) => ({
                        url: ch.url,
                        name: ch.name,
                        number: i + 1
                    }))
                };
            }
            throw new Error(result.error || 'Failed to get details');
        } catch (error) {
            logger.error(`[Scraper] Node.js getMangaDetails failed: ${error.message}`);
            throw error;
        }
    }

    async parseChapterImages(sourceId, chapterUrl) {
        logger.info(`[Scraper] Parsing images for ${chapterUrl} using Node.js Engine`);
        try {
            const result = await scraperManager.getChapterImages(sourceId, chapterUrl);
            if (result.success) {
                return result.images;
            }
            throw new Error(result.error || 'Failed to parse images');
        } catch (error) {
            logger.error(`[Scraper] Node.js parseChapterImages failed: ${error.message}`);
            return [];
        }
    }
}

const scraperEngineInstance = new ScraperEngine();
export default scraperEngineInstance;
