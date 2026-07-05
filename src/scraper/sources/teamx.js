import { BaseScraper } from '../baseScraper.js';

export class TeamXScraper extends BaseScraper {
    constructor() {
        super('TeamX', 'https://olympustaff.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        // TeamX often needs browser due to protection
        const $ = await this.fetch(url, { waitSelector: '.listupd', useBrowser: true });
        
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
                    source: 'teamx',
                    sourceName: this.sourceName
                });
            }
        });
        return results;
    }

    async getMangaInfo(url) {
        const $ = await this.fetch(url, { waitSelector: '.entry-title', useBrowser: true });
        return {
            title: $('.entry-title').text().trim(),
            cover: $('.thumb img').attr('src'),
            description: $('.entry-content').text().trim(),
            source: 'teamx'
        };
    }

    async getChapters(url) {
        const $ = await this.fetch(url, { waitSelector: '#chapterlist', useBrowser: true });
        const chapters = [];
        $('#chapterlist li').each((i, el) => {
            const link = $(el).find('a');
            chapters.push({
                name: $(el).find('.chapternum').text().trim(),
                url: link.attr('href')
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const $ = await this.fetch(url, { waitSelector: '#readerarea', useBrowser: true });
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
