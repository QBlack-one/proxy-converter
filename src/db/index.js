const Database = require('better-sqlite3');
const path = require('path');
const { DATA_DIR } = require('../config');

// Initialize database
const db = new Database(path.join(DATA_DIR, 'proxy.db'));
db.pragma('journal_mode = WAL'); // Better concurrency

// Migration: Create tables if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        server TEXT NOT NULL,
        port INTEGER NOT NULL,
        raw_link TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        node_count INTEGER NOT NULL,
        details TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

// Migration: Add details column if not exists
try {
    db.exec('ALTER TABLE nodes ADD COLUMN details TEXT DEFAULT "{}"');
} catch (e) {
    // Column already exists, ignore
}

// ==================== Nodes Service ====================

const insertNodeStmt = db.prepare('INSERT INTO nodes (name, type, server, port, raw_link, details) VALUES (@name, @type, @server, @port, @raw_link, @details)');
const getAllNodesStmt = db.prepare('SELECT * FROM nodes ORDER BY created_at ASC');
const deleteAllNodesStmt = db.prepare('DELETE FROM nodes');

function saveNodes(nodesArray) {
    const transaction = db.transaction((nodes) => {
        // 获取已有节点的 name 和 raw_link 用于去重
        const rows = db.prepare('SELECT name, raw_link FROM nodes').all();
        const existingNames = new Set(rows.map(r => r.name.trim()));
        const existingLinks = new Set(rows.map(r => (r.raw_link || '').trim()));
        let addedCount = 0;
        for (const node of nodes) {
            const name = (node.name || '').trim();
            const link = (node.raw_link || '').trim();
            // 按名称或链接去重
            if (!name || existingNames.has(name) || (link && existingLinks.has(link))) continue;
            insertNodeStmt.run({
                name: name || 'Unknown',
                type: node.type || 'unknown',
                server: node.server || 'unknown',
                port: node.port || 0,
                raw_link: link,
                details: node.details || '{}'
            });
            existingNames.add(name);
            if (link) existingLinks.add(link);
            addedCount++;
        }
        return addedCount;
    });
    return transaction(nodesArray);
}

function getNodes() {
    return getAllNodesStmt.all();
}

function clearNodes() {
    deleteAllNodesStmt.run();
}

// ==================== History Service ====================

const insertHistoryStmt = db.prepare('INSERT INTO history (node_count, details) VALUES (?, ?)');
const getHistoryStmt = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50');
const clearHistoryStmt = db.prepare('DELETE FROM history');

function addHistory(count, detailsArray) {
    insertHistoryStmt.run(count, JSON.stringify(detailsArray));
}

function getHistory() {
    return getHistoryStmt.all().map(h => {
        h.details = JSON.parse(h.details);
        return h;
    });
}

function clearHistory() {
    clearHistoryStmt.run();
}

// ==================== Settings Service ====================

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

function getSetting(key, defaultValue = null) {
    const row = getSettingStmt.get(key);
    if (!row) return defaultValue;
    try {
        return JSON.parse(row.value);
    } catch {
        return row.value; // string fallback
    }
}

function setSetting(key, value) {
    setSettingStmt.run(key, JSON.stringify(value));
}

function getConfig() {
    return getSetting('app_config', {
        autoUpdate: false,
        updateInterval: 24,
        subscriptionSources: [],
        deduplicate: false
    });
}

function setConfig(configObj) {
    setSetting('app_config', configObj);
}

module.exports = {
    db,
    saveNodes,
    getNodes,
    clearNodes,
    addHistory,
    getHistory,
    clearHistory,
    getSetting,
    setSetting,
    getConfig,
    setConfig
};
