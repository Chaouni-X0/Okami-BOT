import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ScraperEngine {
    constructor() {
        this.client = axios.create({
            headers: { 'User-Agent': config.scraping.userAgent },
            timeout: config.scraping.timeout
        });
        
        this.sources = {
            'azora': {
                name: 'Azora Moon',
                baseUrl: 'https://azoramoon.com',
                selectors: {
                    title: '.post-title h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'swat': {
                name: 'Swat Manga',
                baseUrl: 'https://swatmanga.me',
                selectors: {
                    title: '.post-title h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'teamx': {
                name: 'Team X',
                baseUrl: 'https://teamx.top',
                selectors: {
                    title: '.post-title h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'mangaarab': {
                name: 'Manga Arab',
                baseUrl: 'https://mangaarab.com',
                selectors: {
                    title: 'h1',
                    chapterList: '.chapters-list a',
                    images: '#reader-images img'
                }
            },
            'mangalek': {
                name: 'Manga Lek',
                baseUrl: 'https://mangalek.com',
                selectors: {
                    title: '.post-title h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'ares': {
                name: 'Ares Manga',
                baseUrl: 'https://aresmanga.net',
                selectors: {
                    title: 'h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'galaxy': {
                name: 'Galaxy Manga',
                baseUrl: 'https://galaxymanga.org',
                selectors: {
                    title: 'h1',
                    chapterList: '.wp-manga-chapter',
                    images: '.reading-content img'
                }
            },
            'gmanga': {
                name: 'G-Manga',
                baseUrl: 'https://gmanga.me',
                selectors: {
                    title: 'h1',
                    chapterList: '.chapters-list',
                    images: '.reader-image img'
                }
            }
        };
    }

    async fetchHtml(url) {
        try {
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            logger.error(`Error fetching URL ${url}: ${error.message}`);
            return null;
        }
    }

    identifySource(url) {
        try {
            const hostname = new URL(url).hostname;
            for (const [key, source] of Object.entries(this.sources)) {
                if (hostname.includes(new URL(source.baseUrl).hostname.replace('www.', ''))) {
                    return key;
                }
            }
        } catch (e) {}
        return null;
    }

    extractChapterNumber(name) {
        const match = name.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }

    async parseManga(sourceKeyOrUrl, mangaSlug = null) {
        let sourceKey = sourceKeyOrUrl;
        let url;

        if (sourceKeyOrUrl.startsWith('http')) {
            sourceKey = this.identifySource(sourceKeyOrUrl);
            url = sourceKeyOrUrl;
        } else {
            const source = this.sources[sourceKey];
            if (!source) throw new Error(`Source ${sourceKey} not supported.`);
            url = `${source.baseUrl}/manga/${mangaSlug}`;
        }

        if (!sourceKey) throw new Error(`Could not identify source for ${sourceKeyOrUrl}`);
        const source = this.sources[sourceKey];

        const html = await this.fetchHtml(url);
        if (!html) return null;

        const $ = cheerio.load(html);
        const title = $(source.selectors.title).text().trim() || $('title').text().trim();
        const chapters = [];

        $(source.selectors.chapterList).each((i, el) => {
            const $el = $(el);
            let link = $el.attr('href') || $el.find('a').attr('href');
            let name = $el.text().trim();
            
            if (link) {
                const isChapterLink = link.includes('/chapter/') || link.includes('/chapters/') || /\/(\d+(\.\d+)?)\/?$/.test(link);
                if (isChapterLink) {
                    chapters.push({ 
                        name, 
                        url: link.startsWith('http') ? link : `${source.baseUrl}${link}`,
                        number: this.extractChapterNumber(name)
                    });
                }
            }
        });

        return {
            title,
            slug: mangaSlug || url.split('/').filter(Boolean).pop(),
            sourceKey,
            sourceUrl: url,
            chapters: chapters.reverse()
        };
    }

    async parseChapterImages(sourceKey, chapterUrl) {
        const source = this.sources[sourceKey];
        if (!source) {
            const identifiedKey = this.identifySource(chapterUrl);
            if (!identifiedKey) return [];
            return this.parseChapterImages(identifiedKey, chapterUrl);
        }

        const html = await this.fetchHtml(chapterUrl);
        if (!html) return [];

        const $ = cheerio.load(html);
        const images = [];

        $(source.selectors.images).each((i, el) => {
            const imgUrl = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (imgUrl && !imgUrl.includes('logo')) images.push(imgUrl.trim());
        });

        return images;
    }

    getSupportedSources() {
        return Object.keys(this.sources).map(key => ({
            id: key,
            name: this.sources[key].name,
            url: this.sources[key].baseUrl
        }));
    }
}

export default new ScraperEngine();
