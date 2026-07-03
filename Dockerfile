FROM node:22-bullseye

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
COPY python_engine/requirements.txt ./python_engine/requirements.txt
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r python_engine/requirements.txt

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
