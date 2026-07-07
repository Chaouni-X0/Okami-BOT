import { BaseScraper } from '../baseScraper.js';

export class AzoraScraper extends BaseScraper {
    constructor() {
        super('Azora', 'https://azorafly.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const result = await this.fetch(url, { interceptApis: true });
        
        if (!result || !result.data) return [];

        // 1. Process API JSON Data
        if (result.type === 'api') {
            const data = result.data;
            const list = Array.isArray(data) ? data : (data.results || data.posts || data.items || (data.data && (data.data.results || data.data.items || data.data)));
            
            if (Array.isArray(list)) {
                return list.map(m => {
                    if (!m) return null;
                    return {
                        title: m.title || m.name || m.post_title || 'Unknown',
                        url: m.url || m.link || m.guid || (m.slug ? `${this.baseUrl}/manga/${m.slug}` : null),
                        thumbnail: m.thumbnail || m.image || m.cover || m.featured_image || (m.img ? m.img : null),
                        source: 'azora',
                        sourceName: this.sourceName
                    };
                }).filter(m => m && m.url);
            }
        }

        // 2. Process DOM HTML Data (Cheerio)
        if (result.type === 'dom') {
            const $ = result.data;
            const results = [];
            $('.listupd .bs, .post-item, .utao, .series-card, .c-tabs-item__content').each((i, el) => {
                const link = $(el).find('a');
                const title = link.attr('title') || $(el).find('.tt').text().trim() || $(el).find('h2, h3').text().trim();
                const href = link.attr('href');
                
                if (href) {
                    results.push({
                        title,
                        url: href,
                        thumbnail: $(el).find('img').attr('src') || $(el).find('img').attr('data-src'),
                        source: 'azora',
                        sourceName: this.sourceName
                    });
                }
            });
            return results;
        }

        return [];
    }

    async getMangaInfo(url) {
        const result = await this.fetch(url);
        if (!result || result.type !== 'dom') return null;
        const $ = result.data;

        return {
            title: $('.entry-title').text().trim() || $('h1').text().trim(),
            cover: $('.thumb img').attr('src') || $('.summary_image img').attr('src'),
            description: $('.entry-content').text().trim() || $('.description-summary').text().trim(),
            source: 'azora'
        };
    }

    async getChapters(url) {
        const result = await this.fetch(url);
        if (!result || result.type !== 'dom') return [];
        const $ = result.data;

        const chapters = [];
        $('#chapterlist li, .wp-manga-chapter, .eplister li').each((i, el) => {
            const link = $(el).find('a');
            chapters.push({
                name: $(el).find('.chapternum').text().trim() || link.text().trim(),
                url: link.attr('href')
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const result = await this.fetch(url);
        if (!result || result.type !== 'dom') return [];
        const $ = result.data;

        const images = [];
        $('#readerarea img, .reading-content img, .entry-content img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && !src.includes('loader') && !src.includes('logo')) {
                images.push(src.trim());
            }
        });
        return images;
    }
}
