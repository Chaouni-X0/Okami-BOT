# Use Playwright official image which is based on Node.js
# This image includes all necessary system dependencies for Playwright
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Ensure Node.js version is 22 (Playwright image usually follows Node LTS/Current)
# The v1.61.1-jammy image currently uses Node 20 or 22.
RUN node -v

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy package files and configuration
COPY package.json pnpm-lock.yaml* .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=0

# Expose port
EXPOSE 8080

# Start command
CMD ["pnpm", "start"]
