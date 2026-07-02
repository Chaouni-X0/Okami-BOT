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
            if (res && res.length > 0) {
                res.forEach(item => {
                    allResults.push({
                        ...item,
                        sourceId: source.id,
                        sourceName: source.name
                    });
                });
            }
        });

        return allResults;
    }

    async search(sourceId, query) {
        const source = this.sources.find(s => s.id === sourceId);
        if (!source) return [];

        try {
            logger.info(`[Scraper] Searching ${source.name} for: ${query}`);
            let searchUrl = "";
            let results = [];

            if (source.id === 'gmanga') {
                return await this.searchGManga(query);
            }

            if (source.type === 'wp-manga') {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            } else {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`;
            }

            const { data } = await axios.get(searchUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: 15000
            });
            const $ = cheerio.load(data);

            // Selectors based on common themes (Madara, MangaStream, etc.)
            $('.c-tabs-item__content, .search-wrap .manga-item, .listupd .bs, .page-item-detail').each((i, el) => {
                const title = $(el).find('h3 a, .post-title a, .tt a').text().trim();
                const url = $(el).find('h3 a, .post-title a, .tt a').attr('href');
                if (title && url) results.push({ title, url });
            });

            // Fallback for simpler sites
            if (results.length === 0) {
                $('a').each((i, el) => {
                    const text = $(el).text().toLowerCase();
                    if (text.includes(query.toLowerCase()) && $(el).attr('href')?.includes('/manga/')) {
                        results.push({ title: $(el).text().trim(), url: $(el).attr('href') });
                    }
                });
            }

            return results.slice(0, 5);
        } catch (error) {
            logger.error(`[Scraper] Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async searchGManga(query) {
        try {
            const response = await axios.get(`https://gmanga.me/api/mangas/search`, {
                params: { title: query },
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            return response.data.mangas.map(m => ({
                title: m.title,
                url: `https://gmanga.me/mangas/${m.id}/${m.slug}`,
                id: m.id
            }));
        } catch (e) {
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        try {
            logger.info(`[Scraper] Getting details from: ${mangaUrl}`);
            const { data } = await axios.get(mangaUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: 15000
            });
            const $ = cheerio.load(data);

            const title = $('h1').text().trim() || $('.post-title h1').text().trim() || $('.entry-title').text().trim();
            const coverUrl = $('.summary_image img').attr('src') || $('.post-thumbnail img').attr('src') || $('.thumb img').attr('src');
            const description = $('.summary__content, .manga-excerpt, .description-summary, .entry-content').text().trim();
            
            const chapters = [];
            // Common Selectors for Chapter Lists
            $('.wp-manga-chapter a, .eph-num a, .chp-release-list a, .clist a').each((i, el) => {
                const url = $(el).attr('href');
                const name = $(el).text().trim();
                const numberMatch = name.match(/(\d+(\.\d+)?)/);
                const number = numberMatch ? parseFloat(numberMatch[1]) : 0;
                if (url) chapters.push({ url, number, name });
            });

            // If no chapters found, try generic link search
            if (chapters.length === 0) {
                $('a').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().toLowerCase();
                    if (href && (href.includes('chapter') || href.includes('فصل')) && !href.includes('search')) {
                        const numberMatch = text.match(/(\d+(\.\d+)?)/);
                        const number = numberMatch ? parseFloat(numberMatch[1]) : 0;
                        chapters.push({ url: href, number, name: $(el).text().trim() });
                    }
                });
            }

            return { 
                title: title || "بدون عنوان", 
                coverUrl: coverUrl || "", 
                description: description || "لا يوجد وصف متاح.", 
                chapters: chapters.sort((a, b) => b.number - a.number) 
            };
        } catch (error) {
            logger.error(`[Scraper] Details failed for ${mangaUrl}: ${error.message}`);
            throw error;
        }
    }

    async parseChapterImages(sourceId, chapterUrl) {
        try {
            logger.info(`[Scraper] Parsing images from: ${chapterUrl}`);
            const { data } = await axios.get(chapterUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: 20000
            });
            const $ = cheerio.load(data);
            const images = [];

            // Targeted selectors for major Arabic and English sites
            $('.reading-content img, #reader-images img, .page-break img, .vung-doc img, #chapter_imgs img, .rdminimal img').each((i, el) => {
                const src = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || $(el).attr('data-lazy-src')?.trim();
                if (src && !src.includes('logo') && !src.includes('banner') && !src.includes('loader')) {
                    let finalUrl = src.startsWith('http') ? src : 'https:' + src;
                    // Fix for some sites that use relative protocol
                    if (finalUrl.startsWith('https:https:')) finalUrl = finalUrl.replace('https:https:', 'https:');
                    images.push(finalUrl);
                }
            });

            // Remove duplicates and filter empty
            const uniqueImages = [...new Set(images.filter(img => img.length > 0))];
            logger.info(`[Scraper] Found ${uniqueImages.length} images.`);
            return uniqueImages;
        } catch (error) {
            logger.error(`[Scraper] Image parsing failed for ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
