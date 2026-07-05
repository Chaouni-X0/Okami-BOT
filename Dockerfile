# Use the official Playwright image which has all dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Remove pnpm-lock if exists to avoid confusion, use npm for maximum compatibility on Railway
RUN rm -f pnpm-lock.yaml

# Install dependencies using npm (Standard and reliable)
# We use --unsafe-perm to allow postinstall scripts for root
RUN npm install

# Copy the rest of the application
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start command
CMD ["npm", "start"]
