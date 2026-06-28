import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';

export class ScraperEngine {
    constructor() {
        this.client = axios.create({
            headers: { 'User-Agent': config.scraping.userAgent },
            timeout: config.scraping.timeout
        });
    }

    async fetchHtml(url) {
        try {
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            console.error(`Error fetching URL ${url}:`, error.message);
            return null;
        }
    }

    // Parser لمواقع المانهوا (مثال لموقع Azora أو مشابه)
    async parseManga(url) {
        const html = await this.fetchHtml(url);
        if (!html) return null;

        const $ = cheerio.load(html);
        
        // استخراج البيانات (تختلف حسب الموقع، هنا مثال عام)
        const title = $('.post-title h1').text().trim() || $('meta[property="og:title"]').attr('content');
        const coverUrl = $('.summary_image img').attr('src') || $('meta[property="og:image"]').attr('content');
        const status = $('.post-status .summary-content').text().trim().toLowerCase().includes('مستمر') ? 'ongoing' : 'completed';
        
        const chapters = [];
        $('.wp-manga-chapter').each((i, el) => {
            const chapterLink = $(el).find('a').attr('href');
            const chapterText = $(el).find('a').text().trim();
            const chapterNumber = parseFloat(chapterText.match(/\d+(\.\d+)?/)?.[0] || 0);
            
            if (chapterLink) {
                chapters.push({
                    number: chapterNumber,
                    url: chapterLink
                });
            }
        });

        return {
            title,
            slug: this.generateSlug(title),
            coverUrl,
            status,
            sourceUrl: url,
            chapters: chapters.reverse() // من الأقدم للأحدث
        };
    }

    async parseChapterImages(chapterUrl) {
        const html = await this.fetchHtml(chapterUrl);
        if (!html) return [];

        const $ = cheerio.load(html);
        const images = [];
        
        $('.reading-content img').each((i, el) => {
            const imgUrl = $(el).attr('src') || $(el).attr('data-src');
            if (imgUrl) images.push(imgUrl.trim());
        });

        return images;
    }

    generateSlug(title) {
        return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    }
}
