import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
        this.discoveredApis = new Map(); // Store source -> API URL mapping
    }

    /**
     * Smart API-based Scraper Core
     */
    async fetch(url, options = {}) {
        const { useBrowser = true, interceptApis = true } = options;
        
        // 1. Try previously discovered API for this source (Fastest)
        if (this.discoveredApis.has(this.sourceName)) {
            const apiInfo = this.discoveredApis.get(this.sourceName);
            try {
                logger.info(`[${this.sourceName}] Using Discovered API: ${apiInfo.url}`);
                const response = await axios.get(apiInfo.url, { timeout: 10000 });
                if (this.isValidMangaJson(response.data)) {
                    return { isApi: true, data: response.data };
                }
            } catch (e) {
                logger.warn(`[${this.sourceName}] Discovered API failed, falling back to browser.`);
                this.discoveredApis.delete(this.sourceName);
            }
        }

        if (useBrowser) {
            try {
                return await this.fetchWithSmartInterception(url, interceptApis);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Smart Interception failed: ${error.message}`);
            }
        }

        // 2. Axios + Cheerio Fallback
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });
            return cheerio.load(response.data);
        } catch (error) {
            logger.error(`[${this.sourceName}] All engines failed for ${url}`);
            return null;
        }
    }

    async fetchWithSmartInterception(url, interceptApis) {
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
            const validApiData = [];

            if (interceptApis) {
                // 1. Smart Filtering Interception
                await page.route('**/*', async (route) => {
                    const request = route.request();
                    const reqUrl = request.url();
                    
                    // Ignore noisy domains
                    const ignoredPatterns = ['analytics', 'track', 'ads', 'promotion', 'announcement', 'google-analytics', 'facebook', 'doubleclick'];
                    if (ignoredPatterns.some(p => reqUrl.includes(p))) {
                        return route.abort();
                    }
                    
                    route.continue();
                });

                // 2. Response Monitoring for Valid JSON
                page.on('response', async (response) => {
                    const req = response.request();
                    const reqUrl = req.url();
                    
                    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') && response.status() === 200) {
                        try {
                            const contentType = response.headers()['content-type'];
                            if (contentType && contentType.includes('application/json')) {
                                const json = await response.json();
                                if (this.isValidMangaJson(json)) {
                                    logger.info(`[${this.sourceName}] VALID API DISCOVERED: ${reqUrl}`);
                                    validApiData.push({ url: reqUrl, data: json });
                                    this.discoveredApis.set(this.sourceName, { url: reqUrl, timestamp: Date.now() });
                                }
                            }
                        } catch (e) {}
                    }
                });
            }

            // Evasion
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            
            // Return result
            if (validApiData.length > 0) {
                await context.close();
                return { isApi: true, data: validApiData[0].data };
            }

            const content = await page.content();
            const $ = cheerio.load(content);
            await context.close();
            return $;
        } catch (error) {
            if (context) await context.close();
            throw error;
        }
    }

    /**
     * Heuristic to check if JSON contains manga-like data
     */
    isValidMangaJson(json) {
        if (!json) return false;
        const stringified = JSON.stringify(json).toLowerCase();
        
        // Check for common manga fields
        const markers = ['title', 'name', 'results', 'posts', 'series', 'manga', 'chapter'];
        const hasMarkers = markers.some(m => stringified.includes(m));
        
        // Check for actual data structure
        const hasData = Array.isArray(json) || 
                        (json.posts && Array.isArray(json.posts)) || 
                        (json.results && Array.isArray(json.results)) ||
                        (json.data && (Array.isArray(json.data) || json.data.items));
                        
        return hasMarkers && hasData;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
