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
            if (sourceId === 'mangaarab') {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`;
            } else {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            }

            const { data } = await axios.get(searchUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            const $ = cheerio.load(data);
            const results = [];

            // هذا الجزء يحتاج لتخصيص بناءً على هيكلية كل موقع
            $('.search-wrap .manga-item, .c-tabs-item__content').each((i, el) => {
                const title = $(el).find('h3 a, .post-title a').text().trim();
                const url = $(el).find('h3 a, .post-title a').attr('href');
                if (title && url) results.push({ title, url });
            });

            return results;
        } catch (error) {
            logger.error(`Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        try {
            const { data } = await axios.get(mangaUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            const $ = cheerio.load(data);

            const title = $('h1').text().trim();
            const coverUrl = $('.summary_image img').attr('src');
            const status = $('.post-status .summary-content').text().trim();
            
            const chapters = [];
            $('.wp-manga-chapter a, .chapters-list a').each((i, el) => {
                const url = $(el).attr('href');
                const name = $(el).text().trim();
                const number = parseFloat(name.match(/\d+(\.\d+)?/)?.[0] || 0);
                if (url) chapters.push({ url, number });
            });

            return { title, coverUrl, status, chapters: chapters.reverse() };
        } catch (error) {
            logger.error(`Failed to get details from ${mangaUrl}: ${error.message}`);
            throw error;
        }
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
