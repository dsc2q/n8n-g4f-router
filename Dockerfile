# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json tsconfig.json ./

RUN npm install

# Copy source files
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine

WORKDIR /app

# Copy package manifest and install only production deps
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Expose the router port
EXPOSE 3000

# Healthcheck: ping the /health endpoint (no auth required)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Run the server
CMD ["node", "dist/server.js"]