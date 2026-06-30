# 🐺 دليل تثبيت وتشغيل بوت Okami المحسّن

## 📋 المتطلبات

- Node.js 18+ و npm
- Python 3.8+ (لتشغيل لوحة التحكم)
- MongoDB (اختياري - للبيانات السحابية)
- حساب Facebook Developer

---

## 🚀 خطوات التثبيت

### 1. استنساخ المستودع

```bash
git clone https://github.com/Chaouni-X0/Okami-BOT.git
cd Okami-BOT
```

### 2. تثبيت التبعيات (Node.js)

```bash
npm install
```

### 3. تثبيت التبعيات (Python - لوحة التحكم)

```bash
pip install streamlit pandas plotly
```

### 4. إنشاء ملف `.env`

```bash
cp .env.example .env
```

### 5. تعديل ملف `.env`

```env
# ===== Facebook API =====
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token
FACEBOOK_VERIFY_TOKEN=your_facebook_verify_token
FACEBOOK_PAGE_ID=your_facebook_page_id

# ===== المصادقة =====
ADMIN_PASSWORD=your_secure_password
ADMIN_ACTIVATION_KEY=your_activation_key

# ===== قاعدة البيانات =====
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/okami
SQLITE_PATH=./src/database/okami.db

# ===== البيئة =====
NODE_ENV=production
PORT=7860
LOG_LEVEL=info
```

---

## 🎯 تشغيل البوت

### تشغيل البوت الرئيسي

```bash
npm start
```

سيبدأ البوت على المنفذ `7860` بشكل افتراضي.

### تشغيل لوحة التحكم

في نافذة طرفية جديدة:

```bash
streamlit run dashboard.py
```

ستفتح لوحة التحكم على `http://localhost:8501`

---

## 📊 واجهة التحكم (Dashboard)

### الميزات الرئيسية

#### 1. **لوحة المعلومات** 📊
- عرض إحصائيات الطابور في الوقت الفعلي
- رسوم بيانية توضيحية
- آخر العناصر في الطابور

#### 2. **إدارة الطابور** 📋
- عرض جميع عناصر الطابور
- إعادة محاولة الفصول الفاشلة
- مسح الفصول الفاشلة

#### 3. **إدارة المانهوا** 📚
- عرض قائمة المانهوا
- حذف المانهوا
- عرض تفاصيل كل مانهوا

#### 4. **الإعدادات** ⚙️
- معلومات النظام
- تنظيف الملفات المؤقتة
- عرض السجلات

---

## 🔐 الأمان

### كلمة مرور لوحة التحكم

عند فتح لوحة التحكم، ستُطلب منك كلمة مرور. استخدم القيمة المحددة في ملف `.env`:

```
ADMIN_PASSWORD=your_secure_password
```

### المتغيرات البيئية الحساسة

**لا تشارك أبداً:**
- `FACEBOOK_ACCESS_TOKEN`
- `ADMIN_PASSWORD`
- `MONGODB_URI`

---

## 🐛 استكشاف الأخطاء

### المشكلة: البوت لا يستجيب

**الحل:**
1. تحقق من أن `FACEBOOK_ACCESS_TOKEN` صحيح
2. تأكد من أن المنفذ `7860` متاح
3. عرّف السجلات: `tail -f src/logs/combined.log`

### المشكلة: قاعدة البيانات فارغة

**الحل:**
1. تأكد من أن `SQLITE_PATH` صحيح
2. قم بحذف ملف قاعدة البيانات وأعد التشغيل

### المشكلة: لوحة التحكم لا تفتح

**الحل:**
```bash
streamlit run dashboard.py --logger.level=debug
```

---

## 📱 استخدام البوت

### أوامر المستخدم العادي

```
مرحبا - البدء
ملفي - عرض الملف الشخصي
مانهوا - عرض المانهوا المتاحة
إحصائيات - عرض الإحصائيات
```

### أوامر المطور

```
مرحبا - البدء
(أدخل كلمة السر)
/مواقع - عرض المواقع المدعومة
/إحصائيات - عرض إحصائيات الطابور
/حالة - عرض حالة النظام
/مساعدة - عرض الأوامر
```

---

## 🔄 نظام قاعدة البيانات المزدوجة

### SQLite (المحلي)
- **الاستخدام:** تخزين الطابور والفصول والعمليات المؤقتة
- **الميزة:** سريع وموثوق محلياً
- **الملف:** `./src/database/okami.db`

### MongoDB (السحابي)
- **الاستخدام:** تخزين بيانات المستخدمين والمانهوا الدائمة
- **الميزة:** نسخ احتياطي تلقائي وسهولة المزامنة
- **الاتصال:** عبر `MONGODB_URI`

---

## 📈 المراقبة والسجلات

### عرض السجلات

```bash
# آخر 50 سطر
tail -50 src/logs/combined.log

# مراقبة مستمرة
tail -f src/logs/combined.log

# أخطاء فقط
tail -50 src/logs/error.log
```

### مستويات السجلات

- `error` - أخطاء حرجة
- `warn` - تحذيرات
- `info` - معلومات عامة
- `debug` - معلومات تفصيلية

---

## 🚀 النشر على Hugging Face Spaces

### 1. إنشاء Space جديد

- اذهب إلى [Hugging Face Spaces](https://huggingface.co/spaces)
- انقر على "Create new Space"
- اختر "Docker" كنوع الـ Space

### 2. رفع الملفات

```bash
git push huggingface main
```

### 3. إضافة الأسرار

في إعدادات Space، أضف:
- `FACEBOOK_ACCESS_TOKEN`
- `FACEBOOK_VERIFY_TOKEN`
- `ADMIN_PASSWORD`
- `MONGODB_URI`

---

## 📞 الدعم والمساعدة

إذا واجهت مشاكل:

1. تحقق من السجلات
2. راجع قسم استكشاف الأخطاء
3. افتح issue على GitHub

---

## 📝 الملاحظات الهامة

- **النسخة الحالية:** 5.0.0
- **آخر تحديث:** 2026-06-30
- **الحالة:** مستقرة وجاهزة للإنتاج

---

**🐺 شكراً لاستخدام Okami Bot!**
