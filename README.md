# 🐺 Okami Bot - Facebook Manga Automation

نظام ذكي ومتقدم لإدارة ونشر المانهوا/المانغا تلقائيًا على فيسبوك.

## 🚀 المميزات
- **Scraping Engine**: دعم تلقائي لمواقع المانهوا واستخراج الفصول.
- **Resource Management**: حذف صور الفصول فوراً بعد النشر والاحتفاظ بروابط المنشورات فقط لتوفير المساحة.
- **Viral Content Engine**: توليد ونشر تلقائي لقوائم المتصدرين (Leaderboards) وإحصائيات المجتمع اليومية.
- **Guild System (القبائل)**: نظام تنافس جماعي بين فرق (مثل Team Shadow vs Team Dragon).
- **Dynamic Events**: فعاليات زمنية مثل "Double Points Weekend" تضاعف مكافآت الجميع.
- **Auto Poll System**: نظام تصويت آلي يشرك الجمهور في اختيار الأعمال القادمة.
- **Bot Personality**: نظام ردود ذكي يمنح البوت شخصية فريدة (Humor + Identity).
- **Advanced Streak Engine**: تتبع الالتزام بالقراءة والتفاعل مع مكافآت تصاعدية (يوم 3، 7، 30).
- **Continue Reading**: ميزة ذكية تسمح للمستخدم بالعودة لآخر فصل قرأه بضغطة زر.
- **Dynamic Visuals**: توليد تلقائي لصور إحصائيات وبطاقات مستخدم احترافية.

## 🏰 نظام القبائل (Guilds)
يمكن للمستخدمين الانضمام لقبائل للتنافس الجماعي:
- نقاط كل فرد تضاف لمجموع نقاط القبيلة.
- مكافآت أسبوعية لأعضاء القبيلة المتصدرة.

## 🛠️ لوحة تحكم المطور الاحترافية (Pro Admin Panel)
يمكنك إرسال هذه الأوامر المتقدمة عبر `POST /admin/dev-command`:

### 🏰 إدارة القبائل (Guild Admin)
- `CREATE_GUILD`: إنشاء قبيلة جديدة.
- `REWARD_GUILD`: توزيع نقاط لجميع أعضاء قبيلة معينة (مكافأة فوز).
- `SET_GUILD_LEVEL`: تعديل نقاط أو مستوى قبيلة يدوياً.

### ⚡ إدارة الفعاليات (Event Control)
- `START_EVENT`: بدء فعالية فورية.
- `SCHEDULE_EVENT`: جدولة فعالية مستقبلية (تاريخ البدء والانتهاء).
- `CANCEL_EVENT`: إلغاء فعالية نشطة أو مجدولة.
- `ADJUST_POINTS_MULTIPLIER`: تغيير مضاعف النقاط (مثلاً x3 أو x5) خلال الفعالية.

### ⚖️ إدارة المجتمع والعقوبات (Moderation)
- `WARN_USER`: إرسال تحذير لمستخدم (حظر تلقائي عند الوصول لـ 3 تحذيرات).
- `BAN_USER`: حظر مستخدم نهائياً وحذف بياناته فوراً.
- `GIVE_POINTS`: توزيع نقاط (هدية) لمستخدم أو للجميع.
- `PUBLISH_LEADERBOARD`: نشر قائمة المتصدرين الحالية.
- `DELETE_MANGA`: حذف عمل وفصوله من النظام.

## 🎨 المحرك البصري (Visual Engine)
البوت يقوم بتوليد صور ديناميكية لكل مستخدم تشمل:
- **Profile Card**: بطاقة هوية تحتوي على الرتبة، المستوى، الـ Streak، والنقاط.
- **Mission Card**: بطاقة تعرض المهام اليومية المطلوبة بشكل جذاب.

## 👥 واجهة المستخدم المتقدمة (User API)
- `GET /user/profile/:fbId`: الحصول على بطاقة المستخدم وصورته الشخصية.
- `GET /user/missions/:fbId`: عرض المهام اليومية الحالية مع صورة مصممة.
- `POST /user/read`: تسجيل قراءة فصل لتحديث الـ Streak والتقدم.
- `GET /user/continue/:fbId`: الحصول على قائمة "أكمل القراءة".
- `POST /user/daily-checkin`: تسجيل الحضور اليومي.

## 🛠️ أوامر المطور المتقدمة (Pro Dev Commands)
عبر `POST /admin/dev-command`:
- `GET_STATS`: إحصائيات شاملة (أعمال، فصول، متابعين، مستخدمين).
- `GIVE_POINTS`: توزيع نقاط لمستخدم معين أو لجميع المستخدمين (هدايا).
- `ADD_MISSION`: إضافة مهمة جديدة للنظام (يومية/أسبوعية).
- `BROADCAST`: إرسال رسالة إشعار لجميع المتابعين.
- `DELETE_MANGA`: حذف عمل وفصوله بالكامل.

## 🎮 نظام التفاعل (Gamification)
- **الرتب (Ranks)**:
  - `Otaku Beginner` (Lvl 1-4)
  - `Shadow Reader` (Lvl 5-14)
  - `Manga Explorer` (Lvl 15-29)
  - `Okami Warrior` (Lvl 30-49)
  - `Okami King 🐺` (Lvl 50+)

## 👥 واجهة المستخدم (User API)
- `GET /user/profile/:fbId`: عرض الملف الشخصي (نقاط، مستوى، رتبة).
- `POST /user/daily-checkin`: تسجيل الدخول اليومي للحصول على الـ Streak.
- `POST /user/request`: طلب مانهوا جديدة.
- `POST /user/vote`: التصويت لطلب موجود لزيادة أولوية نشره.

## 👥 نظام المتابعة (User Follow)
يمكن للمستخدمين المتابعة عبر `POST /user/follow`:
- **Body**: `{ "userFbId": "ID", "mangaId": 1 }`
سيصل للمستخدم إشعار تلقائي فور نشر فصل جديد من العمل المختار.

## 🛠️ التشغيل
1. قم بتثبيت التبعيات:
   ```bash
   pnpm install
   ```
2. قم بضبط الإعدادات في ملف `.env`:
   - `FB_ACCESS_TOKEN`: توكن فيسبوك (Page Access Token).
   - `FB_PAGE_ID`: معرف الصفحة.

3. ابدأ تشغيل البوت:
   ```bash
   npm start
   ```

## 🎛️ واجهة الإدارة (Admin Mode)
لإضافة مانهوا جديدة للنشر، استخدم الـ API التالي:
- **Endpoint**: `POST /admin/add-manga`
- **Body**:
  ```json
  {
    "activationKey": "chaouni_x_2013-2",
    "url": "https://azoramoon.com/manga/title-here/"
  }
  ```

## 📁 هيكل المشروع
- `src/modules`: المحركات الأساسية (Scraper, Publisher, Processor, Queue).
- `src/services`: خدمات الإدارة والذاكرة.
- `src/database`: قاعدة بيانات SQLite لتخزين الحالات.
- `src/temp`: مجلد مؤقت لمعالجة الصور (يتم حذفه تلقائياً بعد النشر).

---
✨ تم التطوير بواسطة Manus ليكون الحل الأمثل للنشر التلقائي ✨
