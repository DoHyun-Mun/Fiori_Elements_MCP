# ══════════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile for SAP CAP Inventory Management System
# ══════════════════════════════════════════════════════════════════════

# Stage 1: Build
FROM node:22-alpine AS builder

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for cds build)
RUN npm ci

# Copy application source
COPY . .

# Run cds build to compile models (generates gen/ folder with draft tables, CSV data, etc.)
RUN npx cds build --production

# Stage 2: Production
FROM node:22-alpine AS production

# Add labels
LABEL maintainer="SAP CAP Inventory System"
LABEL description="상품 재고 관리 시스템 - SAP CAP + Fiori Elements"

# Install build tools for native modules (better-sqlite3 needs them at runtime on Alpine)
RUN apk add --no-cache python3 make g++

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    apk del python3 make g++

# Copy built artifacts from builder stage
COPY --from=builder --chown=appuser:appgroup /app/gen ./gen
COPY --from=builder --chown=appuser:appgroup /app/app ./app
COPY --from=builder --chown=appuser:appgroup /app/srv ./srv
COPY --from=builder --chown=appuser:appgroup /app/db ./db
COPY --from=builder --chown=appuser:appgroup /app/.cdsrc.json ./.cdsrc.json
COPY --from=builder --chown=appuser:appgroup /app/server.js ./server.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4004
ENV CDS_ENV=development

# Expose port
EXPOSE 4004

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4004/ || exit 1

# Start the CAP server
CMD ["npx", "cds-serve"]