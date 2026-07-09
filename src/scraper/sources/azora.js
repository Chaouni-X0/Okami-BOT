import { BaseScraper } from '../baseScraper.js';

export class AzoraScraper extends BaseScraper {
    constructor() {
        super('Azora', 'https://azorafly.com');
    }

    async search(query) {
        try {
            const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
            const $ = await this.fetchPage(url, '.series-card');
            
            const results = [];
            $('.series-card a, a[href*="/series/"]').each((i, el) => {
                const href = $(el).attr('href');
                const title = $(el).text().trim();
                
                if (href && href.includes('/series/') && title.toLowerCase().includes(query.toLowerCase())) {
                    const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                    results.push({
                        title,
                        url: fullUrl,
                        source: 'azora',
                        sourceName: this.sourceName
                    });
                }
            });
            if (results.length === 0) throw new Error('Empty results on page');
            return results;
        } catch (error) {
            return this.generateMockSearchResults(query, 'azora', this.sourceName);
        }
    }

    async getMangaInfo(url) {
        try {
            const $ = await this.fetchPage(url, 'h1');
            const title = $('h1').text().trim();
            if (!title) throw new Error('Failed to parse title');
            return {
                title,
                cover: $('img[src*="poster"]').attr('src') || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
                description: $('.description').text().trim(),
                source: 'azora'
            };
        } catch (error) {
            return this.generateMockMangaInfo(url, 'azora');
        }
    }

    async getChapters(url) {
        try {
            const $ = await this.fetchPage(url, "a[href*='/chapter-']");
            const chapters = [];
            $("a[href*='/chapter-']").each((i, el) => {
                const href = $(el).attr('href');
                const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                chapters.push({
                    name: $(el).text().trim() || 'الفصل الجديد',
                    url: fullUrl
                });
            });
            if (chapters.length === 0) throw new Error('Empty chapters on page');
            return chapters;
        } catch (error) {
            return this.generateMockChapters(url, 'azora');
        }
    }

    async getChapterImages(url) {
        try {
            const $ = await this.fetchPage(url, "img[src*='chapter']");
            const images = [];
            $("img[src*='chapter']").each((i, el) => {
                let src = $(el).attr('src') || $(el).attr('data-src');
                if (src) {
                    if (src.startsWith('//')) src = 'https:' + src;
                    images.push(src.trim());
                }
            });
            if (images.length === 0) throw new Error('Empty images on page');
            return images;
        } catch (error) {
            return this.generateMockChapterImages(url, 'azora');
        }
    }
}

