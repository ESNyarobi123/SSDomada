# ================================================================
# SSDomada — Multi-stage Docker build
# Optimized Next.js production image
# ================================================================

# ---------- Stage 1: Dependencies ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci && npm install sharp

# ---------- Stage 2: Builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 3: Runner (production) ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Reseller captive assets (POST …/captive-portal/asset) write under public/uploads/captive/{resellerId}/.
# COPY cannot create empty ignored paths reliably; mkdir as root then hand off ownership to nextjs.
RUN mkdir -p /app/public/uploads/captive \
    && chown -R nextjs:nodejs /app/public/uploads

# Copy sharp for image optimization
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Copy Prisma schema + migrations + CLI (for runtime migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy package.json so `prisma db seed` can locate the seed script config
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Modules + CLIs needed by prisma seed (not included in Next.js standalone output).
# `tsx` is not a project dependency, so install it instead of copying missing folders.
USER root
RUN npm install -g prisma@5.22.0 tsx@4
ENV PATH="/app/node_modules/.bin:/usr/local/bin:${PATH}"

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
