import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asurascans.com');
    }

    async search(query) {
        // Try both search patterns
        const searchUrls = [
            `${this.baseUrl}/?s=${encodeURIComponent(query)}`,
            `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
        ];

        for (const url of searchUrls) {
            const $ = await this.fetch(url);
            if (!$) continue;

            // Check if Self-Healing data is available
            if ($.isSelfHealing && $.smartData) {
                return $.smartData.map(item => ({
                    ...item,
                    source: 'asura',
                    sourceName: this.sourceName
                }));
            }

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

            if (results.length > 0) return results;
        }
        return [];
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
