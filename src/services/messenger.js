import axios from 'axios';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';

const PAGE_ACCESS_TOKEN = config.facebook.accessToken;
const BASE_URL = `https://graph.facebook.com/v18.0`;

// Circuit Breaker
let failureCount = 0;
let lastFailureTime = 0;
let circuitOpen = false;

const MAX_FAILURES = 3;
const RESET_TIME = 10000; // 10s

function canSend() {
    if (!circuitOpen) return true;

    if (Date.now() - lastFailureTime > RESET_TIME) {
        logger.warn("Circuit HALF-OPEN → retrying...");
        circuitOpen = false;
        failureCount = 0;
        return true;
    }

    return false;
}

// Sleep helper
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export async function sendMessage(psid, messagePayload) {
    if (!PAGE_ACCESS_TOKEN) {
        logger.error("PAGE_ACCESS_TOKEN missing");
        return;
    }

    if (!canSend()) {
        logger.warn(`Circuit OPEN → skip sending to ${psid}`);
        return;
    }

    const url = `${BASE_URL}/me/messages`;

    const payload = {
        recipient: { id: psid },
        message: typeof messagePayload === 'string'
            ? { text: messagePayload }
            : messagePayload
    };

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info(`send_attempt | user:${psid} | attempt:${attempt}`);

            const start = Date.now();

            const res = await axios.post(url, payload, {
                params: { access_token: PAGE_ACCESS_TOKEN },

                // 🔥 أهم إصلاح
                timeout: 10000,

                // ❌ بدون keepAlive
                httpAgent: false,
                httpsAgent: false,

                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const duration = Date.now() - start;

            logger.info(`send_success | user:${psid} | ${duration}ms`);

            // reset failures
            failureCount = 0;
            circuitOpen = false;

            return res.data;

        } catch (err) {
            failureCount++;
            lastFailureTime = Date.now();

            logger.error(`send_failure | user:${psid} | attempt:${attempt} | ${err.message}`);

            // 🔥 إذا وصلنا الحد → نحبسو مؤقتا
            if (failureCount >= MAX_FAILURES) {
                circuitOpen = true;
                logger.error("Circuit BREAKER OPEN");
            }

            // آخر محاولة → نوقف
            if (attempt === MAX_RETRIES) {
                throw new Error("Message failed after retries");
            }

            // retry سريع (backoff)
            await sleep(attempt * 1000);
        }
    }
}