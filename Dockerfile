# Use the official Playwright image which includes browser dependencies
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Install build tools for native modules like better-sqlite3
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./

# Remove lock files to avoid conflicts, use npm for standard build
RUN rm -f pnpm-lock.yaml package-lock.json

# Install dependencies
# We use --unsafe-perm to allow postinstall scripts for native modules
RUN npm install --unsafe-perm

# Install Playwright browsers explicitly to be sure
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
