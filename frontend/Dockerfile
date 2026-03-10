# Frontend
# Next.js web app for SIG Arena

FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (generate lockfile if not present)
RUN pnpm install

# Builder stage
FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for API URLs
ARG NEXT_PUBLIC_REGISTRY_URL=http://localhost:3100
ARG NEXT_PUBLIC_TRADING_URL=http://localhost:3300
ENV NEXT_PUBLIC_REGISTRY_URL=$NEXT_PUBLIC_REGISTRY_URL
ENV NEXT_PUBLIC_TRADING_URL=$NEXT_PUBLIC_TRADING_URL

# Build
RUN pnpm build

# Runtime - use standalone output
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "server.js"]
