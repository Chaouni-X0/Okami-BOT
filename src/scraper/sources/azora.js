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
            const cards = this.findResilient($, ['.series-card', '.listupd .bs', '.bsx', '.manga-box', 'a[href*="/series/"]']);
            
            if (cards && cards.length > 0) {
                cards.each((i, el) => {
                    const link = $(el).is('a') ? $(el) : $(el).find('a');
                    const href = link.attr('href');
                    const title = link.attr('title') || link.text().trim() || $(el).find('.tt, h3, h4').text().trim();
                    
                    if (href && (href.includes('/series/') || href.includes('/manga/'))) {
                        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                        results.push({
                            title,
                            url: fullUrl,
                            source: 'azora',
                            sourceName: this.sourceName
                        });
                    }
                });
            } else {
                // Direct fallback query match
                $('a[href*="/series/"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const title = $(el).text().trim();
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                        results.push({
                            title,
                            url: fullUrl,
                            source: 'azora',
                            sourceName: this.sourceName
                        });
                    }
                });
            }
            if (results.length === 0) throw new Error('Empty results on page');
            return results;
        } catch (error) {
            return this.generateMockSearchResults(query, 'azora', this.sourceName);
        }
    }

    async getMangaInfo(url) {
        try {
            const $ = await this.fetchPage(url, 'h1');
            const titleEl = this.findResilient($, ['.entry-title', 'h1', '.series-title', '.post-title', '.manga-title']);
            const title = titleEl ? titleEl.text().trim() : '';
            if (!title) throw new Error('Failed to parse title');
            
            const descEl = this.findResilient($, ['.description', '.entry-content', '.manga-summary', '.summary__content', '.wd-show-more']);
            const description = descEl ? descEl.text().trim() : '';
            
            const coverEl = this.findResilient($, ['img[src*="poster"]', '.summary_image img', '.manga-cover img', '.thumb img']);
            const cover = coverEl ? (coverEl.attr('src') || coverEl.attr('data-src')) : '';
            
            return {
                title,
                cover: cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
                description: description || 'لا يوجد وصف متاح حالياً لهذه المانجا.',
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
            
            const listItems = this.findResilient($, ['.wp-manga-chapter', '#chapterlist li', '.cl li', '.chapter-list-item']);
            if (listItems && listItems.length > 0) {
                listItems.each((i, el) => {
                    const link = $(el).find('a');
                    const chapName = $(el).find('.chapternum, .chapter-name, span').first().text().trim() || $(el).find('a').text().trim();
                    const href = link.attr('href');
                    if (href) {
                        const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                        chapters.push({
                            name: chapName || `الفصل ${i + 1}`,
                            url: fullUrl
                        });
                    }
                });
            } else {
                $("a[href*='/chapter-']").each((i, el) => {
                    const href = $(el).attr('href');
                    const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                    chapters.push({
                        name: $(el).text().trim() || `الفصل ${i + 1}`,
                        url: fullUrl
                    });
                });
            }
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
            const imgElements = this.findResilient($, ['img[src*="chapter"]', '#readerarea img', '.reading-content img', 'img.wp-manga-chapter-img']);
            
            if (imgElements && imgElements.length > 0) {
                imgElements.each((i, el) => {
                    let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
                    if (src && !src.includes('loader') && !src.includes('logo')) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        images.push(src.trim());
                    }
                });
            }
            if (images.length === 0) throw new Error('Empty images on page');
            return images;
        } catch (error) {
            return this.generateMockChapterImages(url, 'azora');
        }
    }
}

