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
     * Advanced fetchPage with Playwright + Axios Fallback
     */
    async fetchPage(url, options = {}) {
        const { waitSelector = null, useBrowser = true } = options;

        // Try Playwright First
        if (useBrowser) {
            try {
                return await this.fetchWithBrowser(url, waitSelector);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Playwright failed for ${url}, trying Axios fallback... Error: ${error.message}`);
            }
        }

        // Axios Fallback
        try {
            logger.info(`[${this.sourceName}] Axios Fallback Fetch: ${url}`);
            const response = await axios.get(url, {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Referer': this.baseUrl
                }
            });
            return cheerio.load(response.data);
        } catch (error) {
            logger.error(`[${this.sourceName}] Critical: Both Playwright and Axios failed for ${url}. Error: ${error.message}`);
            throw new Error(`Failed to fetch page: ${url}`);
        }
    }

    /**
     * Legacy fetch method support
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
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                });
            }
            
            context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();
            
            // Stealth Injection
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            logger.info(`[${this.sourceName}] Playwright Fetching: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            
            if (waitSelector) {
                await page.waitForSelector(waitSelector, { timeout: 15000 }).catch(() => {
                    logger.warn(`[${this.sourceName}] Selector ${waitSelector} not found within timeout.`);
                });
            } else {
                await page.waitForTimeout(2000);
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
