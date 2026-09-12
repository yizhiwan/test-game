# Multi-stage build producing a small runtime image from Next.js's
# "standalone" output (see next.config.ts) — the final stage carries only
# the traced dependency subset, not the full node_modules tree.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No API key at build time: the build only needs to type-check and bundle,
# never call the model. hasApiKey() in lib/models.ts is checked at request
# time, not build time.
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Cloud Run injects PORT (defaults to 8080) and expects the container to
# listen on it; the Next.js standalone server already reads process.env.PORT.
EXPOSE 8080
CMD ["node", "server.js"]
