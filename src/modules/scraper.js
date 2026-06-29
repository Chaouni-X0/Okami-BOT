import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
        this.userAgent = config.scraping.userAgent;
    }

    async fetchWithRetry(url, options = {}, retries = 3) {
        try {
            return await axios({
                url,
                timeout: 20000,
                headers: { 'User-Agent': this.userAgent },
                ...options
            });
        } catch (error) {
            if (retries > 0 && (error.code === 'ECONNABORTED' || error.response?.status >= 500)) {
                logger.warn(`Retrying fetch for ${url}. Left: ${retries}`);
                await new Promise(r => setTimeout(r, 2000));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    async searchAll(query) {
        logger.info(`Global search triggered for: ${query}`);
        const allResults = [];
        
        const searchPromises = this.sources.map(async (source) => {
            try {
                const results = await this.search(source.id, query);
                return results.map(r => ({ ...r, sourceName: source.name, sourceId: source.id }));
            } catch (error) {
                logger.warn(`Search failed for ${source.name}: ${error.message}`);
                return [];
            }
        });

        const resultsArray = await Promise.all(searchPromises);
        return resultsArray.flat();
    }

    async search(sourceId, query) {
        const source = this.sources.find(s => s.id === sourceId);
        if (!source) throw new Error('Source not found');

        let searchUrl = '';
        switch(sourceId) {
            case 'mangaarab': searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`; break;
            case 'gmanga': searchUrl = `${source.url}/api/mangas/search?query=${encodeURIComponent(query)}`; break;
            default: searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
        }

        const { data } = await this.fetchWithRetry(searchUrl);
        
        if (typeof data === 'object' && data.mangas) {
            return data.mangas.map(m => ({ title: m.title, url: `${source.url}/mangas/${m.id}` }));
        }

        const $ = cheerio.load(data);
        const results = [];
        $('.search-wrap .manga-item, .c-tabs-item__content, .list-upd .bs, .list-manga .manga-item').each((i, el) => {
            const title = $(el).find('h3 a, .post-title a, .tt a').text().trim();
            const url = $(el).find('h3 a, .post-title a, .tt a').attr('href');
            if (title && url) results.push({ title, url });
        });

        return results;
    }

    async parseManga(mangaUrl) {
        try {
            const { data } = await this.fetchWithRetry(mangaUrl);
            const $ = cheerio.load(data);

            const title = $('h1').text().trim() || $('.post-title h1').text().trim();
            const slug = mangaUrl.split('/').filter(Boolean).pop();
            const coverUrl = $('.summary_image img').attr('src') || $('.thumb img').attr('src');
            const status = $('.post-status .summary-content').text().trim();
            
            const chapters = [];
            $('.wp-manga-chapter a, .chapters-list a, .list-chapters a').each((i, el) => {
                const url = $(el).attr('href');
                const name = $(el).text().trim();
                const number = parseFloat(name.match(/\d+(\.\d+)?/)?.[0] || 0);
                if (url) chapters.push({ url, number });
            });

            if (chapters.length === 0) {
                logger.warn(`No chapters found for manga at ${mangaUrl}`);
            }

            return { 
                title, 
                slug, 
                coverUrl, 
                status, 
                chapters: chapters.reverse(), 
                sourceKey: new URL(mangaUrl).hostname 
            };
        } catch (error) {
            logger.error(`Failed to parse manga from ${mangaUrl}: ${error.message}`);
            throw error;
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        return this.parseManga(mangaUrl);
    }

    async parseChapterImages(sourceId, chapterUrl) {
        try {
            const { data } = await this.fetchWithRetry(chapterUrl);
            const $ = cheerio.load(data);
            const images = [];

            $('.reading-content img, #reader-images img, .vung-doc img').each((i, el) => {
                const src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || $(el).attr('data-lazy-src')?.trim();
                if (src && !src.includes('logo')) images.push(src);
            });

            return images;
        } catch (error) {
            logger.error(`Failed to parse images from ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
