# Plain Node base image — we install Playwright's browsers ourselves below,
# matched exactly to whatever playwright version package.json/pnpm-lock.yaml
# resolve to at build time. This avoids the previous bug where the base image
# shipped Playwright v1.42.1 browsers while package.json required v1.61.1 —
# a version mismatch that makes every browser.launch() call fail at runtime.
FROM node:22-bookworm-slim

# Set working directory
WORKDIR /app

# System deps needed to install/run Playwright's Chromium, plus python3 in
# case any legacy python_engine scripts are still invoked manually.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates fonts-liberation \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install Node dependencies
RUN pnpm install --frozen-lockfile

# Install the Chromium build that matches the exact `playwright` version just
# installed above, plus its OS-level dependencies. This is the step that
# guarantees the browser and the library are always in sync, regardless of
# which playwright version package.json ends up pinning in the future.
RUN pnpm exec playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]
