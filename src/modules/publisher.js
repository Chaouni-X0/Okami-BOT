import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/config.js';

export class FacebookPublisher {
    constructor() {
        this.baseUrl = `https://graph.facebook.com/v19.0/${config.facebook.pageId}`;
        this.accessToken = config.facebook.accessToken;
    }

    async publishChapter(mangaTitle, chapterNumber, imagePaths) {
        try {
            const photoIds = [];
            
            // 1. رفع الصور كـ "Unpublished" للحصول على IDs
            for (const imgPath of imagePaths) {
                const formData = new FormData();
                formData.append('source', fs.createReadStream(imgPath));
                formData.append('published', 'false');
                formData.append('access_token', this.accessToken);

                const res = await axios.post(`${this.baseUrl}/photos`, formData, {
                    headers: formData.getHeaders()
                });
                photoIds.push({ media_fbid: res.data.id });
            }

            // 2. إنشاء المنشور النهائي الذي يجمع الصور
            const message = `
🔥 ${mangaTitle} - الفصل ${chapterNumber} 🔥

📖 استمتعوا بقراءة الفصل الجديد من مانهوا ${mangaTitle}.

✨ تم النشر بواسطة Okami Bot ✨
            `.trim();

            const postRes = await axios.post(`${this.baseUrl}/feed`, {
                message: message,
                attached_media: photoIds,
                access_token: this.accessToken
            });

            return postRes.data.id;
        } catch (error) {
            console.error('Facebook publishing error:', error.response?.data || error.message);
            throw error;
        }
    }

    async publishAggregation(mangaData, chapterLinks) {
        try {
            const message = `
📚 مانهوا: ${mangaData.title}
📊 الحالة: ${mangaData.status === 'ongoing' ? 'مستمرة 🟢' : 'مكتملة 🔴'}

🔗 قائمة الفصول المنشورة:
${chapterLinks.map(c => `🔹 فصل ${c.number}: [رابط المنشور]`).join('\n')}

✨ تم التحديث بواسطة Okami Bot ✨
            `.trim();

            const res = await axios.post(`${this.baseUrl}/feed`, {
                message: message,
                link: mangaData.sourceUrl,
                access_token: this.accessToken
            });

            return res.data.id;
        } catch (error) {
            console.error('Facebook aggregation error:', error.response?.data || error.message);
            return null;
        }
    }
}
