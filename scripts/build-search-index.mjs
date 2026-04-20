#!/usr/bin/env node
// Build docs/search-index.js from the HTML in docs/.
// Run this after editing any chapter: `npm run build-index`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(__dirname, '..', 'docs');

const META = {
  'index.html':                     { num: null, section: 'Start',       title: 'Overview' },
  '01-what-is-emdash.html':         { num: '01', section: 'Foundations', title: 'What is emdash?' },
  '02-how-emdash-works.html':       { num: '02', section: 'Foundations', title: 'How emdash works' },
  '03-cloudflare-primer.html':      { num: '03', section: 'Foundations', title: 'Cloudflare primer' },
  '04-astro-primer.html':           { num: '04', section: 'Foundations', title: 'Astro primer' },
  '05-getting-started.html':        { num: '05', section: 'Get started', title: 'Getting started' },
  '06-template-tour.html':          { num: '06', section: 'Get started', title: 'Template tour' },
  '07-content-modeling.html':       { num: '07', section: 'Build',       title: 'Content modeling' },
  '08-adding-pages.html':           { num: '08', section: 'Build',       title: 'Adding pages' },
  '09-customizing-templates.html':  { num: '09', section: 'Build',       title: 'Customizing templates' },
  '10-building-content-type.html':  { num: '10', section: 'Build',       title: 'Building for a new content type' },
  '11-deploying.html':              { num: '11', section: 'Ship',        title: 'Deploying to Cloudflare' },
  '12-plugins.html':                { num: '12', section: 'Ship',        title: 'Plugins' },
  '13-api-reference.html':          { num: '13', section: 'Reference',   title: 'API reference' },
  '14-troubleshooting.html':        { num: '14', section: 'Reference',   title: 'Troubleshooting' },
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const decode = (s) =>
  s
    .replace(/&mdash;/g, '—')
    .replace(/&larr;/g, '←')
    .replace(/&rarr;/g, '→')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');

const strip = (html) => decode(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

const index = [];

for (const [file, meta] of Object.entries(META)) {
  const filePath = path.join(DOCS, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`[skip] ${file} not found`);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/);
  if (!articleMatch) continue;
  const article = articleMatch[1];

  const ledeMatch = article.match(/<p class="lede">([\s\S]*?)<\/p>/);
  const ledeText = ledeMatch ? strip(ledeMatch[1]) : '';
  const firstP = article.replace(/<p class="lede">[\s\S]*?<\/p>/, '').match(/<p>([\s\S]*?)<\/p>/);
  const pText = firstP ? strip(firstP[1]) : '';

  index.push({
    kind: 'chapter',
    href: file,
    num: meta.num,
    sectionName: meta.section,
    title: meta.title,
    text: ledeText + ' ' + pText,
    snippet: ledeText || pText,
  });

  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<nav class="pager")/g;
  let m;
  const used = new Set();
  while ((m = h2Regex.exec(article)) !== null) {
    const headingRaw = strip(m[1]);
    if (!headingRaw) continue;
    const body = strip(m[2]).slice(0, 600);
    let slug = slugify(headingRaw);
    let i = 1;
    while (used.has(slug)) slug = `${slugify(headingRaw)}-${++i}`;
    used.add(slug);
    index.push({
      kind: 'section',
      href: `${file}#${slug}`,
      num: meta.num,
      sectionName: meta.section,
      title: meta.title,
      heading: headingRaw,
      text: `${headingRaw} ${body}`,
      snippet: body,
    });
  }
}

const out = `window.DOCS_INDEX = ${JSON.stringify(index)};\n`;
fs.writeFileSync(path.join(DOCS, 'search-index.js'), out);
console.log(`✓ Built search-index.js — ${index.length} entries`);
