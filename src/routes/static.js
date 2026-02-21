'use strict';

const path = require('path');
const fsPromises = require('fs').promises;
const { PUBLIC_DIR } = require('../config');

const STATIC_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

async function handleStatic(req, res, pathname) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(PUBLIC_DIR, filePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const stat = await fsPromises.stat(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
        const ext = path.extname(filePath);
        const contentType = STATIC_MIME[ext] || 'application/octet-stream';
        const data = await fsPromises.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
    }
}

module.exports = { handleStatic };
