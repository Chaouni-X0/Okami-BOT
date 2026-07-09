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
            const maxHeight = config.settings?.maxImageHeight || 1600;
            
            // Output options optimized for highest clarity and minimum compression artifacts
            const jpegOptions = {
                quality: 92,
                chromaSubsampling: '4:4:4',
                force: true
            };
            
            if (metadata.height <= maxHeight) {
                const imgPath = path.join(outputDir, `page-${index}.jpg`);
                await image.jpeg(jpegOptions).toFile(imgPath);
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
                    .jpeg(jpegOptions)
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

        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const imgUrl = imageUrls[i];
                const response = await axios({
                    url: imgUrl,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': config.scraping.userAgent }
                });

                const parts = await this.sliceImage(response.data, chapterDir, i);
                processedImages.push(...parts);

            } catch (error) {
                console.error(`Failed to process image ${i}:`, error.message);
            }
        }

        return { chapterDir, images: processedImages };
    }

    cleanup(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`Cleaned up directory: ${dirPath}`);
        }
    }
}
