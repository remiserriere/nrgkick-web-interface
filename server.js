/**
 * NRGKick Web Interface Server
 * 
 * This server provides a complete web interface for NRGKick EV chargers:
 * 1. Serves the static web files (UI)
 * 2. Proxies API requests to the configured NRGKick device
 * 3. Provides configuration via /api/config endpoint
 * 
 * Environment variables:
 *   PORT          - Server port (default: 3000)
 *   NRGKICK_IP    - IP address of the NRGKick charger (required)
 *   NRGKICK_USER  - Username for authentication (optional)
 *   NRGKICK_PASS  - Password for authentication (optional)
 * 
 * Example:
 *   NRGKICK_IP=192.168.1.100 node server.js
 *   NRGKICK_IP=192.168.1.100 NRGKICK_USER=admin NRGKICK_PASS=secret PORT=8080 node server.js
 * 
 * Docker:
 *   docker build -t nrgkick-web .
 *   docker run -p 3000:3000 -e NRGKICK_IP=192.168.1.100 nrgkick-web
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const NRGKICK_IP = process.env.NRGKICK_IP || '';
const NRGKICK_USER = process.env.NRGKICK_USER || '';
const NRGKICK_PASS = process.env.NRGKICK_PASS || '';
const PROXY_TIMEOUT_MS = 10000; // Timeout for proxy requests to NRGKick device

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

/**
 * Serve a static file
 */
function serveStaticFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal server error');
            }
            return;
        }

        res.writeHead(200, { 
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(content);
    });
}

/**
 * Proxy a request to the NRGKick device
 */
function proxyRequest(targetIP, targetPath, authHeader, res) {
    const options = {
        hostname: targetIP,
        port: 80,
        path: targetPath,
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        timeout: PROXY_TIMEOUT_MS
    };

    // Add authorization header if provided
    if (authHeader) {
        options.headers['Authorization'] = authHeader;
    }

    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';

        proxyRes.on('data', (chunk) => {
            data += chunk;
        });

        proxyRes.on('end', () => {
            // Add CORS headers
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(data);
        });
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err.message);
        res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Failed to connect to NRGKick device', details: err.message }));
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Connection to NRGKick device timed out' }));
    });

    proxyReq.end();
}

/**
 * Handle incoming requests
 */
function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // Serve configuration endpoint
    // Returns the configured NRGKick IP and whether auth is configured
    if (pathname === '/api/config') {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            configured: !!NRGKICK_IP,
            ip: NRGKICK_IP,
            hasAuth: !!(NRGKICK_USER && NRGKICK_PASS)
        }));
        return;
    }

    // Proxy API requests to the configured NRGKick device
    // Format: /api/<endpoint>
    // Example: /api/info?general=1
    if (pathname.startsWith('/api/')) {
        if (!NRGKICK_IP) {
            res.writeHead(503, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'NRGKick IP not configured. Set NRGKICK_IP environment variable.' }));
            return;
        }

        const targetPath = pathname.substring(4) + url.search; // Remove '/api' prefix, keep the rest
        
        // Build auth header from environment variables if configured
        let authHeader = null;
        if (NRGKICK_USER && NRGKICK_PASS) {
            const credentials = Buffer.from(`${NRGKICK_USER}:${NRGKICK_PASS}`).toString('base64');
            authHeader = `Basic ${credentials}`;
        }

        console.log(`Proxying request to http://${NRGKICK_IP}${targetPath}`);
        proxyRequest(NRGKICK_IP, targetPath, authHeader, res);
        return;
    }

    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    // Security: prevent directory traversal
    const baseDir = path.resolve(__dirname);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(baseDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    serveStaticFile(resolvedPath, res);
}

// Validate configuration
if (!NRGKICK_IP) {
    console.error(`
╔════════════════════════════════════════════════════════════╗
║                    CONFIGURATION ERROR                     ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  NRGKICK_IP environment variable is not set!               ║
║                                                            ║
║  Please provide the IP address of your NRGKick charger:    ║
║                                                            ║
║  Example:                                                  ║
║    NRGKICK_IP=192.168.1.100 node server.js                 ║
║                                                            ║
║  With authentication:                                      ║
║    NRGKICK_IP=192.168.1.100 \\                              ║
║    NRGKICK_USER=admin \\                                    ║
║    NRGKICK_PASS=secret node server.js                      ║
║                                                            ║
║  Docker:                                                   ║
║    docker run -p 3000:3000 \\                               ║
║      -e NRGKICK_IP=192.168.1.100 nrgkick-web               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
}

// Create and start the server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    const authStatus = (NRGKICK_USER && NRGKICK_PASS) ? 'Yes' : 'No';
    console.log(`
╔════════════════════════════════════════════════════════════╗
║              NRGKick Web Interface Server                  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Server running at: http://localhost:${String(PORT).padEnd(5)}                ║
║                                                            ║
║  NRGKick IP: ${NRGKICK_IP.padEnd(44)}║
║  Authentication: ${authStatus.padEnd(40)}║
║                                                            ║
║  Open in your browser to access the NRGKick interface.     ║
║                                                            ║
║  Press Ctrl+C to stop the server.                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
});
