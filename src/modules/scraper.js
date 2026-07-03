import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ScraperEngine {
    constructor() {
        this.sources = config.sources;
    }

    getSupportedSources() {
        return this.sources;
    }

    async search(sourceId, query) {
        const source = this.sources.find(s => s.id === sourceId);
        if (!source) throw new Error('Source not found');

        try {
            let searchUrl = '';
            // تخصيص روابط البحث بناءً على هيكلية كل موقع
            if (sourceId === 'teamx') {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`;
            } else if (sourceId === 'asura') {
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}`;
            } else {
                // الافتراضي لمواقع Madara مثل سوات وازورا
                searchUrl = `${source.url}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            }

            const { data } = await axios.get(searchUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: config.scraping.timeout
            });
            const $ = cheerio.load(data);
            const results = [];

            // محددات بحث مرنة لتغطية مختلف القوالب
            const selectors = [
                '.c-tabs-item__content', 
                '.search-wrap .manga-item', 
                '.list-listing .page-item-detail',
                '.manga-item',
                '.tab-content-wrap .c-tabs-item__content'
            ];

            $(selectors.join(', ')).each((i, el) => {
                const titleEl = $(el).find('h3 a, .post-title a, .h4 a, .title a');
                const title = titleEl.text().trim();
                const url = titleEl.attr('href');
                if (title && url) {
                    results.push({ title, url });
                }
            });

            // إذا لم نجد نتائج بالمحددات السابقة، نحاول البحث عن أي روابط تحتوي على كلمة المانجا
            if (results.length === 0) {
                $('a').each((i, el) => {
                    const text = $(el).text().toLowerCase();
                    const href = $(el).attr('href');
                    if (href && text.includes(query.toLowerCase()) && (href.includes('/manga/') || href.includes('/series/') || href.includes('/comics/'))) {
                        results.push({ title: $(el).text().trim(), url: href });
                    }
                });
            }

            return results;
        } catch (error) {
            logger.error(`Search failed for ${sourceId}: ${error.message}`);
            return [];
        }
    }

    async getMangaDetails(sourceId, mangaUrl) {
        try {
            const { data } = await axios.get(mangaUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: config.scraping.timeout
            });
            const $ = cheerio.load(data);

            const title = $('h1').text().trim() || $('.post-title h1').text().trim() || $('title').text().split('|')[0].trim();
            const coverUrl = $('.summary_image img').attr('src') || $('.post-thumbnail img').attr('src') || $('.manga-poster img').attr('src');
            const status = $('.post-status .summary-content').text().trim() || $('.status-value').text().trim() || 'Unknown';
            
            const chapters = [];
            // محددات فصول مرنة
            const chapterSelectors = [
                '.wp-manga-chapter a',
                '.chapters-list a',
                '.main.version-chap a',
                '.listing-chapters_wrap a',
                'li.chapter-item a'
            ];

            $(chapterSelectors.join(', ')).each((i, el) => {
                const url = $(el).attr('href');
                const name = $(el).text().trim();
                // استخراج رقم الفصل من النص
                const match = name.match(/\d+(\.\d+)?/);
                const number = match ? parseFloat(match[0]) : (i + 1);
                
                if (url && !chapters.find(c => c.url === url)) {
                    chapters.push({ url, number, name });
                }
            });

            // ترتيب الفصول تصاعدياً
            chapters.sort((a, b) => a.number - b.number);

            return { title, coverUrl, status, chapters };
        } catch (error) {
            logger.error(`Failed to get details from ${mangaUrl}: ${error.message}`);
            throw error;
        }
    }

    async parseChapterImages(sourceId, chapterUrl) {
        try {
            const { data } = await axios.get(chapterUrl, {
                headers: { 'User-Agent': config.scraping.userAgent },
                timeout: config.scraping.timeout
            });
            const $ = cheerio.load(data);
            const images = [];

            // محددات صور مرنة
            const imageSelectors = [
                '.reading-content img',
                '#reader-images img',
                '.wp-manga-chapter-img',
                '.page-break img',
                '.v-comics-chapter-image img'
            ];

            $(imageSelectors.join(', ')).each((i, el) => {
                const src = $(el).attr('src')?.trim() || 
                            $(el).attr('data-src')?.trim() || 
                            $(el).attr('data-lazy-src')?.trim() ||
                            $(el).attr('data-cdn')?.trim();
                
                if (src && !src.includes('logo') && !src.includes('banner')) {
                    // تحويل الروابط النسبية إلى مطلقة إذا لزم الأمر
                    if (src.startsWith('//')) {
                        images.push('https:' + src);
                    } else if (src.startsWith('/')) {
                        const baseUrl = new URL(chapterUrl).origin;
                        images.push(baseUrl + src);
                    } else {
                        images.push(src);
                    }
                }
            });

            return [...new Set(images)]; // إزالة التكرار
        } catch (error) {
            logger.error(`Failed to parse images from ${chapterUrl}: ${error.message}`);
            return [];
        }
    }
}

export default new ScraperEngine();
