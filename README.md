# emdash — an editorial developer tutorial

A static-site tutorial for the [emdash CMS](https://github.com/emdash-cms/emdash), deployable to Cloudflare Workers with static assets. No build step, no framework — just HTML, CSS, and a small vanilla JS enhancement layer.

## What's in this repo

```
.
├── docs/                     # the site (HTML, CSS, JS)
│   ├── index.html            # landing / table of contents
│   ├── 01-*.html … 14-*.html # the 14 chapters
│   ├── 404.html              # styled not-found page
│   ├── styles.css            # editorial design system
│   ├── docs.js               # topbar, sidebar, search, TOC, copy buttons
│   └── search-index.js       # pre-built full-text search index
├── scripts/
│   └── build-search-index.mjs  # regenerates docs/search-index.js
├── wrangler.jsonc            # Cloudflare deploy config
├── package.json
└── emdash-tutorial.md        # single-file markdown version of the tutorial
```

## Local preview

Any static file server works. Zero-install option:

```bash
npx http-server docs -p 4321
# open http://localhost:4321
```

Or just open `docs/index.html` directly — `file://` works for everything except the rare cross-origin fetch (which this site doesn't need).

## Deploy to Cloudflare

### One-time setup

1. Create a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com) — no credit card needed.
2. Install the CLI: `npm install` (installs `wrangler` as a dev dep) — or install globally with `npm install -g wrangler`.
3. Log in: `npx wrangler login` — opens a browser OAuth flow.

### Ship it

```bash
npm run deploy
```

That's it. Wrangler uploads `docs/` and prints a URL like `https://emdash-tutorial.<your-subdomain>.workers.dev`.

### Local development against the real runtime

```bash
npm run dev
```

Runs `workerd` (the same V8 runtime Cloudflare uses in production) locally and serves the site at `http://localhost:8787`.

## Custom domain

After the first deploy, in the Cloudflare dashboard:

1. Open **Workers & Pages → emdash-tutorial → Settings → Domains & Routes**.
2. Click **Add → Custom Domain** and enter your domain.
3. Cloudflare issues the TLS certificate automatically if the domain is on Cloudflare DNS.

## Updating content

After editing any chapter HTML:

```bash
npm run build-index   # regenerates docs/search-index.js
npm run deploy        # ships it
```

`build-index` re-parses every chapter and rebuilds the search index so the ⌘K modal stays accurate.

## How the deploy works

`wrangler.jsonc` declares `docs/` as the static asset directory with no Worker script. Cloudflare serves the files directly from its global edge cache — there is no cold start, no server logic, and no runtime cost beyond the Workers free tier (100 k requests/day).

`html_handling: "auto-trailing-slash"` means `/08-adding-pages` resolves to `08-adding-pages.html` automatically, so links in the wild stay clean.

`not_found_handling: "404-page"` serves the styled `docs/404.html` for unknown paths.

## License

MIT.
