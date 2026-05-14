# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the Vite frontend
COPY . .
# src/config.ts is gitignored — create a minimal one for the build
RUN if [ ! -f src/config.ts ]; then cp src/config.example.ts src/config.ts; fi
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install only production dependencies + tsx (needed to run TypeScript directly)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save tsx

# Copy built frontend and server source
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY xp-config.json ./

# The container serves both the API and the built frontend on a single port.
# State is persisted to /app/data — mount a volume there for persistence.
ENV PORT=3002
ENV SERVE_STATIC=1
ENV NODE_ENV=production

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

CMD ["npx", "tsx", "server/index.ts"]
