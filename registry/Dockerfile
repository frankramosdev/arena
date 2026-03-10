# Registry API Server
# Polymarket-style prediction market with CLOB

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY registry/package.json ./registry/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sig-arena/registry --filter @sigarena/common

# Copy source
COPY common/ ./common/
COPY registry/ ./registry/

# Build
RUN pnpm --filter @sig-arena/registry build

# Runtime
FROM node:22-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/common ./common
COPY --from=base /app/registry ./registry
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3100/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["pnpm", "--filter", "@sig-arena/registry", "start"]
