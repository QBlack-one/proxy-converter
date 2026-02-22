const express = require('express');
const { parseLink } = require('./core/protocols/index');
const { extractLinks } = require('./core/protocols/index');
const OUTPUT_FORMATS = require('./core/generators/index').OUTPUT_FORMATS;

function convertLinks(input, formatKey = 'base64', options = {}) {
  const rawLines = extractLinks(input);
  const proxies = [];
  const validNames = [];

  for (const line of rawLines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const proxy = parseLink(line.trim());
    if (proxy) {
      proxies.push(proxy);
      validNames.push(proxy.name || 'Unnamed');
    }
  }

  const fmt = OUTPUT_FORMATS[formatKey] || OUTPUT_FORMATS['base64'];
  const output = fmt.generate(proxies, options);

  return {
    output,
    count: proxies.length,
    nodeNames: validNames,
    proxies
  };
}

module.exports = { convertLinks };
