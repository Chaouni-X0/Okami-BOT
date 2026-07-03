# Stage 1: Build
FROM node:22-bullseye AS builder

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
COPY python_engine/requirements.txt ./python_engine/requirements.txt
RUN pip3 install --no-cache-dir -r python_engine/requirements.txt

# Copy source
COPY . .
RUN chmod +x python_engine/bridge.py

# Stage 2: Runtime
FROM node:22-bullseye

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all from builder
COPY --from=builder /app /app
# Copy python packages (bullseye uses python 3.9)
COPY --from=builder /usr/local/lib/python3.9/dist-packages /usr/local/lib/python3.9/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_PATH=python3

# Ensure directories exist
RUN mkdir -p data/temp logs

EXPOSE 8080
CMD ["npm", "start"]
