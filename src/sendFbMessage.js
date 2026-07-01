const axios = require('axios');

/**
 * sendFbMessage(recipientId, messageObj)
 * messageObj: { text: '...' } أو البنية التي تستخدمها حالياً في البوت
 */
async function sendFbMessage(recipientId, messageObj) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) throw new Error('FB_ACCESS_TOKEN غير معرف في المتغيرات البيئية');

  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(token)}`;
  const payload = {
    recipient: { id: recipientId },
    message: messageObj
  };

  try {
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return res.data;
  } catch (err) {
    console.error('فشل إرسال رسالة إلى Facebook:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendFbMessage };