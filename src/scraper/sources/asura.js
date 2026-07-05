import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asurascans.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const $ = await this.fetchPage(url);
        
        if (!$) return [];

        const results = [];
        const sel = this.lastActiveSelector || '.listupd';
        
        $(sel).find('.bs, .post-item, .utao').each((i, el) => {
            const link = $(el).find('a');
            const title = link.attr('title') || $(el).find('.tt').text().trim();
            const href = link.attr('href');
            
            if (href) {
                results.push({
                    title,
                    url: href,
                    thumbnail: $(el).find('img').attr('src') || $(el).find('img').attr('data-src'),
                    source: 'asura',
                    sourceName: this.sourceName
                });
            }
        });
        return results;
    }

    async getMangaInfo(url) {
        const $ = await this.fetchPage(url);
        if (!$) return null;

        return {
            title: $('.entry-title').text().trim() || $('h1').text().trim(),
            cover: $('.thumb img').attr('src') || $('.summary_image img').attr('src'),
            description: $('.entry-content').text().trim() || $('.description-summary').text().trim(),
            source: 'asura'
        };
    }

    async getChapters(url) {
        const $ = await this.fetchPage(url);
        if (!$) return [];

        const chapters = [];
        $('#chapterlist li, .wp-manga-chapter').each((i, el) => {
            const link = $(el).find('a');
            chapters.push({
                name: $(el).find('.chapternum').text().trim() || link.text().trim(),
                url: link.attr('href')
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const $ = await this.fetchPage(url);
        if (!$) return [];

        const images = [];
        $('#readerarea img, .reading-content img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('loader') && !src.includes('logo')) {
                images.push(src.trim());
            }
        });
        return images;
    }
}
