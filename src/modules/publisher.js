import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

export class FacebookPublisher {
    static baseUrl = `https://graph.facebook.com/v19.0/${config.facebook.pageId}`;
    static accessToken = config.facebook.accessToken;

    static async publishChapter(imagePaths, message) {
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

            // 2. إنشاء المنشور النهائي
            const postRes = await axios.post(`${this.baseUrl}/feed`, {
                message: message,
                attached_media: photoIds,
                access_token: this.accessToken
            });

            return postRes.data.id;
        } catch (error) {
            logger.error(`Facebook publishing error: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    static async sendDirectMessage(recipientId, text) {
        try {
            await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${this.accessToken}`, {
                recipient: { id: recipientId },
                message: { text: text }
            });
            return true;
        } catch (error) {
            logger.error(`Failed to send direct message: ${error.response?.data?.error?.message || error.message}`);
            return false;
        }
    }

    static async publishAggregation(mangaData, chapters) {
        try {
            const message = `
🐺 المنشور التجميعي لمانهوا: ${mangaData.title}
📊 الحالة: ${mangaData.status === 'Ongoing' ? 'مستمرة 🟢' : 'مكتملة 🔴'}

🔗 روابط الفصول:
${chapters.map(c => `🔹 الفصل ${c.number}: https://facebook.com/${c.post_id}`).join('\n')}

#OkamiBot #Manga #Aggregation
            `.trim();

            const res = await axios.post(`${this.baseUrl}/feed`, {
                message: message,
                access_token: this.accessToken
            });

            return res.data.id;
        } catch (error) {
            logger.error(`Facebook aggregation error: ${error.response?.data?.error?.message || error.message}`);
            return null;
        }
    }
}
