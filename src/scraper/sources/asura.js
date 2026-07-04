import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asurascans.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
        const $ = await this.fetchPage(url, '.c-tabs-item__content, .post-title');
        
        const results = [];
        $('.c-tabs-item__content, .post-title a').each((i, el) => {
            const link = $(el).is('a') ? $(el) : $(el).find('a');
            const title = link.text().trim();
            const href = link.attr('href');
            
            if (href && title.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    title,
                    url: href,
                    source: 'asura',
                    sourceName: this.sourceName
                });
            }
        });
        return results;
    }

    async getMangaInfo(url) {
        const $ = await this.fetchPage(url, 'h1');
        return {
            title: $('h1').text().trim(),
            cover: $('.summary_image img').attr('src'),
            description: $('.description-summary').text().trim(),
            source: 'asura'
        };
    }

    async getChapters(url) {
        const $ = await this.fetchPage(url, '.wp-manga-chapter');
        const chapters = [];
        $('.wp-manga-chapter a').each((i, el) => {
            chapters.push({
                name: $(el).text().trim(),
                url: $(el).attr('href')
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const $ = await this.fetchPage(url, '.reading-content img');
        const images = [];
        $('.reading-content img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.toLowerCase().includes('logo')) {
                images.push(src.trim());
            }
        });
        return images;
    }
}
