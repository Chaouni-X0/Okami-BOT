import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/config.enhanced.js';
import logger from '../utils/logger.js';

export class FacebookPublisher {
    static baseUrl = `https://graph.facebook.com/v19.0/${config.facebook.pageId}`;
    static accessToken = process.env.FACEBOOK_ACCESS_TOKEN.trim();

    static async publishChapter(imagePaths, message) {
        try {
            const photoIds = [];
            for (const imgPath of imagePaths) {
                const formData = new FormData();
                formData.append('source', fs.createReadStream(imgPath));
                formData.append('published', 'false');
                formData.append('access_token', this.accessToken);

                const response = await fetch(`${this.baseUrl}/photos`, {
                    method: 'POST',
                    headers: {
                        ...formData.getHeaders(),
                        'User-Agent': 'OkamiBot/5.0'
                    },
                    body: formData,
                    signal: AbortSignal.timeout(60000)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Photo Upload Failed: ${response.status} - ${errText}`);
                }

                const data = await response.json();
                photoIds.push({ media_fbid: data.id });
            }

            const postResponse = await fetch(`${this.baseUrl}/feed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OkamiBot/5.0'
                },
                body: JSON.stringify({
                    message: message,
                    attached_media: photoIds,
                    access_token: this.accessToken
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (!postResponse.ok) {
                const errText = await postResponse.text();
                throw new Error(`Feed Post Failed: ${postResponse.status} - ${errText}`);
            }

            const postData = await postResponse.json();
            return postData.id;
        } catch (error) {
            logger.error(`Facebook publishing error: ${error.message}`);
            throw error;
        }
    }

    static async sendDirectMessage(recipientId, text) {
        try {
            logger.info(`[SEND] Sending to ${recipientId} via v21.0...`);
            const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${this.accessToken}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OkamiBot/5.0'
                },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: text }
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Facebook API Error: ${response.status} - ${errorData}`);
            }

            logger.info(`[SEND] Success! Message sent to ${recipientId}`);
            return true;
        } catch (error) {
            logger.error(`[SEND] Failed: ${error.message}`);
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

            const postResponse = await fetch(`${this.baseUrl}/feed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    message: finalMessage,
                    access_token: this.accessToken
                }),
                redirect: 'follow',
                signal: AbortSignal.timeout(30000)
            });

            if (!postResponse.ok) {
                const errText = await postResponse.text();
                throw new Error(`Feed Post Failed: ${postResponse.status} - ${errText}`);
            }

            const res = await postResponse.json();

            return res.data.id;
        } catch (error) {
            logger.error(`Facebook aggregation error: ${error.message}`);
            return null;
        }
    }
}
