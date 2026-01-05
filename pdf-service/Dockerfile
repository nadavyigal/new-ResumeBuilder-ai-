# ==============================================
# Stage 1: Builder (dependencies)
# ==============================================
FROM node:20-bookworm AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies only (excludes devDependencies)
RUN npm ci --only=production --ignore-scripts

# ==============================================
# Stage 2: Production (runtime)
# ==============================================
FROM node:20-bookworm

# Install Chromium and system dependencies
RUN apt-get update && apt-get install -y \
    # Chromium browser
    chromium \
    chromium-sandbox \
    \
    # Professional font packages
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    fonts-noto-core \
    fonts-noto-ui-core \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    \
    # Chromium runtime dependencies
    ca-certificates \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    \
    # Cleanup to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security best practices
RUN groupadd -r pdfuser && useradd -r -g pdfuser -G audio,video pdfuser \
    && mkdir -p /home/pdfuser/Downloads /home/pdfuser/.cache \
    && chown -R pdfuser:pdfuser /home/pdfuser

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=pdfuser:pdfuser /app/node_modules ./node_modules

# Copy application code
COPY --chown=pdfuser:pdfuser . .

# Switch to non-root user (security hardening)
USER pdfuser

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3001

# Expose service port
EXPOSE 3001

# Health check (Docker monitors container health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start Express server
CMD ["node", "server.js"]
