/**
 * NRGKick Web Interface Proxy Server
 * 
 * This server acts as a CORS proxy between the web interface and the NRGKick charger.
 * It solves the CORS issue by:
 * 1. Serving the static web files
 * 2. Proxying API requests to the NRGKick device
 * 
 * Usage:
 *   node server.js [port]
 * 
 * Environment variables:
 *   PORT - Server port (default: 3000)
 * 
 * Example:
 *   node server.js
 *   node server.js 8080
 *   PORT=8080 node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || process.env.PORT || 3000;
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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NRGKick-IP',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // Proxy API requests
    // Format: /api/<charger-ip>/<endpoint>
    // Example: /api/192.168.1.100/info?general=1
    if (pathname.startsWith('/api/')) {
        const pathParts = pathname.substring(5).split('/');
        const targetIP = pathParts[0];
        const targetPath = '/' + pathParts.slice(1).join('/') + url.search;

        // Validate IP address format (IPv4 with octets 0-255)
        const ipRegex = /^((25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
        if (!targetIP || !ipRegex.test(targetIP)) {
            res.writeHead(400, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Invalid IP address format' }));
            return;
        }

        // Get authorization header if present
        const authHeader = req.headers['authorization'];

        console.log(`Proxying request to http://${targetIP}${targetPath}`);
        proxyRequest(targetIP, targetPath, authHeader, res);
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

// Create and start the server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           NRGKick Web Interface Proxy Server               ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Server running at: http://localhost:${String(PORT).padEnd(5)}                ║
║                                                            ║
║  Open in your browser to access the NRGKick interface.     ║
║                                                            ║
║  API proxy endpoint:                                       ║
║    /api/<charger-ip>/<endpoint>                            ║
║                                                            ║
║  Example:                                                  ║
║    /api/192.168.1.100/info?general=1                       ║
║                                                            ║
║  Press Ctrl+C to stop the server.                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
});
