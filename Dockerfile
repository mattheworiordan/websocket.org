# Development Dockerfile (optional)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better performance
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Expose ports
EXPOSE 4321 4322

# Default command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]