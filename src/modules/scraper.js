import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
    }

    async search(sourceId, query) {
        const source = this.sources.find(s => s.id === sourceId);
        if (!source) throw new Error('Source not found');

        try {
            let searchUrl = '';
            // Specialized search URLs for popular Arabic sites
            switch(sourceId) {
                case 'mangaarab':
                    searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`;
                    break;
                case 'gmanga':
                    searchUrl = `${source.url}/api/mangas/search?query=${encodeURIComponent(query)}`;
                    break;
                default:
                    searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            }

            const { data } = await axios.get(searchUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            
            // Handle JSON response for modern sites like G-Manga
            if (typeof data === 'object' && data.mangas) {
                return data.mangas.map(m => ({ title: m.title, url: `${source.url}/mangas/${m.id}` }));
            }

            const $ = cheerio.load(data);
            const results = [];

            // Universal selector for Madara and MangaStream themes
            $('.search-wrap .manga-item, .c-tabs-item__content, .list-upd .bs, .list-manga .manga-item').each((i, el) => {
                const title = $(el).find('h3 a, .post-title a, .tt a').text().trim();
                const url = $(el).find('h3 a, .post-title a, .tt a').attr('href');
                if (title && url) results.push({ title, url });
            });

            return results;
        } catch (error) {
            logger.error(`Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async parseManga(mangaUrl) {
        try {
            const { data } = await axios.get(mangaUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            const $ = cheerio.load(data);

            const title = $('h1').text().trim();
            const slug = mangaUrl.split('/').filter(Boolean).pop();
            const coverUrl = $('.summary_image img').attr('src');
            const status = $('.post-status .summary-content').text().trim();
            
            const chapters = [];
            $('.wp-manga-chapter a, .chapters-list a').each((i, el) => {
                const url = $(el).attr('href');
                const name = $(el).text().trim();
                const number = parseFloat(name.match(/\d+(\.\d+)?/)?.[0] || 0);
                if (url) chapters.push({ url, number });
            });

            return { title, slug, coverUrl, status, chapters: chapters.reverse(), sourceKey: new URL(mangaUrl).hostname };
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
            const { data } = await axios.get(chapterUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            const $ = cheerio.load(data);
            const images = [];

            $('.reading-content img, #reader-images img').each((i, el) => {
                const src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim();
                if (src) images.push(src);
            });

            return images;
        } catch (error) {
            logger.error(`Failed to parse images from ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
