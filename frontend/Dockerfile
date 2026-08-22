FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Serve with a simple static server
RUN npm install -g serve
EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]