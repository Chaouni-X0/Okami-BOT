import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import https from 'https';
import { config } from '../config/config.enhanced.js';
import logger from '../utils/logger.js';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export class FacebookPublisher {
    static baseUrl = `https://graph.facebook.com/v19.0/${config.facebook.pageId}`;
    static accessToken = config.facebook.accessToken.trim();

    static async publishChapter(imagePaths, message) {
        try {
            const photoIds = [];
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
        const versions = ['v25.0', 'v22.0', 'v21.0', 'v19.0'];
        let lastError = null;

        for (const version of versions) {
            try {
                logger.info(`[ULTRA-SEND] Attempting to send via ${version}...`);
                await axios.post(`https://graph.facebook.com/${version}/me/messages`, {
                    recipient: { id: recipientId },
                    message: { text: text }
                }, {
                    params: { access_token: this.accessToken },
                    httpsAgent: httpsAgent,
                    timeout: 15000 // مهلة أقصر لكل محاولة لسرعة التبديل
                });
                logger.info(`[ULTRA-SEND] Success via ${version}!`);
                return true;
            } catch (error) {
                lastError = error;
                logger.warn(`[ULTRA-SEND] Failed via ${version}: ${error.message}`);
                // استمرار للمحاولة التالية
            }
        }

        logger.error(`[ULTRA-SEND] ALL ATTEMPTS FAILED. Last error: ${lastError.response?.data?.error?.message || lastError.message}`);
        return false;
    }

    /**
     * نشر منشور تجميعي مع دعم الأجزاء (للأعمال الطويلة)
     */
    static async publishAggregation(mangaData, chapters) {
        try {
            const partTitle = mangaData.partNumber ? `(الجزء ${mangaData.partNumber})` : '';
            const rangeText = `الفصول: من ${mangaData.startChapter} إلى ${mangaData.endChapter}`;
            
            const message = `
🐺 المنشور التجميعي لمانهوا: ${mangaData.title} ${partTitle}
📊 الحالة: ${mangaData.status === 'Ongoing' ? 'مستمرة 🟢' : 'مكتملة 🔴'}
📌 ${rangeText}

🔗 روابط الفصول في هذا الجزء:
${chapters.map(c => `🔹 الفصل ${c.chapter_number}: https://facebook.com/${c.fb_post_id}`).join('\n')}

#OkamiBot #Manga #Aggregation #Part${mangaData.partNumber || 1}
            `.trim();

            // ملاحظة: فيسبوك لديه حد لعدد الكلمات، لذا نقوم بتقليص الرسالة إذا كانت طويلة جداً
            const finalMessage = message.length > 8000 ? message.substring(0, 7900) + "...\n(يتبع في تعليق)" : message;

            const res = await axios.post(`${this.baseUrl}/feed`, {
                message: finalMessage,
                access_token: this.accessToken
            });

            return res.data.id;
        } catch (error) {
            logger.error(`Facebook aggregation error: ${error.response?.data?.error?.message || error.message}`);
            return null;
        }
    }
}
