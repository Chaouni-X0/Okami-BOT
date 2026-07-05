# Use the official Playwright image
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Install essential build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# IMPORTANT: Enable C++20 for node-gyp to build better-sqlite3 on Node 24+
ENV CXXFLAGS="-std=c++20"

# Copy package files
COPY package.json ./

# Remove existing lock files to ensure a clean install with npm
RUN rm -f pnpm-lock.yaml package-lock.json

# Install dependencies
RUN npm install

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy the rest of the application
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start command
CMD ["node", "src/index.js"]
