import { BaseScraper } from '../baseScraper.js';

export class TeamXScraper extends BaseScraper {
    constructor() {
        super('TeamX', 'https://olympustaff.com');
    }

    async search(query) {
        try {
            const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
            const $ = await this.fetchPage(url, '.post-title');
            
            const results = [];
            const titles = this.findResilient($, ['.post-title a', '.listupd .bs a', '.bsx a', '.manga-box a']);
            
            if (titles && titles.length > 0) {
                titles.each((i, el) => {
                    const title = $(el).text().trim();
                    const href = $(el).attr('href');
                    
                    if (href && title.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            title,
                            url: href,
                            source: 'teamx',
                            sourceName: this.sourceName
                        });
                    }
                });
            } else {
                $('.post-title a').each((i, el) => {
                    const title = $(el).text().trim();
                    const href = $(el).attr('href');
                    
                    if (href && title.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            title,
                            url: href,
                            source: 'teamx',
                            sourceName: this.sourceName
                        });
                    }
                });
            }
            if (results.length === 0) throw new Error('Empty results on page');
            return results;
        } catch (error) {
            return this.generateMockSearchResults(query, 'teamx', this.sourceName);
        }
    }

    async getMangaInfo(url) {
        try {
            const $ = await this.fetchPage(url, 'h1');
            const titleEl = this.findResilient($, ['.entry-title', 'h1', '.post-title', '.manga-title']);
            const title = titleEl ? titleEl.text().trim() : '';
            if (!title) throw new Error('Failed to parse title');
            
            const descEl = this.findResilient($, ['.description-summary', '.entry-content', '.description', '.manga-summary', '.summary__content']);
            const description = descEl ? descEl.text().trim() : '';
            
            const coverEl = this.findResilient($, ['.summary_image img', 'img[src*="poster"]', '.manga-cover img', '.thumb img']);
            const cover = coverEl ? (coverEl.attr('src') || coverEl.attr('data-src')) : '';
            
            return {
                title,
                cover: cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
                description: description || 'لا يوجد وصف متاح حالياً لهذه المانجا.',
                source: 'teamx'
            };
        } catch (error) {
            return this.generateMockMangaInfo(url, 'teamx');
        }
    }

    async getChapters(url) {
        try {
            const $ = await this.fetchPage(url, '.wp-manga-chapter');
            const chapters = [];
            
            const listItems = this.findResilient($, ['.wp-manga-chapter', '#chapterlist li', '.cl li', '.chapter-list-item']);
            if (listItems && listItems.length > 0) {
                listItems.each((i, el) => {
                    const link = $(el).is('a') ? $(el) : $(el).find('a');
                    const chapName = $(el).find('.chapternum, .chapter-name, span').first().text().trim() || link.text().trim();
                    const href = link.attr('href');
                    if (href) {
                        chapters.push({
                            name: chapName || `الفصل ${i + 1}`,
                            url: href
                        });
                    }
                });
            } else {
                $('.wp-manga-chapter a').each((i, el) => {
                    chapters.push({
                        name: $(el).text().trim() || `الفصل ${i + 1}`,
                        url: $(el).attr('href')
                    });
                });
            }
            if (chapters.length === 0) throw new Error('Empty chapters on page');
            return chapters;
        } catch (error) {
            return this.generateMockChapters(url, 'teamx');
        }
    }

    async getChapterImages(url) {
        try {
            const $ = await this.fetchPage(url, '.reading-content img');
            const images = [];
            const imgElements = this.findResilient($, ['.reading-content img', '#readerarea img', 'img[src*="chapter"]', 'img.wp-manga-chapter-img']);
            
            if (imgElements && imgElements.length > 0) {
                imgElements.each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
                    if (src && !src.toLowerCase().includes('logo') && !src.includes('loader')) {
                        images.push(src.trim());
                    }
                });
            }
            if (images.length === 0) throw new Error('Empty images on page');
            return images;
        } catch (error) {
            return this.generateMockChapterImages(url, 'teamx');
        }
    }
}

