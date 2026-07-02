import logger from '../utils/logger.js';
import { PythonBridge } from '../utils/pythonBridge.js';

export class ScraperEngine {
    async searchAll(query) {
        try {
            logger.info(`[Scraper] Searching all sources for: ${query} using Python Engine`);
            const data = await PythonBridge.search(query);
            
            if (data.status === 'error') {
                throw new Error(data.message);
            }

            return (data.results || []).map(r => ({
                ...r,
                sourceId: r.source,
                sourceName: r.source
            }));
        } catch (error) {
            logger.error(`[Scraper] SearchAll failed: ${error.message}`);
            return [];
        }
    }

    async search(sourceId, query) {
        try {
            logger.info(`[Scraper] Searching ${sourceId} for: ${query}`);
            const data = await PythonBridge.search(query);

            if (data.status === 'error') {
                throw new Error(data.message);
            }

            // Case-insensitive filtering to match config ID (e.g. 'mangaswat') with Python source name (e.g. 'MangaSwat')
            return (data.results || []).filter(r => r.source.toLowerCase() === sourceId.toLowerCase()).map(r => ({
                ...r,
                sourceId: r.source,
                sourceName: r.source
            }));
        } catch (error) {
            logger.error(`[Scraper] Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        try {
            logger.info(`[Scraper] Getting details from: ${mangaUrl}`);
            const data = await PythonBridge.getDetails(sourceId, mangaUrl);

            if (data.status === 'error') {
                throw new Error(data.message);
            }

            return {
                title: data.info.title,
                coverUrl: data.info.cover,
                description: data.info.description,
                chapters: (data.chapters || []).map(ch => ({
                    ...ch,
                    number: parseFloat(ch.name.match(/(\d+(\.\d+)?)/)?.[1] || 0)
                }))
            };
        } catch (error) {
            logger.error(`[Scraper] Details failed for ${mangaUrl}: ${error.message}`);
            throw error;
        }
    }

    async parseChapterImages(sourceId, chapterUrl, mangaTitle, chapterName) {
        try {
            logger.info(`[Scraper] Downloading images via Python for: ${chapterUrl}`);
            const data = await PythonBridge.downloadChapter(sourceId, mangaTitle, chapterName, chapterUrl);

            if (data.status === 'error') {
                throw new Error(data.message);
            }

            return data.images || [];
        } catch (error) {
            logger.error(`[Scraper] Image download failed for ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
