import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
    }

    /**
     * The main entry for fetching pages. 
     * Tries Playwright first for high fidelity, falls back to Axios for speed/reliability.
     */
    async fetchPage(url, options = {}) {
        const { waitSelector = null, useBrowser = true } = options;

        if (useBrowser) {
            try {
                return await this.fetchWithBrowser(url, waitSelector);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Playwright failed, falling back to Axios: ${error.message}`);
            }
        }

        // Fallback to Axios
        try {
            logger.info(`[${this.sourceName}] Axios Fetch (Fallback): ${url}`);
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer': this.baseUrl
                }
            });
            return cheerio.load(response.data);
        } catch (error) {
            logger.error(`[${this.sourceName}] Both Playwright and Axios failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Legacy support for 'fetch' method if still used
     */
    async fetch(url, options = {}) {
        return this.fetchPage(url, options);
    }

    async fetchWithBrowser(url, waitSelector = null) {
        let context;
        try {
            if (!this.browser) {
                this.browser = await chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            }
            
            context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            });

            const page = await context.newPage();
            
            // Stealth Injection
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            logger.info(`[${this.sourceName}] Playwright Fetch: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            if (waitSelector) {
                await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
            }

            const content = await page.content();
            await context.close();
            return cheerio.load(content);
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
