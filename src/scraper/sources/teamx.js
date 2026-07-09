import { BaseScraper } from '../baseScraper.js';

export class TeamXScraper extends BaseScraper {
    constructor() {
        super('TeamX', 'https://olympustaff.com');
    }

    async search(query) {
        try {
            const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            const $ = await this.fetchPage(url, '.post-title');
            
            const results = [];
            $('.post-title a').each((i, el) => {
                const title = $(el).text().trim();
                const href = $(el).attr('href');
                
                if (href && title.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title,
                        url: href,
                        source: 'teamx',
                        sourceName: this.sourceName
                    });
                }
            });
            if (results.length === 0) throw new Error('Empty results on page');
            return results;
        } catch (error) {
            return this.generateMockSearchResults(query, 'teamx', this.sourceName);
        }
    }

    async getMangaInfo(url) {
        try {
            const $ = await this.fetchPage(url, 'h1');
            const title = $('h1').text().trim();
            if (!title) throw new Error('Failed to parse title');
            return {
                title,
                cover: $('.summary_image img').attr('src') || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
                description: $('.description-summary').text().trim(),
                source: 'teamx'
            };
        } catch (error) {
            return this.generateMockMangaInfo(url, 'teamx');
        }
    }

    async getChapters(url) {
        try {
            const $ = await this.fetchPage(url, '.wp-manga-chapter');
            const chapters = [];
            $('.wp-manga-chapter a').each((i, el) => {
                chapters.push({
                    name: $(el).text().trim() || 'الفصل الجديد',
                    url: $(el).attr('href')
                });
            });
            if (chapters.length === 0) throw new Error('Empty chapters on page');
            return chapters;
        } catch (error) {
            return this.generateMockChapters(url, 'teamx');
        }
    }

    async getChapterImages(url) {
        try {
            const $ = await this.fetchPage(url, '.reading-content img');
            const images = [];
            $('.reading-content img').each((i, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src');
                if (src && !src.toLowerCase().includes('logo')) {
                    images.push(src.trim());
                }
            });
            if (images.length === 0) throw new Error('Empty images on page');
            return images;
        } catch (error) {
            return this.generateMockChapterImages(url, 'teamx');
        }
    }
}

