'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT_DIR } = require('./config');

function loadEngine() {
    const ctx = vm.createContext({
        console: { log: () => { }, warn: () => { }, error: () => { } },
        atob(str) {
            try { return Buffer.from(str, 'base64').toString('utf-8'); }
            catch (e) { return Buffer.from(str, 'base64').toString('binary'); }
        },
        btoa(str) {
            try { return Buffer.from(str, 'utf-8').toString('base64'); }
            catch (e) { return Buffer.from(str, 'binary').toString('base64'); }
        },
        escape(str) { return encodeURIComponent(str); },
        unescape(str) {
            try { return decodeURIComponent(str); }
            catch (e) {
                try { return decodeURIComponent(str.replace(/%(?![0-9a-fA-F]{2})/g, '%25')); }
                catch (e2) { return str; }
            }
        },
        document: { createElement: () => ({ set innerHTML(v) { }, textContent: '' }) },
        window: {},
        URL: URL,
        URLSearchParams: URLSearchParams,
        JSON: JSON,
        parseInt: parseInt,
        parseFloat: parseFloat,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Math: Math,
        Set: Set,
        Map: Map,
        Buffer: Buffer,
        RegExp: RegExp,
        Date: Date,
        Error: Error
    });

    // 加载前端 JS 模块
    const jsDir = path.join(ROOT_DIR, 'public', 'js');
    const files = ['parsers.js', 'encoders.js', 'yaml.js', 'generators.js'];
    for (const file of files) {
        const code = fs.readFileSync(path.join(jsDir, file), 'utf-8');
        vm.runInContext(code, ctx);
    }

    return ctx;
}

const engine = loadEngine();

// 预编译脚本（只编译一次，通过沙箱变量传参）
const conversionScript = new vm.Script(`
(function() {
  const links = extractLinks(__rawContent__);
  const proxies = [];
  for (const link of links) {
    const node = parseLink(link);
    if (node) proxies.push(node);
  }
  const seen = new Set();
  const unique = proxies.filter(p => {
    const key = p.type + '|' + p.server + '|' + p.port + '|' + (p.uuid || p.password || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let output;
  switch (__format__) {
    case 'clash-yaml': output = generateClashConfig(unique, __options__); break;
    case 'clash-meta': output = generateClashMetaConfig(unique, __options__); break;
    case 'surge': output = generateSurgeConfig(unique, __options__); break;
    case 'sing-box': output = generateSingBoxConfig(unique, __options__); break;
    case 'base64': output = generateBase64Sub(unique); break;
    case 'raw': output = generateRawLinks(unique); break;
    default: output = generateBase64Sub(unique);
  }
  return { count: unique.length, output, nodeNames: unique.map(p => p.name || (p.server + ':' + p.port)) };
})()
`);

function convertLinks(rawContent, format, options = {}) {
    engine.__rawContent__ = rawContent;
    engine.__format__ = format;
    engine.__options__ = options;
    return conversionScript.runInContext(engine);
}

module.exports = { engine, convertLinks };
