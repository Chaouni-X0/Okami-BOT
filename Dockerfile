# Use Playwright official image with matching version
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Install a specific version of pnpm to ensure stability
RUN npm install -g pnpm@9.15.4

# Copy package files and .npmrc
COPY package.json pnpm-lock.yaml* .npmrc ./

# Install Node dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=0 

# Expose port
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]
