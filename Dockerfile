# Use a slim Python base image
FROM python:3.10-slim-bullseye

# Avoid stuck builds or interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Set the working directory to /app
WORKDIR /app

# Install system dependencies (curl and git are required)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js LTS securely via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first to optimize Docker cache layers
COPY package.json package-lock.json* ./

# Install production Node.js dependencies
RUN npm install --production

# Copy requirements.txt first for Streamlit Python dependencies
COPY requirements.txt* ./

# Install Streamlit & requests for the dashboard
RUN pip install --no-cache-dir streamlit requests

# Copy the rest of your application code
COPY . .

# Generate the startup script dynamically inside the container
# This completely bypasses cache misses, permissions, or Windows CRLF line ending issues!
RUN echo '#!/bin/bash' > start.sh && \
    echo 'echo "=== Starting Okami Bot Services ==="' >> start.sh && \
    echo 'echo "Starting Streamlit UI internally on port 8501..."' >> start.sh && \
    echo 'streamlit run app.py --server.port 8501 --server.address 127.0.0.1 --server.headless true --browser.gatherUsageStats false --server.maxUploadSize 1 &' >> start.sh && \
    echo 'echo "Starting Unified Node.js Webhook on Hugging Face port 7860..."' >> start.sh && \
    echo 'NODE_ENV=production node --max-old-space-size=512 src/index.enhanced.js' >> start.sh && \
    chmod +x start.sh

# Expose port 7860 (Default ingress port for Hugging Face Spaces)
EXPOSE 7860

# Run the unified startup script
CMD ["./start.sh"]