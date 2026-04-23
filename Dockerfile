# Stage 1: Build client
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:22-alpine AS server-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx tsc

# Stage 3: Production runtime
FROM node:22-alpine
RUN apk add --no-cache python3 make g++ \
    && rm -rf /var/cache/apk/*
WORKDIR /app/server

# Install production dependencies (compiles better-sqlite3 for Linux)
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server build output
COPY --from=server-build /app/server/dist ./dist

# Copy client build output
COPY --from=client-build /app/client/dist ../client/dist

# Data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
