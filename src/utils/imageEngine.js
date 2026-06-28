import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import arabicReshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '../../assets/templates');
const FONT_PATH = path.join(__dirname, '../../assets/fonts/NotoSansArabic.ttf');

const bidi = bidiFactory();

// تسجيل الخط العربي
try {
    registerFont(FONT_PATH, { family: 'NotoSansArabic' });
} catch (e) {
    console.error("Could not register font:", e.message);
}

function formatArabic(text) {
    const reshapeFunc = arabicReshaper.reshape || (arabicReshaper.default && arabicReshaper.default.reshape);
    const reshaped = reshapeFunc ? reshapeFunc(text) : text;
    // bidi-js returns a display string directly from the factory object in some versions
    return bidi.getDisplay ? bidi.getDisplay(reshaped) : reshaped.split('').reverse().join('');
}

export class ImageEngine {
    static async createProfileCard(userData) {
        const template = await loadImage(path.join(TEMPLATE_DIR, 'base_profile.png'));
        const canvas = createCanvas(template.width, template.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(template, 0, 0);

        ctx.fillStyle = '#bf00ff';
        ctx.font = 'bold 36px NotoSansArabic';
        ctx.fillText(userData.name || 'Unknown User', 280, 85);

        ctx.fillStyle = '#ffffff';
        ctx.font = '24px NotoSansArabic';
        
        ctx.fillText(formatArabic(`المستوى: ${userData.level || 1}`), 280, 150);
        ctx.fillText(formatArabic(`النقاط: ${userData.points || 0}`), 280, 200);
        ctx.fillText(formatArabic(`اللقب: ${userData.rank || 'Otaku'}`), 280, 250);

        if (userData.avatarUrl) {
            try {
                const avatar = await loadImage(userData.avatarUrl);
                ctx.save();
                ctx.beginPath();
                ctx.arc(140, 180, 100, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 40, 80, 200, 200);
                ctx.restore();
            } catch (e) {
                console.error("Failed to load avatar:", e.message);
            }
        }

        return canvas.toBuffer('image/png');
    }

    static async createRewardNotice(points, username) {
        const template = await loadImage(path.join(TEMPLATE_DIR, 'base_reward.png'));
        const canvas = createCanvas(template.width, template.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(template, 0, 0);

        ctx.fillStyle = '#bf00ff';
        ctx.font = 'bold 45px NotoSansArabic';
        ctx.fillText(`+${points} XP`, 160, 95);

        ctx.fillStyle = '#ffffff';
        ctx.font = '22px NotoSansArabic';
        ctx.fillText(formatArabic(`تهانينا ${username}!`), 160, 145);

        return canvas.toBuffer('image/png');
    }
}
