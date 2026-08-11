FROM node:20-alpine

WORKDIR /app

# Install build dependencies if native module build is required
RUN apk add --no-cache python3 make g++

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# Expose backend API port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start backend server
CMD ["node", "server.js"]
