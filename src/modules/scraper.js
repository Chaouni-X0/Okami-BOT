import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
    }

    async searchAll(query) {
        const allResults = [];
        const searchPromises = this.sources.map(source => this.search(source.id, query));
        const results = await Promise.all(searchPromises);
        
        results.forEach((res, index) => {
            const source = this.sources[index];
            res.forEach(item => {
                allResults.push({
                    ...item,
                    sourceId: source.id,
                    sourceName: source.name
                });
            });
        });

        return allResults;
    }

    async search(sourceId, query) {
        const source = this.sources.find(s => s.id === sourceId);
        if (!source) return [];

        try {
            let results = [];
            if (source.type === 'wp-manga') {
                results = await this.searchWPManga(source, query);
            } else if (source.type === 'api' && source.id === 'mangadex') {
                results = await this.searchMangaDex(query);
            } else {
                // Fallback or custom logic for others
                results = await this.searchGeneric(source, query);
            }
            return results;
        } catch (error) {
            logger.error(`Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async searchWPManga(source, query) {
        const searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': config.scraping.userAgent },
            timeout: config.scraping.timeout
        });
        const $ = cheerio.load(data);
        const results = [];

        $('.c-tabs-item__content, .search-wrap .manga-item').each((i, el) => {
            const title = $(el).find('h3 a, .post-title a').text().trim();
            const url = $(el).find('h3 a, .post-title a').attr('href');
            if (title && url) results.push({ title, url });
        });

        return results;
    }

    async searchMangaDex(query) {
        const response = await axios.get(`https://api.mangadex.org/manga`, {
            params: { title: query, limit: 5 }
        });
        return response.data.data.map(m => ({
            title: m.attributes.title.en || Object.values(m.attributes.title)[0],
            url: `https://mangadex.org/title/${m.id}`,
            id: m.id
        }));
    }

    async searchGeneric(source, query) {
        // Simple generic search implementation
        const searchUrl = `${source.url}/search?q=${encodeURIComponent(query)}`;
        try {
            const { data } = await axios.get(searchUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: 10000
            });
            const $ = cheerio.load(data);
            const results = [];
            $('a').each((i, el) => {
                const text = $(el).text().toLowerCase();
                if (text.includes(query.toLowerCase())) {
                    results.push({ title: $(el).text().trim(), url: $(el).attr('href') });
                }
            });
            return results.slice(0, 5);
        } catch (e) {
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        const source = this.sources.find(s => s.id === sourceId);
        try {
            const { data } = await axios.get(mangaUrl, {
                headers: { 'User-Agent': config.scraping.userAgent }
            });
            const $ = cheerio.load(data);

            const title = $('h1').text().trim();
            const coverUrl = $('.summary_image img').attr('src') || $('.post-thumbnail img').attr('src');
            const description = $('.summary__content, .manga-excerpt, .description-summary').text().trim();
            
            const chapters = [];
            if (source && source.type === 'wp-manga') {
                $('.wp-manga-chapter a').each((i, el) => {
                    const url = $(el).attr('href');
                    const name = $(el).text().trim();
                    const number = parseFloat(name.match(/\d+(\.\d+)?/)?.[0] || 0);
                    if (url) chapters.push({ url, number, name });
                });
            } else {
                $('a').each((i, el) => {
                    const text = $(el).text();
                    const href = $(el).attr('href');
                    if (href && (text.toLowerCase().includes('chapter') || text.match(/فصل/))) {
                        const number = parseFloat(text.match(/\d+(\.\d+)?/)?.[0] || 0);
                        chapters.push({ url: href, number, name: text.trim() });
                    }
                });
            }

            return { 
                title, 
                coverUrl, 
                description: description || "لا يوجد وصف متاح.", 
                chapters: chapters.sort((a, b) => b.number - a.number) 
            };
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

            $('.reading-content img, #reader-images img, .page-break img').each((i, el) => {
                const src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || $(el).attr('data-lazy-src')?.trim();
                if (src && !src.includes('logo') && !src.includes('banner')) {
                    images.push(src.startsWith('http') ? src : 'https:' + src);
                }
            });

            return [...new Set(images)]; // Remove duplicates
        } catch (error) {
            logger.error(`Failed to parse images from ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
