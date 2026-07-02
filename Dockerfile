# Use Node.js 22 as the base image
FROM node:22-slim

# Install Python and other necessary tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy python requirements and install them
COPY python_engine/requirements.txt ./python_engine/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r python_engine/requirements.txt

# Copy the rest of the application
COPY . .

# Ensure data directories exist
RUN mkdir -p data/temp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV PYTHON_PATH=python3

# Expose the port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
