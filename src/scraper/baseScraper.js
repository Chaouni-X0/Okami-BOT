import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Multi-Engine & Self-Healing Scraper Core
     */
    async fetch(url, options = {}) {
        const { useBrowser = true, retries = 3 } = options;
        let lastError;

        for (let i = 0; i < retries; i++) {
            try {
                // Engine 1: Playwright (Primary)
                if (useBrowser) {
                    const result = await this.fetchWithPlaywright(url);
                    if (result) return result;
                }

                // Engine 2: Axios + Cheerio (Fallback)
                logger.info(`[${this.sourceName}] Fallback to Axios (Attempt ${i + 1})`);
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': this.getRandomUserAgent(),
                        'Referer': this.baseUrl
                    }
                });
                return cheerio.load(response.data);

            } catch (error) {
                lastError = error;
                logger.warn(`[${this.sourceName}] Attempt ${i + 1} failed: ${error.message}`);
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
            }
        }

        logger.error(`[${this.sourceName}] All engines failed for ${url}`);
        return null;
    }

    async fetchWithPlaywright(url) {
        let context;
        try {
            if (!this.browser) {
                this.browser = await chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
                });
            }

            context = await this.browser.newContext({
                userAgent: this.getRandomUserAgent(),
                viewport: { width: 1280, height: 800 }
            });

            const page = await context.newPage();
            
            // Evasion
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait for any content to load
            await page.waitForTimeout(2000 + Math.random() * 2000);

            // Cloudflare Detection
            const title = await page.title();
            if (title.includes('Cloudflare') || title.includes('Just a moment')) {
                throw new Error('Cloudflare blocked');
            }

            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Self-Healing Logic: Check if common selectors exist, if not, try smart extraction
            const commonSelectors = ['.listupd', '.mainholder', '.utao', '.bs', '.series-card'];
            const exists = commonSelectors.some(s => $(s).length > 0);
            
            if (!exists) {
                logger.info(`[${this.sourceName}] DOM Changed. Activating Self-Healing Smart Extraction...`);
                $.isSelfHealing = true;
                $.smartData = await this.smartExtract(page);
            }

            await context.close();
            return $;
        } catch (error) {
            if (context) await context.close();
            throw error;
        }
    }

    async smartExtract(page) {
        return await page.evaluate(() => {
            // Find all links that look like manga or series
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => ({
                    title: a.innerText.trim().split('\n')[0],
                    url: a.href,
                    img: a.querySelector('img')?.src || a.querySelector('img')?.getAttribute('data-src')
                }))
                .filter(link => {
                    const href = link.url.toLowerCase();
                    return (href.includes('manga') || href.includes('series') || href.includes('manhwa')) 
                           && link.title.length > 2;
                });

            // De-duplicate
            const unique = [];
            const seen = new Set();
            for (const link of links) {
                if (!seen.has(link.url)) {
                    seen.add(link.url);
                    unique.push(link);
                }
            }
            return unique.slice(0, 20);
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
