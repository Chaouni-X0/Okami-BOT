import logger from '../utils/logger.js';
import { PythonBridge } from '../utils/pythonBridge.js';

export class ScraperEngine {
    async searchAll(query) {
        try {
            logger.info(`[Scraper] Searching all sources for: ${query} using Python Engine`);
            const results = await PythonBridge.search(query);
            return results.map(r => ({
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
            const results = await PythonBridge.search(query);
            return results.filter(r => r.source === sourceId);
        } catch (error) {
            logger.error(`[Scraper] Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        try {
            logger.info(`[Scraper] Getting details from: ${mangaUrl}`);
            const data = await PythonBridge.getDetails(sourceId, mangaUrl);
            return {
                title: data.info.title,
                coverUrl: data.info.cover,
                description: data.info.description,
                chapters: data.chapters.map(ch => ({
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
            return data.images || [];
        } catch (error) {
            logger.error(`[Scraper] Image download failed for ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
