# Multi-stage Dockerfile for Finora XAU/USD Trading AI
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

WORKDIR /usr/share/nginx/html

# Clean default static assets
RUN rm -rf ./*

# Copy built web app from builder stage
COPY --from=builder /app/dist ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
