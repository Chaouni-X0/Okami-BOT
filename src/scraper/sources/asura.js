import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asurascans.com');
    }

    async search(query) {
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
        const result = await this.fetch(url, { interceptApis: true });
        
        if (!result) return [];

        // 1. Handle Smart API Response
        if (result.isApi && result.data) {
            const data = result.data;
            const list = Array.isArray(data) ? data : (data.posts || data.results || data.items || data.data);
            if (Array.isArray(list)) {
                return list.map(m => ({
                    title: m.title || m.name || m.post_title,
                    url: m.url || m.link || m.guid,
                    thumbnail: m.thumbnail || m.image || m.cover || m.featured_image,
                    source: 'asura',
                    sourceName: this.sourceName
                })).filter(m => m.title && m.url);
            }
        }

        // 2. Fallback to DOM Parsing (Cheerio)
        const $ = result;
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

        // 3. Final Fallback: Link Extraction (Self-Healing)
        if (results.length === 0 && $) {
            $('a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if ((href.includes('manga') || href.includes('series')) && text.length > 2) {
                    results.push({
                        title: text,
                        url: href,
                        thumbnail: null,
                        source: 'asura',
                        sourceName: this.sourceName
                    });
                }
            });
        }

        return results;
    }

    async getMangaInfo(url) {
        const result = await this.fetch(url);
        if (!result) return null;
        
        const $ = result.isApi ? null : result;
        if (!$) return null; // Info usually requires DOM or specialized API

        return {
            title: $('.entry-title').text().trim() || $('h1').text().trim(),
            cover: $('.thumb img').attr('src') || $('.summary_image img').attr('src'),
            description: $('.entry-content').text().trim() || $('.description-summary').text().trim(),
            source: 'asura'
        };
    }

    async getChapters(url) {
        const result = await this.fetch(url);
        if (!result) return [];
        
        const $ = result.isApi ? null : result;
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
        const result = await this.fetch(url);
        if (!result) return [];
        
        const $ = result.isApi ? null : result;
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
