import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';

export class BaseScraper {
    constructor(sourceName, baseUrl) {
        this.sourceName = sourceName;
        this.baseUrl = baseUrl;
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ]
            });
        }
        return this.browser;
    }

    async createPage(browser) {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
        });

        const page = await context.newPage();

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        return { page, context };
    }

    async fetchPage(url, waitSelector = null, retries = 3) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            let browser, context, page;
            try {
                browser = await this.initBrowser();
                const setup = await this.createPage(browser);
                page = setup.page;
                context = setup.context;

                logger.info(`[${this.sourceName}] Fetching: ${url} (Attempt ${i + 1})`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                if (waitSelector) {
                    await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
                } else {
                    await page.waitForTimeout(2000);
                }

                const content = await page.content();
                await context.close();
                return cheerio.load(content);
            } catch (error) {
                lastError = error;
                logger.error(`[${this.sourceName}] Error fetching ${url}: ${error.message}`);
                if (context) await context.close();
                await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
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
