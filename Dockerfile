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
    && rm -rf /var/lib/apt/lists/*

# إنشاء مجلد العمل
WORKDIR /app

# نسخ ملفات الحزم وتثبيتها
COPY package*.json ./
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# إنشاء مجلد البيانات والتخزين الدائم
RUN mkdir -p /app/data/temp

# تعيين المتغيرات البيئية الافتراضية
ENV DATA_DIR=/app/data
ENV PORT=3000

# فتح المنفذ
EXPOSE 3000

# تشغيل البوت
CMD ["npm", "start"]
