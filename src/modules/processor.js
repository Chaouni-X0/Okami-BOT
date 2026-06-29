import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';

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
            console.error(`Error slicing image: ${error.message}`);
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
                        timeout: 15000, // Bulletproof timeout
                        validateStatus: (status) => status === 200
                    });

                    const parts = await this.sliceImage(response.data, chapterDir, i);
                    if (parts.length > 0) processedImages.push(...parts);

                } catch (error) {
                    console.error(`[Processor] Failed image ${i} at ${imageUrls[i]}: ${error.message}`);
                }
            }
            return { chapterDir, images: processedImages };
        } catch (error) {
            console.error(`[Processor] Chapter processing failed: ${error.message}`);
            this.cleanup(chapterDir);
            throw error;
        }
    }

    cleanup(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`Cleaned up directory: ${dirPath}`);
        }
    }
}
