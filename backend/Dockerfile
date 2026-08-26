FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends fontconfig fonts-liberation fonts-dejavu fonts-noto-core \
	&& fc-cache -f \
	&& rm -rf /var/lib/apt/lists/*

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application
COPY . .

# Create runtime folders
RUN mkdir -p db generated-images data

# Set environment variables
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/index.js"]
