#!/usr/bin/env node
// Add a content-hash query string to every reference of styles.css,
// docs.js, and search-index.js in docs/*.html.
//
// This is cache-busting: the filename stays the same (so Cloudflare's
// asset manifest matches), but the URL has ?v=<hash> so browsers refetch
// after any content change.
//
// Run before `wrangler deploy`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(__dirname, '..', 'docs');

const ASSETS = ['styles.css', 'docs.js', 'search-index.js'];

function shortHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

const hashes = Object.fromEntries(
  ASSETS.map((name) => [name, shortHash(path.join(DOCS, name))])
);

console.log('Asset hashes:');
for (const [name, hash] of Object.entries(hashes)) {
  console.log(`  ${name}  →  ?v=${hash}`);
}

const htmlFiles = fs.readdirSync(DOCS).filter((f) => f.endsWith('.html'));
let updated = 0;

for (const file of htmlFiles) {
  const filePath = path.join(DOCS, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const before = html;

  for (const [name, hash] of Object.entries(hashes)) {
    // Replace both unversioned and previously-versioned references.
    // Handle: href="styles.css", href="/styles.css", href="styles.css?v=OLD"
    const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `((?:href|src)=["'](?:/)?${escName})(?:\\?v=[a-f0-9]+)?(["'])`,
      'g'
    );
    html = html.replace(re, `$1?v=${hash}$2`);
  }

  if (html !== before) {
    fs.writeFileSync(filePath, html);
    updated++;
  }
}

console.log(`✓ Stamped ${updated} HTML file(s) with asset versions`);
