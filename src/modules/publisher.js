
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
    
    /**
     * Sends a direct message to a user.
     * Uses the centralized sendMessage service logic.
     */
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

    /**
     * Publishes a chapter with multiple images.
     */
    static async publishChapter(imagePaths, message) {
        try {
            const photoIds = [];
            for (const imgPath of imagePaths) {
                const photoId = await this.uploadPhoto(imgPath);
                photoIds.push({ media_fbid: photoId });
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
            throw error;
        }
    }

    /**
     * Uploads a photo to Facebook as unpublished.
     */
    static async uploadPhoto(filePath) {
        const url = `${BASE_URL}/photos`;
        const form = new FormData();
        form.append('source', fs.createReadStream(filePath));
        form.append('published', 'false');
        form.append('access_token', PAGE_ACCESS_TOKEN);

        try {
            const response = await axios.post(url, form, {
                headers: { ...form.getHeaders() }
            });
            return response.data.id;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[Publisher] Photo upload error: ${errorMsg}`);
            throw error;
        }
    }

    /**
     * Publishes an aggregation post.
     */
    static async publishAggregation(mangaData, chapters) {
        let message = `🐺 المنشور التجميعي لمانهوا: ${mangaData.title}\n\n`;
        
        chapters.forEach(c => {
            message += `${mangaData.title} - الفصل ${c.chapter_number}\n`;
            message += `https://facebook.com/${c.fb_post_id}\n\n`;
        });

        message += `#OkamiBot #Manga #Aggregation`;

        const url = `${BASE_URL}/feed`;
        const payload = {
            message: message,
            access_token: PAGE_ACCESS_TOKEN
        };

        try {
            const response = await axios.post(url, payload);
            logger.info(`[Publisher] Aggregation post published: ${response.data.id}`);
            return response.data.id;
        } catch (error) {
            const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[Publisher] Aggregation error: ${errorMsg}`);
            throw error;
        }
    }
}
