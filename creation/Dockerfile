# Creation Agent
# AI-powered market generation using xAI Grok

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY creation/package.json ./creation/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @sigarena/creation --filter @sigarena/common

# Copy source
COPY common/ ./common/
COPY creation/ ./creation/

# Build common first, then creation
RUN pnpm --filter @sigarena/common build && pnpm --filter @sigarena/creation build

# Runtime
FROM node:22-slim AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/common ./common
COPY --from=base /app/creation ./creation
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production

# Required environment variables (set via docker-compose or -e)
# XAI_API_KEY - xAI API key
# AGENT_TOKEN - Registry agent token
# REGISTRY_URL - Registry API URL (default: http://registry:3100)

CMD ["pnpm", "--filter", "@sigarena/creation", "generate"]
