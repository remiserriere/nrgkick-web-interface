# NRGKick Web Interface
# 
# Build:
#   docker build -t nrgkick-web .
#
# Run:
#   docker run -p 3000:3000 -e NRGKICK_IP=192.168.1.100 nrgkick-web
#
# With authentication:
#   docker run -p 3000:3000 \
#     -e NRGKICK_IP=192.168.1.100 \
#     -e NRGKICK_USER=admin \
#     -e NRGKICK_PASS=secret \
#     nrgkick-web

FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (none currently, but prepared for future)
RUN npm install --production 2>/dev/null || true

# Copy application files
COPY server.js ./
COPY app.js ./
COPY index.html ./
COPY styles.css ./

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000

# Health check using Node.js (no need for curl/wget)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run the server
CMD ["node", "server.js"]
