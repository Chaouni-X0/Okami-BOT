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
     * Hybrid Fetcher: Tries Axios first for speed, falls back to Playwright for protected sites
     */
    async fetch(url, options = {}) {
        const { useBrowser = false, waitSelector = null, retries = 2 } = options;

        if (!useBrowser) {
            try {
                logger.info(`[${this.sourceName}] Fast Fetch (Axios): ${url}`);
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': this.baseUrl
                    }
                });
                return cheerio.load(response.data);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Axios failed, falling back to Playwright: ${error.message}`);
            }
        }

        return this.fetchWithBrowser(url, waitSelector, retries);
    }

    async fetchWithBrowser(url, waitSelector = null, retries = 2) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            let browser, context, page;
            try {
                if (!this.browser) {
                    this.browser = await chromium.launch({
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    });
                }
                
                context = await this.browser.newContext({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    viewport: { width: 1280, height: 720 }
                });

                page = await context.newPage();
                
                // Stealth Injection
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                });

                logger.info(`[${this.sourceName}] Browser Fetch (Playwright): ${url} (Attempt ${i + 1})`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                if (waitSelector) {
                    await page.waitForSelector(waitSelector, { timeout: 15000 }).catch(() => {});
                } else {
                    await page.waitForTimeout(3000);
                }

                const content = await page.content();
                await context.close();
                return cheerio.load(content);
            } catch (error) {
                lastError = error;
                logger.error(`[${this.sourceName}] Browser Error: ${error.message}`);
                if (context) await context.close();
                await new Promise(res => setTimeout(res, 2000));
            }
        }
        throw lastError;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
