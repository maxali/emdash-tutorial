---
name: update-emdash-tutorial
description: Update this repo's emdash tutorial so it matches the current upstream emdash release and main branch. Verifies pinned revisions, fetches upstream changes, identifies which chapters are affected, patches them, rebuilds search + asset hashes, tests locally, updates pins, commits, and deploys. Use when the user asks to "update the tutorial", "check for upstream changes", "sync with latest emdash", "refresh the docs", or similar requests to keep the emdash documentation current.
---

# Update emdash tutorial

## Quick start

```bash
# 1. See what changed upstream since our pinned revisions
bash scripts/check-upstream.sh

# 2. Read HOWTOUPDATE.md section §3 to map commits → chapters
# 3. Edit docs/*.html for affected chapters only
# 4. Rebuild + test + ship:
npm run build    # rebuilds search index, stamps asset hashes
npm run dev      # verify locally at http://localhost:8787
npm run deploy   # wrangler deploys
```

## When to trigger this skill

- User asks to update / refresh / sync the tutorial
- User mentions checking for new emdash releases
- User asks "is this still accurate?" or "is emdash 0.6 out?"
- User points at a specific upstream commit and says "include this"

## Workflow

`HOWTOUPDATE.md` at the repo root is the authoritative playbook. Read
it first — especially §1 (pinned revisions) and §3 (chapter-to-source
map). This skill just wraps it in an agent-friendly checklist.

### 1. Verify current state

```bash
# Confirm you're in the right place — should list docs/, HOWTOUPDATE.md, wrangler.jsonc
ls -1 docs HOWTOUPDATE.md wrangler.jsonc package.json

# Show the pinned revisions
grep -E "commit \`[a-f0-9]" HOWTOUPDATE.md | head -5
```

### 2. Check what's new

Run the helper script — it lists every upstream commit since the pins
and groups them by repo:

```bash
bash scripts/check-upstream.sh
```

Review the output. Skip commits that only touch:
- `test/`, `e2e/`, `.github/`, `infra/`, `scripts/`, lint configs
- `perf-monitor`, `cache-demo`, `blog-demo` experimental arms
- Internal refactors with no public-API change
- Dependency bumps without behaviour change

### 3. Identify affected chapters

Use §3 of HOWTOUPDATE.md (the "Chapter-to-source map" table). For
each kept commit, determine which chapter(s) it could invalidate. If
a commit touches nothing in that table, skip it.

Common targets:
- **Chapter 13 (API reference)** — any change to `packages/core/src/index.ts` or `packages/*/package.json` exports
- **Chapter 06 (Template tour)** — any change in the templates repo
- **Chapter 11 (Deploying)** — Cloudflare config / wrangler changes
- **Chapter 14 (Troubleshooting)** — new gotchas in GitHub Issues

### 4. Patch

Edit the relevant `docs/*.html` files. **Rules to preserve design integrity:**

- Don't change `<article>`, `<h1>`, `<h2>`, `<h3>`, `.eyebrow`, `.lede`, `.pager` structure — the CSS/JS depend on these selectors and ordering.
- Don't touch the first-load inline `<script>` in `<head>` or the trailing `<script src="docs.js">` — those power the whole UX.
- Preserve existing pager `prev` / `next` links unless you're explicitly inserting a chapter.
- If you introduce new terminology, make sure it appears in a heading so the search index picks it up.
- **Known factual landmines to not regress:**
  - `getEmDashCollection`, `getEmDashEntry`, `getEntryTerms`, `getSiteSettings` come from the **root** `"emdash"` package — never from `"emdash/content"` or other sub-paths.
  - `getEmDashCollection` returns `{ entries, error, cacheHint, nextCursor }` — destructure it; never treat as array.
  - `getEmDashEntry` returns `{ entry, error, isPreview, fallbackLocale, cacheHint }` — same.
  - Filter keys are `status`, `orderBy`, `where`, `limit`, `cursor`, `locale` — not `filter` or `sort`.

### 5. Rebuild (mandatory)

```bash
npm run build
```

This runs `build-search-index` (re-parses HTML into `docs/search-index.js`) and `stamp-assets` (hashes `styles.css`, `docs.js`, `search-index.js` and rewrites `<link>` / `<script>` references). Skipping this means stale search + cached stylesheets for users.

### 6. Test locally

```bash
npm run dev
```

Open `http://localhost:8787`. Smoke test:
- The edited chapter renders
- ⌘K search finds new terms you added
- Theme toggle still works
- No console errors

### 7. Update the pin table

In `HOWTOUPDATE.md` §1, replace the commit SHAs and dates with what you diffed against. This is how the next update knows where to start.

### 8. Commit + deploy

```bash
git add -A
git commit -m "Update tutorial for emdash <short-sha> — <one-line summary>"
git push

npm run deploy   # predeploy runs `npm run build` again automatically
```

## Add value, don't just track changes

Beyond mirroring upstream, actively look for:

- **New gotchas in Issues** → add to Chapter 14's troubleshooting table
- **New first-party plugins** → update Chapter 12's first-party list
- **New templates** → update Chapter 06's five-template table (may need to become six)
- **Changed free-tier limits** → update Chapter 03
- **New `emdash/*` sub-paths** → update Chapter 13's entry-point map

## Anti-patterns

- ❌ Editing `emdash-tutorial.md` — it's a legacy single-file copy, not the canonical source. Only edit `docs/*.html`.
- ❌ Editing `docs/search-index.js` by hand — it's generated by `npm run build`.
- ❌ Adding un-stamped asset URLs — the stamper rewrites references; keep them versionless in source, it'll add `?v=<hash>` on build.
- ❌ Updating pins in HOWTOUPDATE.md without actually having diffed that far — future agents will trust the pin and miss changes.

## Further reading

- [`HOWTOUPDATE.md`](../../../HOWTOUPDATE.md) — full playbook (also pinned in the repo root)
- [Upstream emdash repo](https://github.com/emdash-cms/emdash)
- [Upstream templates repo](https://github.com/emdash-cms/templates)
