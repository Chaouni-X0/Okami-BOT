import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
        this.discoveredApis = new Map();
    }

    /**
     * Hybrid Scraper Engine (API + DOM)
     */
    async fetch(url, options = {}) {
        const { useBrowser = true, interceptApis = true } = options;
        
        // 1. Check for Discovered API (Fast Path)
        if (this.discoveredApis.has(this.sourceName)) {
            const apiInfo = this.discoveredApis.get(this.sourceName);
            try {
                logger.info(`[${this.sourceName}] Fetching via API: ${apiInfo.url}`);
                const response = await axios.get(apiInfo.url, { timeout: 10000 });
                if (this.isValidMangaJson(response.data)) {
                    return { type: 'api', data: response.data };
                }
            } catch (e) {
                this.discoveredApis.delete(this.sourceName);
            }
        }

        // 2. Browser Interception (Discovery Path)
        if (useBrowser) {
            try {
                return await this.fetchWithHybridDiscovery(url, interceptApis);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Browser discovery failed: ${error.message}`);
            }
        }

        // 3. Direct Axios + Cheerio (Legacy Fallback)
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });
            return { type: 'dom', data: cheerio.load(response.data) };
        } catch (error) {
            logger.error(`[${this.sourceName}] All engines failed for ${url}`);
            return null;
        }
    }

    async fetchWithHybridDiscovery(url, interceptApis) {
        let context;
        try {
            if (!this.browser) {
                this.browser = await chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });
            }

            context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            });

            const page = await context.newPage();
            let discoveredJson = null;

            if (interceptApis) {
                await page.route('**/*', (route) => {
                    const reqUrl = route.request().url();
                    // Advanced filtering: Ignore ads, analytics, comments, reactions
                    const noise = ['ads', 'analytics', 'track', 'google', 'facebook', 'comment', 'reaction', 'promotion'];
                    if (noise.some(p => reqUrl.toLowerCase().includes(p))) {
                        return route.abort();
                    }
                    route.continue();
                });

                page.on('response', async (response) => {
                    const req = response.request();
                    const reqUrl = req.url();
                    
                    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') && response.status() === 200) {
                        try {
                            const contentType = response.headers()['content-type'];
                            if (contentType && contentType.includes('application/json')) {
                                const json = await response.json();
                                if (this.isValidMangaJson(json)) {
                                    logger.info(`[${this.sourceName}] Discovered Valid API: ${reqUrl}`);
                                    discoveredJson = json;
                                    this.discoveredApis.set(this.sourceName, { url: reqUrl, timestamp: Date.now() });
                                }
                            }
                        } catch (e) {}
                    }
                });
            }

            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            if (discoveredJson) {
                await context.close();
                return { type: 'api', data: discoveredJson };
            }

            const content = await page.content();
            const $ = cheerio.load(content);
            await context.close();
            return { type: 'dom', data: $ };
        } catch (error) {
            if (context) await context.close();
            throw error;
        }
    }

    isValidMangaJson(json) {
        if (!json || typeof json !== 'object') return false;
        const str = JSON.stringify(json).toLowerCase();
        
        // Exclude common noise structures
        if (str.includes('comment_text') || str.includes('reaction_type')) return false;

        const markers = ['title', 'name', 'results', 'posts', 'series', 'manga', 'chapter'];
        const hasMarkers = markers.some(m => str.includes(m));
        
        const hasData = Array.isArray(json) || 
                        (json.posts && Array.isArray(json.posts)) || 
                        (json.results && Array.isArray(json.results)) ||
                        (json.data && (Array.isArray(json.data) || json.data.items || json.data.results));
                        
        return hasMarkers && hasData;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
