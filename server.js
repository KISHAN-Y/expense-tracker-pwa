const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  🚀 Expense Tracker PWA Server Running     ║`);
    console.log(`╚════════════════════════════════════════════╝`);
    console.log(`\n✨ Open in your browser:\n`);
    console.log(`   🌐 http://localhost:${PORT}`);
    console.log(`   📱 http://localhost:${PORT}/index.html\n`);
    console.log(`✅ Features available:\n`);
    console.log(`   • Dashboard - View today's stats`);
    console.log(`   • Add Transaction - Create new entry`);
    console.log(`   • History - Search & filter`);
    console.log(`   • Settings - Dark mode, export, currency`);
    console.log(`   • Offline mode - Works without internet`);
    console.log(`   • Service Worker - Caching enabled\n`);
    console.log(`📝 How to use locally:\n`);
    console.log(`   1. Open http://localhost:${PORT} in your browser`);
    console.log(`   2. Add a transaction`);
    console.log(`   3. Go offline (DevTools → Network → Offline)`);
    console.log(`   4. Add another transaction`);
    console.log(`   5. Go back online to see sync!\n`);
    console.log(`💡 Setup Google Sheets Backend:\n`);
    console.log(`   • Follow QUICKSTART.md`);
    console.log(`   • Deploy Google Apps Script`);
    console.log(`   • Update API endpoint in scripts/config.js\n`);
    console.log(`Press Ctrl+C to stop server\n`);
});
