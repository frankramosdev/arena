# Personality Creator Dockerfile
# Multi-stage build for minimal production image

FROM node:22-alpine AS base
RUN npm install -g pnpm

# =============================================================================
# Dependencies
# =============================================================================
FROM base AS deps
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY common/package.json ./common/
COPY personality-creator/package.json ./personality-creator/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# =============================================================================
# Builder
# =============================================================================
FROM base AS builder
WORKDIR /app

# Copy deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/common/node_modules ./common/node_modules
COPY --from=deps /app/personality-creator/node_modules ./personality-creator/node_modules

# Copy source
COPY pnpm-workspace.yaml package.json ./
COPY common ./common
COPY personality-creator ./personality-creator

# Build common first, then personality-creator
WORKDIR /app/common
RUN pnpm build

WORKDIR /app/personality-creator
RUN pnpm build

# =============================================================================
# Runner
# =============================================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config (required for pnpm symlinks)
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

# Copy built packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/common/dist ./common/dist
COPY --from=builder /app/common/package.json ./common/
COPY --from=builder /app/common/node_modules ./common/node_modules
COPY --from=builder /app/personality-creator/dist ./personality-creator/dist
COPY --from=builder /app/personality-creator/package.json ./personality-creator/
COPY --from=builder /app/personality-creator/node_modules ./personality-creator/node_modules

WORKDIR /app/personality-creator

EXPOSE 3400

CMD ["node", "dist/api/server.js"]
