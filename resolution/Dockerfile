# Resolution Agent
# AI-powered market resolution using xAI Grok + X API

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY resolution/package.json ./resolution/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sigarena/resolution --filter @sigarena/common

# Copy source
COPY common/ ./common/
COPY resolution/ ./resolution/

# Build common first, then resolution
RUN pnpm --filter @sigarena/common build && pnpm --filter @sigarena/resolution build

# Runtime
FROM node:22-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/common ./common
COPY --from=base /app/resolution ./resolution
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production
ENV RESOLUTION_API_PORT=3200

EXPOSE 3200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3200/health').then(r => process.exit(r.ok ? 0 : 1))"

# Required environment variables (set via docker-compose or -e)
# XAI_API_KEY - xAI API key
# X_BEARER_TOKEN - X API bearer token
# AGENT_TOKEN - Registry agent token
# REGISTRY_URL - Registry API URL (default: http://registry:3100)

CMD ["pnpm", "--filter", "@sigarena/resolution", "resolve"]
