import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
        this.interceptedApis = new Set();
    }

    /**
     * Network-Level Scraper Core
     */
    async fetch(url, options = {}) {
        const { useBrowser = true, interceptApis = true } = options;
        
        if (useBrowser) {
            try {
                return await this.fetchWithNetworkSniffing(url, interceptApis);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Network sniffing failed, trying Axios fallback: ${error.message}`);
            }
        }

        // Axios Fallback
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

    async fetchWithNetworkSniffing(url, interceptApis) {
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
            const interceptedData = [];

            // 1. Network Interception
            if (interceptApis) {
                await page.route('**/*', async (route) => {
                    const request = route.request();
                    const reqUrl = request.url();
                    
                    // Look for XHR/Fetch requests that might be APIs
                    if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
                        if (reqUrl.includes('/api/') || reqUrl.includes('search') || reqUrl.includes('graphql') || reqUrl.includes('query')) {
                            logger.info(`[${this.sourceName}] Intercepted Potential API: ${reqUrl}`);
                            this.interceptedApis.add(reqUrl);
                        }
                    }
                    route.continue();
                });

                // Listen for responses to capture JSON data directly
                page.on('response', async (response) => {
                    const req = response.request();
                    if ((req.resourceType() === 'xhr' || req.resourceType() === 'fetch') && response.status() === 200) {
                        try {
                            const contentType = response.headers()['content-type'];
                            if (contentType && contentType.includes('application/json')) {
                                const json = await response.json();
                                interceptedData.push({ url: req.url(), data: json });
                            }
                        } catch (e) {
                            // Not JSON or error reading
                        }
                    }
                });
            }

            // Evasion
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            
            // 2. Return result with intercepted data
            const content = await page.content();
            const $ = cheerio.load(content);
            
            $.interceptedData = interceptedData;
            $.isNetworkLevel = true;

            await context.close();
            return $;
        } catch (error) {
            if (context) await context.close();
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
