import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';

export class ChapterProcessor {
    constructor() {
        this.tempDir = path.resolve('./src/temp');
        if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    }

    async processChapter(mangaSlug, chapterNumber, imageUrls) {
        const chapterDir = path.join(this.tempDir, `${mangaSlug}-ch-${chapterNumber}`);
        if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

        const processedImages = [];

        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const imgUrl = imageUrls[i];
                const imgPath = path.join(chapterDir, `page-${i}.jpg`);
                
                // تحميل الصورة
                const response = await axios({
                    url: imgUrl,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': config.scraping.userAgent }
                });

                // معالجة الصورة (ضغط + تحويل لـ JPG لتناسب فيسبوك)
                await sharp(response.data)
                    .jpeg({ quality: 80 })
                    .toFile(imgPath);

                processedImages.push(imgPath);
            } catch (error) {
                console.error(`Failed to process image ${i} in chapter ${chapterNumber}:`, error.message);
            }
        }

        return {
            chapterDir,
            images: processedImages
        };
    }

    cleanup(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`Cleaned up directory: ${dirPath}`);
        }
    }
}
