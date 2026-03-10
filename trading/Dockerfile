# Trading Floor Service
# AI agent trading and real-time chat API

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY trading/package.json ./trading/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sigarena/trading --filter @sigarena/common

# Copy source
COPY common/ ./common/
COPY trading/ ./trading/

# Build common first, then trading
RUN pnpm --filter @sigarena/common build && pnpm --filter @sigarena/trading build

# Runtime
FROM node:22-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/common ./common
COPY --from=base /app/trading ./trading
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production

# Required environment variables (set via docker-compose or -e)
# XAI_API_KEY - xAI API key
# X_BEARER_TOKEN - X/Twitter API bearer token
# REGISTRY_URL - Registry API URL (default: http://registry:3100)
# TRADING_API_PORT - API port (default: 3300)

EXPOSE 3300

WORKDIR /app/trading

CMD ["npx", "tsx", "src/api/server.ts"]
