# استخدام نسخة Node.js الرسمية
FROM node:20-slim

# تثبيت التبعيات اللازمة لـ node-canvas و Sharp
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات الحزم وتثبيتها
COPY package*.json ./
# تثبيت التبعيات مع تجاهل الـ devDependencies لتقليل الحجم
RUN npm install --production

# نسخ باقي ملفات المشروع
COPY . .

# إنشاء مجلد البيانات والتخزين الدائم
# Hugging Face Spaces تستخدم عادةً /data للتخزين الدائم إذا تم إعداد Persistent Storage
RUN mkdir -p /app/data/temp && chmod -R 777 /app/data

# تعيين المتغيرات البيئية الافتراضية
ENV DATA_DIR=/app/data
ENV PORT=7860
ENV NODE_ENV=production

# فتح المنفذ (Hugging Face يستخدم 7860 افتراضياً)
EXPOSE 7860

# تشغيل البوت
CMD ["npm", "start"]
