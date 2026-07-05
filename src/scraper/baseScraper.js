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
     * Resilient Scraper with Dynamic Selector Resolution & Evasion
     */
    async fetchPage(url, options = {}) {
        const { useBrowser = true } = options;

        if (useBrowser) {
            try {
                return await this.fetchWithBrowser(url);
            } catch (error) {
                logger.warn(`[${this.sourceName}] Playwright failed, trying Axios fallback... Error: ${error.message}`);
            }
        }

        // Axios Fallback (Basic)
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
            logger.error(`[${this.sourceName}] Both Playwright and Axios failed: ${error.message}`);
            return null; // Graceful return
        }
    }

    async fetchWithBrowser(url) {
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
            
            // 1. Anti-Bot / WebDriver Masking
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            logger.info(`[${this.sourceName}] Dispatching: ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            
            // 2. Cloudflare Wall Detection
            const pageTitle = await page.title();
            if (pageTitle.includes('Cloudflare') || pageTitle.includes('Just a moment')) {
                logger.error(`[ERROR] Cloudflare block detected on ${this.sourceName}`);
                await context.close();
                return null;
            }

            // 3. Dynamic Fast-Polling Selector Resolution
            const selectors = ['.listupd', '.mainholder', '.utao', '.mngsc', '.post-item', 'main #content', '.bs', '.series-card'];
            let activeSelector = null;

            for (const selector of selectors) {
                try {
                    const element = await page.waitForSelector(selector, { timeout: 3000 });
                    if (element) {
                        activeSelector = selector;
                        logger.info(`[INFO] Dynamic match found: ${activeSelector}`);
                        break;
                    }
                } catch (e) {
                    // Continue fallback
                }
            }

            if (!activeSelector) {
                logger.error(`[ERROR] Layout structural update or total block on ${this.sourceName}`);
                await context.close();
                return null;
            }

            // Return content for cheerio as fallback or for specialized scrapers
            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Store the active selector in the instance for the specialized scrapers to use if needed
            this.lastActiveSelector = activeSelector;
            
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
