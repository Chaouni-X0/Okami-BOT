# Use Playwright official image with matching version
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Set working directory
WORKDIR /app

# Explicitly install pnpm v9 to avoid v10's strict build blocking
RUN npm install -g pnpm@9.15.4

# Copy package files AND .npmrc first for caching
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
