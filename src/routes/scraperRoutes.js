import express from 'express';
const router = express.Router();

import { scraperManager } from '../scraper/scraperManager.js';
import logger from '../utils/logger.js';
import { Analytics } from '../utils/analytics.js';

router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    
    try {
        const results = await scraperManager.search(q);
        res.json(results);
    } catch (error) {
        logger.error(`Search route error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.get('/details', async (req, res) => {
    const { source, url } = req.query;
    if (!source || !url) return res.status(400).json({ error: 'Parameters "source" and "url" are required' });
    
    try {
        const details = await scraperManager.getDetails(source, url);
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/images', async (req, res) => {
    const { source, url } = req.query;
    if (!source || !url) return res.status(400).json({ error: 'Parameters "source" and "url" are required' });
    
    try {
        const images = await scraperManager.getChapterImages(source, url);
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/analyze', async (req, res) => {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domain parameter is required' });
    
    try {
        const stats = await Analytics.getDomainStats(domain);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
