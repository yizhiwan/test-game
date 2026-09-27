# Single container: the Node server hosts Socket.IO and serves the built
# client from dist/client. Cloud Run supports WebSockets; set session
# affinity and a single max instance until rooms are shared across instances.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server/index.js"]
