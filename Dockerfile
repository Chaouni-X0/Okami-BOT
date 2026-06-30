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
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# تثبيت مكتبات بايثون للوحة التحكم
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install streamlit pandas plotly


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

# تشغيل البوت ولوحة التحكم معاً باستخدام سكربت بسيط
RUN echo '#!/bin/bash\nnpm start & streamlit run dashboard.py --server.port 8501 --server.address 0.0.0.0' > start.sh && chmod +x start.sh

# Hugging Face يعرض منفذ واحد فقط (7860)، لذا سنقوم بعمل Proxy بسيط أو نكتفي بتشغيل البوت
# ولكن بما أنك طلبت الواجهة، سنقوم بتشغيل البوت على الخلفية والواجهة على المنفذ الرئيسي
# ملاحظة: لكي تعمل الواجهة على Hugging Face، يجب أن تكون هي التي تستخدم المنفذ 7860
CMD ["sh", "-c", "npm start & streamlit run dashboard.py --server.port 7860 --server.address 0.0.0.0"]

