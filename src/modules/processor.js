import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class ChapterProcessor {
    constructor() {
        this.tempDir = config.settings.tempDir;
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    async sliceImage(inputBuffer, outputDir, index) {
        try {
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();
            const maxHeight = config.settings?.maxImageHeight || 1500;
            
            if (metadata.height <= maxHeight) {
                const imgPath = path.join(outputDir, `page-${index}.jpg`);
                await image.jpeg({ quality: 85 }).toFile(imgPath);
                return [imgPath];
            }

            const numParts = Math.ceil(metadata.height / maxHeight);
            const parts = [];

            for (let i = 0; i < numParts; i++) {
                const partHeight = Math.min(maxHeight, metadata.height - (i * maxHeight));
                const partPath = path.join(outputDir, `page-${index}-part-${i}.jpg`);
                
                await sharp(inputBuffer)
                    .extract({
                        left: 0,
                        top: i * maxHeight,
                        width: metadata.width,
                        height: partHeight
                    })
                    .jpeg({ quality: 85 })
                    .toFile(partPath);
                
                parts.push(partPath);
            }

            return parts;
        } catch (error) {
            logger.error(`[Processor] Slicing Error: ${error.message}`);
            return [];
        }
    }

    async processChapter(mangaSlug, chapterNumber, imageUrls) {
        const chapterDir = path.join(this.tempDir, `${mangaSlug}-ch-${chapterNumber}`);
        if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

        const processedImages = [];

        try {
            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const imgUrl = imageUrls[i];
                    const response = await axios({
                        url: imgUrl,
                        responseType: 'arraybuffer',
                        headers: { 'User-Agent': config.scraping.userAgent },
                        timeout: 20000,
                        validateStatus: (status) => status === 200
                    });

                    const parts = await this.sliceImage(response.data, chapterDir, i);
                    if (parts.length > 0) processedImages.push(...parts);

                } catch (error) {
                    logger.warn(`[Processor] Image ${i} failed: ${error.message}`);
                }
            }
            
            if (processedImages.length === 0) throw new Error("No images were successfully processed for this chapter.");
            
            return { chapterDir, images: processedImages };
        } catch (error) {
            logger.error(`[Processor] Critical Chapter Error: ${error.message}`);
            this.cleanup(chapterDir);
            throw error;
        }
    }

    cleanup(dirPath) {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
                logger.info(`[Cleanup] Deleted directory: ${dirPath}`);
            }
        } catch (err) {
            logger.error(`[Cleanup Error] ${err.message}`);
        }
    }
}
