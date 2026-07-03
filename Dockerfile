# Use a standard Node.js image with Python pre-installed
FROM node:22-bullseye

# Install Python, pip, and build essentials in one layer
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all files first to ensure everything is available
COPY . .

# Install Node dependencies
RUN npm install

# Install Python dependencies
# We use --break-system-packages if needed, or standard pip install
RUN pip3 install --no-cache-dir -r python_engine/requirements.txt

# Create necessary directories and set permissions
RUN mkdir -p data/temp logs && \
    chmod +x python_engine/bridge.py

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_PATH=python3

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
