import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import pythonBridge from '../utils/pythonBridge.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
    }

    getSupportedSources() {
        return this.sources;
    }

    /**
     * Search across all sources using Python Engine for better scraping (Cloudflare bypass)
     */
    async searchAll(query) {
        logger.info(`[Scraper] Searching all sources for: ${query} using Python Engine`);
        try {
            const result = await pythonBridge.search(query);
            if (result.status === 'success') {
                // Map results to the format expected by the frontend
                return result.results.map(res => ({
                    title: res.title,
                    url: res.url,
                    sourceId: this._getSourceIdByName(res.source),
                    sourceName: res.source
                }));
            }
            throw new Error(result.message || 'Search failed');
        } catch (error) {
            logger.error(`[Scraper] Python searchAll failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Search a specific source
     */
    async search(sourceId, query) {
        logger.info(`[Scraper] Searching ${sourceId} for: ${query}`);
        // If it's a specific search, we can still use the python engine but filter results
        const allResults = await this.searchAll(query);
        return allResults.filter(r => r.sourceId === sourceId);
    }

    async getMangaDetails(sourceId, mangaUrl) {
        logger.info(`[Scraper] Getting details for ${mangaUrl} using Python Engine`);
        try {
            const source = this.sources.find(s => s.id === sourceId);
            const sourceName = source ? source.name : sourceId;
            
            const result = await pythonBridge.getDetails(sourceName, mangaUrl);
            if (result.status === 'success') {
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
            throw new Error(result.message || 'Failed to get details');
        } catch (error) {
            logger.error(`[Scraper] Python getMangaDetails failed: ${error.message}`);
            throw error;
        }
    }

    async parseChapterImages(sourceId, chapterUrl) {
        logger.info(`[Scraper] Parsing images for ${chapterUrl} using Python Engine`);
        try {
            const source = this.sources.find(s => s.id === sourceId);
            const sourceName = source ? source.name : sourceId;
            
            const result = await pythonBridge.call('download', { 
                source: sourceName, 
                url: chapterUrl 
            });
            
            if (result.status === 'success') {
                return result.images;
            }
            throw new Error(result.message || 'Failed to parse images');
        } catch (error) {
            logger.error(`[Scraper] Python parseChapterImages failed: ${error.message}`);
            return [];
        }
    }

    _getSourceIdByName(name) {
        const source = this.sources.find(s => s.name.toLowerCase() === name.toLowerCase());
        return source ? source.id : name.toLowerCase();
    }
}

// Create the instance
const scraperEngineInstance = new ScraperEngine();

// Export both the class and the default instance
// This ensures that ChatService can use it correctly regardless of how it's imported
export default scraperEngineInstance;
