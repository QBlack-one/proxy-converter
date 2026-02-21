'use strict';

const fsPromises = require('fs').promises;
const { LINKS_FILE, META_FILE, HISTORY_FILE } = require('./config');

async function saveLinks(rawText, nodeCount, nodeNames, replace = false) {
    let merged;

    if (replace) {
        merged = rawText.split('\n').filter(l => l.trim());
    } else {
        let existingLinks = '';
        try {
            existingLinks = await fsPromises.readFile(LINKS_FILE, 'utf-8');
        } catch (e) { /* 文件不存在 */ }

        const oldLines = existingLinks.split('\n').filter(l => l.trim());
        const newLines = rawText.split('\n').filter(l => l.trim());
        const seen = new Set();
        merged = [];

        for (const line of [...newLines, ...oldLines]) {
            const trimmed = line.trim();
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed);
                merged.push(trimmed);
            }
        }
    }

    const mergedText = merged.join('\n');
    await fsPromises.writeFile(LINKS_FILE, mergedText, 'utf-8');

    const meta = {
        updatedAt: new Date().toISOString(),
        lineCount: merged.length,
        nodeCount: merged.length
    };
    await fsPromises.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');

    if (nodeNames) await appendHistory(nodeCount, nodeNames);

    return { ...meta, newCount: nodeCount || 0, totalCount: merged.length };
}

async function loadHistory() {
    try {
        const content = await fsPromises.readFile(HISTORY_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        return [];
    }
}

async function appendHistory(nodeCount, nodeNames) {
    const history = await loadHistory();
    history.unshift({
        timestamp: new Date().toISOString(),
        nodeCount: nodeCount || 0,
        nodes: nodeNames || []
    });
    if (history.length > 100) history.length = 100;
    await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function loadLinks() {
    try {
        return await fsPromises.readFile(LINKS_FILE, 'utf-8');
    } catch (e) {
        if (e.code === 'ENOENT') return '';
        throw e;
    }
}

async function loadMeta() {
    try {
        const content = await fsPromises.readFile(META_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
    }
}

module.exports = { saveLinks, loadHistory, appendHistory, loadLinks, loadMeta };
