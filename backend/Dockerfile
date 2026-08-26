FROM node:22-bookworm-slim

WORKDIR /app

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
