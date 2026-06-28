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
                    chapterList: '.chapters-list li',
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

    async parseManga(sourceKey, mangaSlug) {
        const source = this.sources[sourceKey];
        if (!source) throw new Error(`Source ${sourceKey} not supported.`);

        const url = `${source.baseUrl}/manga/${mangaSlug}`;
        const html = await this.fetchHtml(url);
        if (!html) return null;

        const $ = cheerio.load(html);
        const title = $(source.selectors.title).text().trim();
        const chapters = [];

        $(source.selectors.chapterList).each((i, el) => {
            const link = $(el).find('a').attr('href');
            const name = $(el).find('a').text().trim();
            if (link) chapters.push({ name, url: link });
        });

        return {
            title,
            slug: mangaSlug,
            sourceKey,
            chapters: chapters.reverse()
        };
    }

    async parseChapterImages(sourceKey, chapterUrl) {
        const source = this.sources[sourceKey];
        const html = await this.fetchHtml(chapterUrl);
        if (!html) return [];

        const $ = cheerio.load(html);
        const images = [];

        $(source.selectors.images).each((i, el) => {
            const imgUrl = $(el).attr('src') || $(el).attr('data-src');
            if (imgUrl) images.push(imgUrl.trim());
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
