import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asurascans.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const $ = await this.fetch(url, { interceptApis: true });
        
        if (!$) return [];

        // 1. Try to extract from intercepted JSON data (Network Level)
        if ($.interceptedData && $.interceptedData.length > 0) {
            for (const item of $.interceptedData) {
                // Check if the JSON contains manga/series list
                const data = item.data;
                if (data && (Array.isArray(data) || data.posts || data.items || data.data)) {
                    const list = Array.isArray(data) ? data : (data.posts || data.items || data.data);
                    if (Array.isArray(list) && list.length > 0) {
                        return list.map(m => ({
                            title: m.title || m.name || m.post_title,
                            url: m.url || m.link || m.guid,
                            thumbnail: m.thumbnail || m.image || m.cover,
                            source: 'asura',
                            sourceName: this.sourceName
                        })).filter(m => m.title && m.url);
                    }
                }
            }
        }

        // 2. Fallback to DOM parsing if no JSON API found
        const results = [];
        $('.listupd .bs, .post-item, .utao, .series-card').each((i, el) => {
            const link = $(el).find('a');
            const title = link.attr('title') || $(el).find('.tt').text().trim() || $(el).find('h2').text().trim();
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
        const $ = await this.fetch(url);
        if (!$) return null;

        return {
            title: $('.entry-title').text().trim() || $('h1').text().trim(),
            cover: $('.thumb img').attr('src') || $('.summary_image img').attr('src'),
            description: $('.entry-content').text().trim() || $('.description-summary').text().trim(),
            source: 'asura'
        };
    }

    async getChapters(url) {
        const $ = await this.fetch(url);
        if (!$) return [];

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
        const $ = await this.fetch(url);
        if (!$) return [];

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
