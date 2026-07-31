# Stage 1: Build Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite app
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend files
COPY bot.cjs ./
# If you have other backend files/folders, copy them here
# COPY server ./server 

# Create data directory for persistence
RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["node", "bot.cjs"]
