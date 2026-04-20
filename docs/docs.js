/* emdash tutorial — client-side UX
   Renders topbar, sidebar, in-page TOC, search modal, copy buttons,
   keyboard nav, and reading progress. */

(function () {
  'use strict';

  // ---------- Chapter manifest ----------
  const CHAPTERS = [
    { file: 'index.html',                      num: null, title: 'Overview',                     type: null,       section: 'Start' },
    { file: '01-what-is-emdash.html',          num: '01', title: 'What is emdash?',              type: 'concept',  section: 'Foundations' },
    { file: '02-how-emdash-works.html',        num: '02', title: 'How emdash works',             type: 'concept',  section: 'Foundations' },
    { file: '03-cloudflare-primer.html',       num: '03', title: 'Cloudflare primer',            type: 'concept',  section: 'Foundations' },
    { file: '04-astro-primer.html',            num: '04', title: 'Astro primer',                 type: 'concept',  section: 'Foundations' },
    { file: '05-getting-started.html',         num: '05', title: 'Getting started',              type: 'guide',    section: 'Get started' },
    { file: '06-template-tour.html',           num: '06', title: 'Template tour',                type: 'guide',    section: 'Get started' },
    { file: '07-content-modeling.html',        num: '07', title: 'Content modeling',             type: 'guide',    section: 'Build' },
    { file: '08-adding-pages.html',            num: '08', title: 'Adding pages',                 type: 'tutorial', section: 'Build' },
    { file: '09-customizing-templates.html',   num: '09', title: 'Customizing templates',        type: 'tutorial', section: 'Build' },
    { file: '10-building-content-type.html',   num: '10', title: 'Building for a new type',      type: 'tutorial', section: 'Build' },
    { file: '11-deploying.html',               num: '11', title: 'Deploying to Cloudflare',      type: 'guide',    section: 'Ship' },
    { file: '12-plugins.html',                 num: '12', title: 'Plugins',                      type: 'concept',  section: 'Ship' },
    { file: '13-api-reference.html',           num: '13', title: 'API reference',                type: 'ref',      section: 'Reference' },
    { file: '14-troubleshooting.html',         num: '14', title: 'Troubleshooting',              type: 'ref',      section: 'Reference' },
  ];

  const SECTIONS = ['Foundations', 'Get started', 'Build', 'Ship', 'Reference'];

  // ---------- Current page detection ----------
  function currentFile() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path === '' ? 'index.html' : path;
  }

  const current = currentFile();
  const currentChapter = CHAPTERS.find((c) => c.file === current);

  // ---------- Topbar ----------
  function buildTopbar() {
    const existing = document.querySelector('.topbar');
    if (existing) return;

    const header = document.createElement('header');
    header.className = 'topbar';

    const crumbHtml = currentChapter && currentChapter.num
      ? `<div class="crumb">
           <span class="num">${currentChapter.num}</span>
           <span class="sep">—</span>
           <span>${currentChapter.section}</span>
           <span class="sep">/</span>
           <span class="title">${escapeHtml(currentChapter.title)}</span>
         </div>`
      : `<div class="crumb"><span class="title">An editorial guide to emdash</span></div>`;

    header.innerHTML = `
      <div class="topbar-inner">
        <a href="index.html" class="brand">
          <span class="mark">—</span>
          <span class="name">emdash</span>
          <span class="rule">/</span>
          <span class="sub">tutorial</span>
        </a>
        ${crumbHtml}
        <div class="topbar-right">
          <button class="search-btn" data-search-open aria-label="Search (Cmd+K)">
            <span class="label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <span class="text">Search the guide</span>
            </span>
            <kbd>⌘K</kbd>
          </button>
          <button class="theme-toggle" data-theme-toggle aria-label="Toggle theme" title="Toggle theme (light / dark / system)">
            <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
            </svg>
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
            </svg>
            <svg class="icon-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="progress"><div class="progress-fill" id="progressFill"></div></div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
  }

  // ---------- Theme toggle ----------
  function initTheme() {
    const MODES = ['light', 'dark', 'auto'];
    const stored = localStorage.getItem('emdash-theme-mode');
    let mode = MODES.includes(stored) ? stored : 'auto';

    function apply(m) {
      const html = document.documentElement;
      html.setAttribute('data-theme-mode', m);
      if (m === 'auto') {
        html.removeAttribute('data-theme');
      } else {
        html.setAttribute('data-theme', m);
      }
      localStorage.setItem('emdash-theme-mode', m);
    }

    apply(mode);

    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme-mode') || 'auto';
        const idx = MODES.indexOf(current);
        const next = MODES[(idx + 1) % MODES.length];
        apply(next);
      });
    }
  }

  // ---------- Sidebar (grouped by section) ----------
  function buildSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    let html = '';
    for (const section of SECTIONS) {
      const items = CHAPTERS.filter((c) => c.section === section);
      if (items.length === 0) continue;
      html += `<div class="sidebar-section">
        <div class="sidebar-section-label">${section}</div>
        <ul class="sidebar-list">`;
      for (const item of items) {
        const active = item.file === current ? ' active' : '';
        const num = item.num || '·';
        const badge = item.type
          ? `<span class="badge badge-${item.type}">${item.type}</span>`
          : '';
        html += `<li class="sidebar-item">
          <a href="${item.file}" class="${active.trim()}">
            <span class="num">${num}</span>
            <span class="txt">${escapeHtml(item.title)}</span>
            ${badge}
          </a>
        </li>`;
      }
      html += `</ul></div>`;
    }
    sidebar.innerHTML = html;
  }

  // ---------- In-page TOC ----------
  function buildOnThisPage() {
    const article = document.querySelector('.content article');
    if (!article) return;

    const existing = document.querySelector('.on-this-page');
    let aside = existing;
    if (!aside) {
      aside = document.createElement('aside');
      aside.className = 'on-this-page';
      const layout = document.querySelector('.layout');
      if (layout) layout.appendChild(aside);
    }

    // Give every h2/h3 in the article an id
    const headings = [...article.querySelectorAll('h2, h3')];
    if (headings.length === 0) {
      aside.remove();
      return;
    }

    const used = new Set();
    headings.forEach((h) => {
      if (h.id) return;
      let slug = slugify(h.textContent);
      let i = 1;
      while (used.has(slug)) slug = slugify(h.textContent) + '-' + ++i;
      used.add(slug);
      h.id = slug;
    });

    let html = `<div class="on-this-page-label">On this page</div><ul>`;
    for (const h of headings) {
      const level = h.tagName === 'H3' ? 'h3' : 'h2';
      // Skip h3s inside .toc-grid, pager, etc.
      if (h.closest('.toc-grid, .pager, .hero')) continue;
      html += `<li><a href="#${h.id}" class="${level}">${escapeHtml(cleanText(h.textContent))}</a></li>`;
    }
    html += `</ul>`;
    aside.innerHTML = html;

    // Scroll-spy
    const spyLinks = aside.querySelectorAll('a');
    const spyTargets = [...spyLinks].map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (spyTargets.length > 0 && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const id = e.target.id;
              spyLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
            }
          });
        },
        { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
      );
      spyTargets.forEach((t) => io.observe(t));
    }
  }

  // ---------- Eyebrow enrichment (reading time + dot) ----------
  function enrichEyebrow() {
    const eyebrow = document.querySelector('.content .eyebrow');
    if (!eyebrow) return;
    // Add a bullet dot to the start
    if (!eyebrow.querySelector('.dot')) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      eyebrow.insertBefore(dot, eyebrow.firstChild);
    }
    // Estimate reading time
    const article = document.querySelector('.content article');
    if (!article) return;
    const words = article.innerText.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 210));
    if (!eyebrow.querySelector('.read-time')) {
      const span = document.createElement('span');
      span.className = 'read-time';
      span.textContent = minutes + ' min read';
      eyebrow.appendChild(span);
    }
  }

  // ---------- Copy buttons ----------
  function addCopyButtons() {
    document.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          const text = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1400);
        } catch (e) {
          btn.textContent = 'Error';
        }
      });
      pre.appendChild(btn);
    });
  }

  // ---------- Progress bar ----------
  function initProgress() {
    const fill = document.getElementById('progressFill');
    if (!fill) return;
    const article = document.querySelector('.content article');
    if (!article) return;

    function update() {
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      fill.style.width = pct + '%';
    }
    document.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // ---------- Keyboard navigation ----------
  function initKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target.matches('input, textarea, [contenteditable]')) return;

      // Cmd/Ctrl + K — open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }

      // Plain '/' opens search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openSearch();
        return;
      }

      // J / → next chapter
      if (e.key === 'j' || e.key === 'ArrowRight') {
        const next = document.querySelector('.pager .next');
        if (next && next.href) location.href = next.href;
      }
      // K / ← prev chapter
      if (e.key === 'k' || e.key === 'ArrowLeft') {
        const prev = document.querySelector('.pager .prev');
        if (prev && prev.href) location.href = prev.href;
      }
    });
  }

  // ---------- Search ----------
  function buildSearchModal() {
    const modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.innerHTML = `
      <div class="search-panel" role="dialog" aria-label="Search">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
          <input class="search-input" id="searchInput" type="text"
                 placeholder="Search chapters, functions, concepts…" autocomplete="off" />
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSearch();
    });

    const input = modal.querySelector('#searchInput');
    const results = modal.querySelector('#searchResults');

    let selected = 0;
    let current = [];

    input.addEventListener('input', () => {
      current = search(input.value);
      selected = 0;
      renderResults(results, current, input.value, selected);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSearch(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selected = Math.min(selected + 1, current.length - 1);
        renderResults(results, current, input.value, selected);
        scrollToSelected(results);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selected = Math.max(selected - 1, 0);
        renderResults(results, current, input.value, selected);
        scrollToSelected(results);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = current[selected];
        if (target) location.href = target.href;
      }
    });

    // Open buttons
    document.querySelectorAll('[data-search-open]').forEach((btn) => {
      btn.addEventListener('click', openSearch);
    });

    // Initial empty state
    current = search('');
    renderResults(results, current, '', 0);
  }

  function openSearch() {
    const modal = document.querySelector('.search-modal');
    if (!modal) return;
    modal.classList.add('open');
    const input = modal.querySelector('#searchInput');
    setTimeout(() => input && input.focus(), 20);
  }

  function closeSearch() {
    const modal = document.querySelector('.search-modal');
    if (!modal) return;
    modal.classList.remove('open');
  }

  function scrollToSelected(container) {
    const el = container.querySelector('.search-result.selected');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pr = container.getBoundingClientRect();
    if (r.bottom > pr.bottom) el.scrollIntoView({ block: 'end' });
    if (r.top < pr.top) el.scrollIntoView({ block: 'start' });
  }

  function search(q) {
    const index = window.DOCS_INDEX || [];
    const query = q.trim().toLowerCase();
    if (!query) {
      // Show all top-level chapters as default
      return index
        .filter((e) => e.kind === 'chapter')
        .map((e) => ({ ...e, score: 0 }));
    }
    const terms = query.split(/\s+/).filter(Boolean);
    return index
      .map((entry) => ({ entry, score: scoreEntry(entry, terms, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24)
      .map((x) => x.entry);
  }

  function scoreEntry(e, terms, fullQuery) {
    const hay = (e.title + ' ' + (e.heading || '') + ' ' + (e.text || '')).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!hay.includes(t)) return 0;
      if (e.title.toLowerCase().includes(t)) score += 12;
      if ((e.heading || '').toLowerCase().includes(t)) score += 8;
      const count = (hay.match(new RegExp(escapeRegex(t), 'gi')) || []).length;
      score += count * 2;
    }
    if (e.title.toLowerCase().includes(fullQuery)) score += 20;
    if (e.kind === 'chapter') score += 3;
    return score;
  }

  function renderResults(container, results, query, selectedIdx) {
    if (results.length === 0) {
      container.innerHTML = `<div class="search-empty">No results for "${escapeHtml(query)}"</div>`;
      return;
    }
    container.innerHTML = results
      .map((r, i) => {
        const num = r.num ? `<span class="num">${r.num}</span>` : '';
        const kindLabel = r.heading ? 'Section' : 'Chapter';
        return `<a class="search-result${i === selectedIdx ? ' selected' : ''}"
                   href="${r.href}" data-idx="${i}">
          <div class="search-result-meta">
            ${num}
            <span>${kindLabel}</span>
            ${r.sectionName ? `<span>· ${escapeHtml(r.sectionName)}</span>` : ''}
          </div>
          <div class="search-result-title">${highlight(r.heading || r.title, query)}</div>
          ${r.snippet ? `<div class="search-result-snippet">${highlight(r.snippet, query)}</div>` : ''}
        </a>`;
      })
      .join('');
    // Hover updates selection
    container.querySelectorAll('.search-result').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        container.querySelectorAll('.search-result.selected').forEach((s) => s.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }
  function cleanText(s) { return s.replace(/[—§]/g, '').trim(); }
  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let out = safe;
    for (const t of terms) {
      const re = new RegExp('(' + escapeRegex(t) + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    }
    return out;
  }

  // ---------- Init ----------
  function init() {
    buildTopbar();
    initTheme();
    buildSidebar();
    buildOnThisPage();
    enrichEyebrow();
    addCopyButtons();
    initProgress();
    initKeyboardNav();
    buildSearchModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
