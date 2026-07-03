FROM node:22-bullseye

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node modules
COPY package*.json ./
RUN npm install --production

# Install Python modules
COPY python_engine/requirements.txt ./python_engine/requirements.txt
RUN pip3 install --no-cache-dir -r python_engine/requirements.txt

# Copy source
COPY . .
RUN chmod +x python_engine/bridge.py
RUN mkdir -p data/temp logs

# Railway uses PORT env var
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
