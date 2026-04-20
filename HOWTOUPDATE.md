# HOWTOUPDATE.md

> Instructions for keeping this tutorial in sync with upstream emdash.
> Written for humans *and* LLMs. An agent should be able to open this
> file, run the commands it lists, and produce an accurate update.

---

## 1. What this tutorial is anchored to

The content was written against these upstream revisions. **If your
task is "update the tutorial," always start here — diff the current
upstream state against this block and patch from the diff.**

| Repo | Pinned at | Date | Source |
|---|---|---|---|
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) | commit `f7f4814182e1ad249a9ea15951a1fb5ca4362411` | 2026-04-20 | `main` branch |
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) | release `emdash@0.5.0` | 2026-04-14 | npm/release |
| [`emdash-cms/templates`](https://github.com/emdash-cms/templates) | commit `d2f03414bc7022efcfbe378a829f2a52a59fdde9` | 2026-04-13 | `main` branch |
| [Cloudflare announcement blog](https://blog.cloudflare.com/emdash-wordpress/) | original post | Apr 2026 | |

> **When you update the tutorial, update this table at the end.** The
> table IS the source of truth for "what version of emdash this doc
> matches."

---

## 2. Where to look for upstream changes

Check these sources in order. Anything that isn't covered by one of
them almost certainly doesn't need to change in the tutorial.

### 2.1. Release notes (most important)

- **Releases page:** https://github.com/emdash-cms/emdash/releases
- **Changelog files:** `packages/*/CHANGELOG.md` on `main`
- **Via `gh`:**
  ```bash
  gh api repos/emdash-cms/emdash/releases --jq '.[0:5] | .[] | {tag: .tag_name, date: .published_at, body: .body[:400]}'
  ```

### 2.2. The README and docs site

- `README.md` on main: https://github.com/emdash-cms/emdash/blob/main/README.md
- `docs/` (Starlight site) on main: https://github.com/emdash-cms/emdash/tree/main/docs

### 2.3. Public API surface (for Chapter 13)

Chapter 13 (API reference) documents every public export. Check:

- Root package exports: `packages/core/package.json` → `"exports"` field
- What the root `emdash` package re-exports: `packages/core/src/index.ts`
- Sibling sub-paths: `emdash/runtime`, `emdash/astro`, `emdash/ui`, `emdash/page`, `emdash/client`, `emdash/middleware`
- Cloudflare adapters: `packages/cloudflare/src/index.ts`
- Auth providers: `packages/auth/src/`

Via `gh`:
```bash
gh api repos/emdash-cms/emdash/contents/packages/core/package.json --jq '.content' | base64 -d | jq '.exports'
gh api repos/emdash-cms/emdash/contents/packages/core/src/index.ts --jq '.content' | base64 -d | head -200
```

### 2.4. Templates & scaffolding (for Chapters 05–10)

- Templates repo: https://github.com/emdash-cms/templates
- Look at each `blog`, `marketing`, `portfolio`, `starter`, `blank`
  and its `-cloudflare` variant — compare `astro.config.mjs`,
  `src/live.config.ts`, and `package.json` against the tutorial.

### 2.5. Cloudflare platform (for Chapter 03)

Rarer but possible. If Cloudflare ships something that changes the
mental model (e.g., new storage primitives, Workers limits change,
Pages/Workers merge reverses), update Chapter 03.

- Cloudflare Workers docs: https://developers.cloudflare.com/workers
- Cloudflare blog: https://blog.cloudflare.com

---

## 3. Chapter-to-source map

When a specific thing changes upstream, update **only** the chapters
that reference it. Do not touch unrelated chapters.

| Chapter | Upstream sources that can invalidate it |
|---|---|
| 01 What is emdash | README + Cloudflare announcement blog |
| 02 How emdash works | `packages/core/src/index.ts`, admin route prefix, `/_emdash/admin` |
| 03 Cloudflare primer | Cloudflare Workers / D1 / R2 / KV docs; free-tier limits |
| 04 Astro primer | Astro docs + `@astrojs/cloudflare` adapter; `defineLiveCollection` signature |
| 05 Getting started | `create-emdash` CLI, `pnpm bootstrap` script |
| 06 Template tour | Every template's `astro.config.mjs`, `src/live.config.ts`, `package.json` |
| 07 Content modeling | Admin UI schema builder + `emdash types` CLI |
| 08 Adding pages | Astro routing + `getEmDashCollection` / `getEmDashEntry` signatures |
| 09 Customizing templates | Template CSS token conventions + `BaseLayout.astro` shape |
| 10 Building for a new content type | Schema fields, `emdash types`, filter/orderBy shape |
| 11 Deploying to Cloudflare | `wrangler.jsonc` structure, `compatibility_flags`, `assets` syntax |
| 12 Plugins | Plugin sandbox model, Dynamic Workers / Worker Loader, MCP server, `definePlugin` |
| 13 API reference | **Every package's `exports` + source `index.ts`** — this is the widest surface |
| 14 Troubleshooting | Common issues from GitHub Discussions + Issues |

---

## 4. Update workflow

### Step 1 — Find the delta

```bash
# Pinned commits (from §1 table above)
OLD_EMDASH="f7f4814182e1ad249a9ea15951a1fb5ca4362411"
OLD_TEMPLATES="d2f03414bc7022efcfbe378a829f2a52a59fdde9"

# Current upstream
gh api repos/emdash-cms/emdash/commits/main --jq '.sha'
gh api repos/emdash-cms/templates/commits/main --jq '.sha'

# Commits since pin (summaries only — keeps context small)
gh api "repos/emdash-cms/emdash/compare/${OLD_EMDASH}...main" --jq '.commits[] | {sha: .sha[0:7], msg: .commit.message | split("\n")[0]}'

gh api "repos/emdash-cms/templates/compare/${OLD_TEMPLATES}...main" --jq '.commits[] | {sha: .sha[0:7], msg: .commit.message | split("\n")[0]}'
```

### Step 2 — Identify affected chapters

For each non-trivial commit, read its body and decide which chapters
(from §3) it touches. Ignore commits that only touch:

- Internal refactors that don't change public API
- Test files, CI, lint config
- `perf-monitor`, `cache-demo`, `blog-demo` infra experiments
- Contributor tooling

### Step 3 — Patch the chapters

Edit **only** the `docs/*.html` files for chapters affected. Rules:

- Keep existing structure — `<article>`, `<h1>`, `<h2>`, pager,
  `class="eyebrow"`, etc. The design system depends on these selectors.
- When in doubt, preserve wording; focus on factual accuracy.
- Import paths: functions like `getEmDashCollection`, `getEmDashEntry`,
  `getEntryTerms`, `getSiteSettings` all come from the **root**
  `"emdash"` package, not sub-paths. (This was a common mistake in
  earlier drafts.)
- Return shapes: `getEmDashCollection` returns
  `{ entries, error, cacheHint, nextCursor }` — never treat it as a
  bare array.

### Step 4 — Regenerate the search index and re-stamp assets

This step is **mandatory** after any chapter edit, because the search
index is pre-built and asset URLs are content-hash-stamped:

```bash
npm run build   # runs build-search-index + stamp-assets
```

### Step 5 — Test locally

```bash
npm run dev   # wrangler dev on http://localhost:8787
```

Verify:
- The chapter you edited renders cleanly
- ⌘K search finds any new terminology you introduced
- No console errors
- Light and dark themes both look right

### Step 6 — Update this file's pin table

At the bottom of §1, update the commit SHAs and dates to what you
diffed against. This is how the next update knows where to start.

### Step 7 — Ship

```bash
npm run deploy   # auto-runs predeploy (build) first
```

### Step 8 — Commit

```bash
git add -A
git commit -m "Update tutorial for emdash @ <short-sha> — <short summary of changes>"
git push
```

---

## 5. Quick lookups (copy-paste commands)

```bash
# Latest emdash release
gh api repos/emdash-cms/emdash/releases/latest --jq '{tag: .tag_name, date: .published_at}'

# Current main SHA
gh api repos/emdash-cms/emdash/commits/main --jq '.sha'

# See a specific source file at main
gh api repos/emdash-cms/emdash/contents/packages/core/src/index.ts --jq '.content' | base64 -d

# List templates in the templates repo
gh api repos/emdash-cms/templates/contents --jq '.[] | .name' | grep -v '\.md$'

# Grep tutorial for a term
grep -rn "getEmDashCollection" docs/
```

---

## 6. Things that are NOT sources of truth

Do not use these to decide what to update:

- **LLM training data.** Model weights can hallucinate API shapes.
  Always read the live `packages/core/src/index.ts`.
- **This tutorial's own text.** It's a view of upstream, not the
  upstream itself.
- **Third-party articles or StackOverflow.** Frequently outdated.
- **`emdash-tutorial.md` in this repo.** This is a legacy single-file
  copy kept for reference; the canonical docs are in `docs/*.html`.
  If you edit, edit the HTML files — do not touch the markdown.

---

## 7. When in doubt

File an issue on [this repo](https://github.com/maxali/emdash-tutorial/issues)
describing what you saw upstream and which chapter seems wrong. An
open issue with a link to the upstream commit is better than a guess.
