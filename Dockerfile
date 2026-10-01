# Build stage - using official Bun image
# See all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Vite embeds this public URL at build time. Private backend credentials stay
# in Convex deployment variables, outside the frontend image.
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

# Build the application
RUN test -n "$VITE_CONVEX_URL" && bun run build

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 3000 (Coolify default)
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
