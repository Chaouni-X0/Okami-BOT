# Multi-stage build for optimized image size
FROM node:22-slim AS builder

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --omit=dev

# Copy Python requirements
COPY python_engine/requirements.txt ./python_engine/requirements.txt

# Install Python dependencies with better error handling
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel && \
    pip3 install --no-cache-dir -r python_engine/requirements.txt

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p data/temp logs && \
    chmod +x python_engine/bridge.py

# Final stage
FROM node:22-slim

# Install Python runtime only (not build tools)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app
COPY --from=builder /usr/local/lib/python3.12/dist-packages /usr/local/lib/python3.12/dist-packages

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_PATH=python3
ENV DATA_DIR=./data
ENV NPM_CONFIG_LOGLEVEL=warn

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/status', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
