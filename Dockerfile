FROM node:22-bullseye

# Install Python and Playwright system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
COPY python_engine/requirements.txt ./python_engine/requirements.txt
RUN pip3 install --no-cache-dir -r python_engine/requirements.txt

# Install Playwright browsers (Chromium only for efficiency)
RUN python3 -m playwright install chromium
RUN python3 -m playwright install-deps chromium

# Copy source code
COPY . .

# Permissions and directories
RUN chmod +x python_engine/bridge.py
RUN mkdir -p data/temp logs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_PATH=python3

EXPOSE 8080

# Start application
CMD ["npm", "start"]
