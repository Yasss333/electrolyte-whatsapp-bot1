FROM node:22-bookworm

# Install Chromium and required libraries
RUN apt-get update && apt-get install -y \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libx11-6 \
    fonts-liberation \
    ca-certificates \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application
COPY . .

# Create runtime folders
RUN mkdir -p db session generated-images

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

EXPOSE 5000
# Inside Dockerfile – remove lock files before starting the app
RUN echo "rm -rf /app/data/session/Singleton* || true" > /usr/local/bin/clean-locks.sh && chmod +x /usr/local/bin/clean-locks.sh

CMD ["sh", "-c", "/usr/local/bin/clean-locks.sh && node src/index.js"]

CMD ["npm", "start"]