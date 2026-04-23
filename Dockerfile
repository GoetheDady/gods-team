# Stage 1: Build client
FROM node:22-alpine AS client-build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/ ./
RUN pnpm run build

# Stage 2: Build server
FROM node:22-alpine AS server-build
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY server/ ./
RUN npx tsc

# Stage 3: Production runtime
FROM node:22-alpine
RUN apk add --no-cache python3 make g++ \
    && rm -rf /var/cache/apk/*
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/server

# Install production dependencies (compiles better-sqlite3 for Linux)
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy server build output
COPY --from=server-build /app/server/dist ./dist

# Copy client build output
COPY --from=client-build /app/client/dist ../client/dist

# Data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
