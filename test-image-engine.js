import { ImageEngine } from './src/utils/imageEngine.js';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("🚀 Testing Node.js Image Engine...");

    const userData = {
        name: "Chaouni-X0",
        level: 25,
        points: 15400,
        rank: "Okami King 🐺",
        // سنستخدم صورة عشوائية للاختبار
        avatarUrl: "https://github.com/Chaouni-X0.png"
    };

    try {
        // 1. تجربة بطاقة الملف الشخصي
        console.log("Creating Profile Card...");
        const profileBuffer = await ImageEngine.createProfileCard(userData);
        fs.writeFileSync('test_profile_node.png', profileBuffer);
        console.log("✅ Profile Card saved to test_profile_node.png");

        // 2. تجربة إشعار المكافأة
        console.log("Creating Reward Notice...");
        const rewardBuffer = await ImageEngine.createRewardNotice(500, "Chaouni-X0");
        fs.writeFileSync('test_reward_node.png', rewardBuffer);
        console.log("✅ Reward Notice saved to test_reward_node.png");

    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

test();