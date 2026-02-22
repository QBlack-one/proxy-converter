const fs = require('fs');

let code = fs.readFileSync('public/js/parsers.js', 'utf8');

if (!code.includes('function safeDecode')) {
    code = code.replace('// ==================== Base64 工具 ====================', `// ==================== Base64 工具 ====================

function safeDecode(str) {
    if (!str) return '';
    try { return decodeURIComponent(str); }
    catch (e) { try { return unescape(str); } catch(e2) { return str; } }
}`);
}

let lines = code.split('\n');
code = lines.map(line => {
    if (line.includes('decodeURIComponent(') && !line.includes('decodeURIComponent(escape(') && !line.includes('decodeURIComponent(str')) {
        return line.replace(/decodeURIComponent\(/g, 'safeDecode(');
    }
    return line;
}).join('\n');

fs.writeFileSync('public/js/parsers.js', code);
console.log('Fixed parsers.js');
