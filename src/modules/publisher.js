import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import https from 'https';
import dns from 'dns';
import { config } from '../config/config.enhanced.js';
import logger from '../utils/logger.js';

// Custom DNS Lookup لتجاوز مشاكل الشبكة في Hugging Face
const customLookup = (hostname, options, callback) => {
    return dns.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) {
            return dns.lookup(hostname, options, callback);
        }
        callback(null, addresses[0], 4);
    });
};

const httpsAgent = new https.Agent({ 
    lookup: customLookup, 
    keepAlive: true,
    rejectUnauthorized: false 
});

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
        try {
            logger.info(`[SEND] Sending to ${recipientId} via v21.0...`);
            const response = await axios({
                method: 'POST',
                url: `https://graph.facebook.com/v21.0/me/messages`,
                params: { access_token: this.accessToken },
                data: {
                    recipient: { id: recipientId },
                    message: { text: text }
                },
                httpsAgent: httpsAgent,
                timeout: 10000
            });
            logger.info(`[SEND] Success! Message sent to ${recipientId}`);
            return true;
        } catch (error) {
            logger.error(`[SEND] Failed: ${error.response?.data?.error?.message || error.message}`);
            return false;
        }
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
