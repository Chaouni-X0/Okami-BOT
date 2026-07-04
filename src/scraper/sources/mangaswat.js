const BaseScraper = require('../baseScraper');

class MangaSwatScraper extends BaseScraper {
    constructor() {
        super('MangaSwat', 'https://meshmanga.com');
    }

    async search(query) {
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
                    source: 'mangaswat',
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
            cover: $('img[src*="poster"]').attr('src'),
            description: $('.description').text().trim(),
            source: 'mangaswat'
        };
    }

    async getChapters(url) {
        const $ = await this.fetchPage(url, "a[href*='/chapter-']");
        const chapters = [];
        $("a[href*='/chapter-']").each((i, el) => {
            const href = $(el).attr('href');
            const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
            chapters.push({
                name: $(el).text().trim(),
                url: fullUrl
            });
        });
        return chapters;
    }

    async getChapterImages(url) {
        const $ = await this.fetchPage(url, "img[src*='chapter']");
        const images = [];
        $("img[src*='chapter']").each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                images.push(src.trim());
            }
        });
        return images;
    }
}

module.exports = MangaSwatScraper;
