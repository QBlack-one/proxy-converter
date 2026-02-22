// ==================== Flow-Style YAML ====================

function flowObj(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return flowVal(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(function (v) { return flowVal(v); }).join(', ') + ']';
    }
    var parts = [];
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = obj[k];
        if (v === undefined || v === null) continue;
        parts.push(flowKey(k) + ': ' + flowVal(v));
    }
    return '{ ' + parts.join(', ') + ' }';
}

function flowVal(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
        if (val === '' || val === 'true' || val === 'false' || val === 'null' ||
            /^\d[\d.eE+\-]*$/.test(val) ||
            /[:{}\[\],&*?|>!'"%@`\n]/.test(val)) {
            return "'" + val.replace(/'/g, "''") + "'";
        }
        return val;
    }
    if (Array.isArray(val)) {
        return '[' + val.map(function (v) { return flowVal(v); }).join(', ') + ']';
    }
    if (typeof val === 'object') {
        return flowObj(val);
    }
    return String(val);
}

function flowKey(key) {
    if (/[:{}\[\],&*?|>!'"%@`]/.test(key) || key === '') {
        return "'" + key.replace(/'/g, "''") + "'";
    }
    return key;
}

// ==================== Block-Style YAML ====================

function toYaml(obj, indent) {
    if (indent === undefined) indent = 0;
    var pad = repeat('  ', indent);
    var lines = [];

    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var item = obj[i];
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                var keys = Object.keys(item);
                var isFirst = true;
                for (var k = 0; k < keys.length; k++) {
                    var key = keys[k];
                    var val = item[key];
                    if (val === undefined || val === null) continue;
                    var prefix = isFirst ? (pad + '- ') : (pad + '  ');
                    isFirst = false;
                    appendKV(lines, prefix, key, val, indent + 1);
                }
            } else {
                lines.push(pad + '- ' + scalar(item));
            }
        }
    } else if (obj !== null && typeof obj === 'object') {
        var entries = Object.keys(obj);
        for (var j = 0; j < entries.length; j++) {
            var eKey = entries[j];
            var eVal = obj[eKey];
            if (eVal === undefined || eVal === null) continue;
            appendKV(lines, pad, eKey, eVal, indent);
        }
    }

    return lines.join('\n') + '\n';
}

function appendKV(lines, prefix, key, val, indent) {
    var qk = quoteKey(key);

    if (Array.isArray(val)) {
        if (val.length === 0) {
            lines.push(prefix + qk + ': []');
        } else if (val.every(function (v) { return typeof v !== 'object' || v === null; })) {
            lines.push(prefix + qk + ':');
            var childPad = repeat('  ', indent + 1);
            for (var i = 0; i < val.length; i++) {
                lines.push(childPad + '- ' + scalar(val[i]));
            }
        } else {
            lines.push(prefix + qk + ':');
            pushChildLines(lines, toYaml(val, indent + 1));
        }
    } else if (val !== null && typeof val === 'object') {
        lines.push(prefix + qk + ':');
        pushChildLines(lines, toYaml(val, indent + 1));
    } else {
        lines.push(prefix + qk + ': ' + scalar(val));
    }
}

function pushChildLines(lines, yamlStr) {
    var parts = yamlStr.replace(/\n$/, '').split('\n');
    for (var i = 0; i < parts.length; i++) {
        lines.push(parts[i]);
    }
}

function quoteKey(key) {
    if (/[:\-#{}\[\],&*?|>!'"%@`]/.test(key) || key.indexOf(' ') >= 0 || key === '') {
        return "'" + key.replace(/'/g, "''") + "'";
    }
    return key;
}

function scalar(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
        if (val === '' ||
            val === 'true' || val === 'false' || val === 'null' ||
            /^\d[\d.eE+\-]*$/.test(val) ||
            /[:\-#{}\[\],&*?|>!'"%@`\n\/ ]/.test(val)) {
            return "'" + val.replace(/'/g, "''") + "'";
        }
        return val;
    }
    return String(val);
}

function repeat(str, n) {
    var r = '';
    for (var i = 0; i < n; i++) r += str;
    return r;
}

module.exports = {
    flowObj,
    toYaml
};
