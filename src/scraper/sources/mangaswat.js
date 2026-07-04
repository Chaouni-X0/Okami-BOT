import { BaseScraper } from '../baseScraper.js';

export class MangaSwatScraper extends BaseScraper {
    constructor() {
        super('MangaSwat', 'https://meshmanga.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        // MangaSwat often has Cloudflare, use browser for search if axios fails
        const $ = await this.fetch(url, { waitSelector: '.listupd' });
        
        const results = [];
        $('.listupd .bs').each((i, el) => {
            const link = $(el).find('a');
            const title = link.attr('title') || $(el).find('.tt').text().trim();
            const href = link.attr('href');
            
            if (href) {
                results.push({
                    title,
                    url: href,
                    thumbnail: $(el).find('img').attr('src'),
                    source: 'mangaswat',
                    sourceName: this.sourceName
                });
            }
        });
        return results;
    }

    async getMangaInfo(url) {
        const $ = await this.fetch(url, { waitSelector: '.entry-title' });
        return {
            title: $('.entry-title').text().trim(),
            cover: $('.thumb img').attr('src'),
            description: $('.entry-content').text().trim(),
            status: $('.infotable tr:contains("Status") td:last-child').text().trim(),
            source: 'mangaswat'
        };
    }

    async getChapters(url) {
        const $ = await this.fetch(url, { waitSelector: '#chapterlist' });
        const chapters = [];
        $('#chapterlist li').each((i, el) => {
            const link = $(el).find('a');
            chapters.push({
                name: $(el).find('.chapternum').text().trim(),
                url: link.attr('href'),
                date: $(el).find('.chapterdate').text().trim()
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const $ = await this.fetch(url, { waitSelector: '#readerarea' });
        const images = [];
        $('#readerarea img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('loader')) {
                images.push(src.trim());
            }
        });
        return images;
    }
}
