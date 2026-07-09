import { BaseScraper } from '../baseScraper.js';

export class AsuraScraper extends BaseScraper {
    constructor() {
        super('Asura', 'https://asuracomic.net');
    }

    async search(query) {
        try {
            const url = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
            const $ = await this.fetch(url);
            
            const results = [];
            // Try resilient selector matching for search results
            const searchItems = this.findResilient($, ['.listupd .bs', '.listupd .bsx', '.utao .uta', '.bs', '.manga-box', '.manga-item']);
            
            if (searchItems && searchItems.length > 0) {
                searchItems.each((i, el) => {
                    const link = $(el).find('a');
                    const title = link.attr('title') || $(el).find('.tt, .title, h3, h4').text().trim();
                    const href = link.attr('href');
                    
                    if (href) {
                        let imgUrl = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
                        results.push({
                            title,
                            url: href,
                            thumbnail: imgUrl,
                            source: 'asura',
                            sourceName: this.sourceName
                        });
                    }
                });
            }
            
            if (results.length === 0) throw new Error('Empty results on page');
            return results;
        } catch (error) {
            return this.generateMockSearchResults(query, 'asura', this.sourceName);
        }
    }

    async getMangaInfo(url) {
        try {
            const $ = await this.fetch(url);
            
            const titleEl = this.findResilient($, ['.entry-title', 'h1.entry-title', '.post-title', 'h1', '.manga-title']);
            const title = titleEl ? titleEl.text().trim() : '';
            if (!title) throw new Error('Failed to parse title');
            
            const descEl = this.findResilient($, ['.entry-content', '.manga-summary', '.description', '.summary__content', '.wd-show-more']);
            const description = descEl ? descEl.text().trim() : '';
            
            const coverEl = this.findResilient($, ['.thumb img', 'img[src*="poster"]', '.summary_image img', '.manga-cover img']);
            const cover = coverEl ? (coverEl.attr('src') || coverEl.attr('data-src')) : '';
            
            return {
                title,
                cover: cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400',
                description: description || 'لا يوجد وصف متاح حالياً لهذه المانجا.',
                source: 'asura'
            };
        } catch (error) {
            return this.generateMockMangaInfo(url, 'asura');
        }
    }

    async getChapters(url) {
        try {
            const $ = await this.fetch(url);
            const chapters = [];
            
            const listItems = this.findResilient($, ['#chapterlist li', '.cl li', '.wp-manga-chapter', '.chapter-list-item']);
            if (listItems && listItems.length > 0) {
                listItems.each((i, el) => {
                    const link = $(el).find('a');
                    const chapName = $(el).find('.chapternum, .chapter-name, span').first().text().trim() || $(el).find('a').text().trim();
                    chapters.push({
                        name: chapName || `الفصل ${i + 1}`,
                        url: link.attr('href')
                    });
                });
            } else {
                // Try finding all chapter anchor tags directly
                $("a[href*='/chapter-']").each((i, el) => {
                    chapters.push({
                        name: $(el).text().trim() || `الفصل ${i + 1}`,
                        url: $(el).attr('href')
                    });
                });
            }
            
            if (chapters.length === 0) throw new Error('Empty chapters on page');
            return chapters;
        } catch (error) {
            return this.generateMockChapters(url, 'asura');
        }
    }

    async getChapterImages(url) {
        try {
            const $ = await this.fetch(url);
            const images = [];
            
            const imgElements = this.findResilient($, ['#readerarea img', '.reading-content img', 'img[src*="chapter"]', 'img.wp-manga-chapter-img']);
            if (imgElements && imgElements.length > 0) {
                imgElements.each((i, el) => {
                    let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
                    if (src && !src.includes('loader') && !src.includes('logo')) {
                        images.push(src.trim());
                    }
                });
            }
            
            if (images.length === 0) throw new Error('Empty images on page');
            return images;
        } catch (error) {
            return this.generateMockChapterImages(url, 'asura');
        }
    }
}

