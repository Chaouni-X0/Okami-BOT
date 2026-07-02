import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';
import { sendMessage } from '../services/messenger.js';

const PAGE_ACCESS_TOKEN = config.facebook.accessToken;
const PAGE_ID = config.facebook.pageId;
const GRAPH_API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}`;

export class FacebookPublisher {
    
    static async validateToken() {
        try {
            const response = await axios.get(`https://graph.facebook.com/me?access_token=${PAGE_ACCESS_TOKEN}`);
            logger.info(`[Publisher] Token validated: ${response.data.name}`);
            return true;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[Publisher] Token validation failed: ${errorMsg}`);
            return false;
        }
    }

    static async sendDirectMessage(psid, messagePayload) {
        try {
            const result = await sendMessage(psid, messagePayload);
            logger.info(`[Publisher] Direct message sent to ${psid}`);
            return result;
        } catch (error) {
            logger.error(`[Publisher] Direct message error: ${error.message}`);
            throw error;
        }
    }

    static async publishChapter(imagePaths, message) {
        logger.info(`[Publisher] Starting to publish chapter with ${imagePaths.length} images`);
        try {
            const photoIds = [];
            for (let i = 0; i < imagePaths.length; i++) {
                const imgPath = imagePaths[i];
                try {
                    const photoId = await this.uploadPhoto(imgPath);
                    photoIds.push({ media_fbid: photoId });
                    logger.info(`[Publisher] Uploaded photo ${i+1}/${imagePaths.length}: ${photoId}`);
                } catch (uploadError) {
                    logger.warn(`[Publisher] Failed to upload photo ${i+1}, skipping: ${uploadError.message}`);
                }
            }

            if (photoIds.length === 0) {
                throw new Error("No photos were successfully uploaded.");
            }

            const url = `${BASE_URL}/feed`;
            const payload = {
                message: message,
                attached_media: photoIds,
                access_token: PAGE_ACCESS_TOKEN
            };

            const response = await axios.post(url, payload);
            logger.info(`[Publisher] Chapter published successfully: ${response.data.id}`);
            return response.data.id;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[Publisher] Chapter publishing error: ${errorMsg}`);
            throw new Error(`Facebook Publishing Failed: ${errorMsg}`);
        }
    }

    static async uploadPhoto(filePath) {
        const url = `${BASE_URL}/photos`;
        const form = new FormData();
        if (filePath.startsWith('http')) {
            const response = await axios.get(filePath, { responseType: 'stream' });
            form.append('source', response.data);
        } else {
            form.append('source', fs.createReadStream(filePath));
        }
        form.append('published', 'false');
        form.append('access_token', PAGE_ACCESS_TOKEN);

        try {
            const response = await axios.post(url, form, {
                headers: { ...form.getHeaders() }
            });
            return response.data.id;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Photo upload error: ${errorMsg}`);
        }
    }

    static async publishCustomPost(message, imageUrl = null) {
        try {
            const url = imageUrl ? `${BASE_URL}/photos` : `${BASE_URL}/feed`;
            const payload = {
                message: message,
                access_token: PAGE_ACCESS_TOKEN
            };
            
            if (imageUrl) {
                payload.url = imageUrl;
            }

            const response = await axios.post(url, payload);
            logger.info(`[Publisher] Custom post published: ${response.data.id}`);
            return response.data.id;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[Publisher] Custom post error: ${errorMsg}`);
            throw error;
        }
    }
}

export default FacebookPublisher;
