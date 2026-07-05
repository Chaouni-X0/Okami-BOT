import { BaseScraper } from '../baseScraper.js';

export class TeamXScraper extends BaseScraper {
    constructor() {
        super('TeamX', 'https://olympustaff.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const result = await this.fetch(url, { interceptApis: true });
        
        if (!result) return [];

        // 1. Smart API Handle
        if (result.isApi && result.data) {
            const data = result.data;
            const list = Array.isArray(data) ? data : (data.posts || data.results || data.items || data.data);
            if (Array.isArray(list)) {
                return list.map(m => ({
                    title: m.title || m.name || m.post_title,
                    url: m.url || m.link || m.guid,
                    thumbnail: m.thumbnail || m.image || m.cover || m.featured_image,
                    source: 'teamx',
                    sourceName: this.sourceName
                })).filter(m => m.title && m.url);
            }
        }

        // 2. DOM Fallback
        const $ = result;
        const results = [];
        $('.listupd .bs, .post-item, .utao').each((i, el) => {
            const link = $(el).find('a');
            const title = link.attr('title') || $(el).find('.tt').text().trim();
            const href = link.attr('href');
            
            if (href) {
                results.push({
                    title,
                    url: href,
                    thumbnail: $(el).find('img').attr('src') || $(el).find('img').attr('data-src'),
                    source: 'teamx',
                    sourceName: this.sourceName
                });
            }
        });

        // 3. Link Extraction Fallback
        if (results.length === 0 && $) {
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if ((href.includes('manga') || href.includes('series')) && text.length > 2) {
                    results.push({
                        title: text,
                        url: href,
                        thumbnail: null,
                        source: 'teamx',
                        sourceName: this.sourceName
                    });
                }
            });
        }

        return results;
    }

    async getMangaInfo(url) {
        const result = await this.fetch(url);
        if (!result || result.isApi) return null;
        const $ = result;

        return {
            title: $('.entry-title').text().trim() || $('h1').text().trim(),
            cover: $('.thumb img').attr('src') || $('.summary_image img').attr('src'),
            description: $('.entry-content').text().trim() || $('.description-summary').text().trim(),
            source: 'teamx'
        };
    }

    async getChapters(url) {
        const result = await this.fetch(url);
        if (!result || result.isApi) return [];
        const $ = result;

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
        if (!result || result.isApi) return [];
        const $ = result;

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
