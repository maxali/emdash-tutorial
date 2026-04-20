# EmDash: A Developer's Tutorial

**A friendly, end-to-end guide to the CMS that wants to replace WordPress — built on Astro and Cloudflare Workers.**

---

## Table of Contents

1. [What is emdash?](#1-what-is-emdash)
2. [How emdash works (the mental model)](#2-how-emdash-works-the-mental-model)
3. [Cloudflare in 10 minutes (for newcomers)](#3-cloudflare-in-10-minutes-for-newcomers)
4. [Astro in 10 minutes (and how emdash hooks into it)](#4-astro-in-10-minutes-and-how-emdash-hooks-into-it)
5. [Getting started: scaffold your first site](#5-getting-started-scaffold-your-first-site)
6. [Tour of a template](#6-tour-of-a-template)
7. [Modeling content in emdash](#7-modeling-content-in-emdash)
8. [Deploying to Cloudflare: step-by-step](#8-deploying-to-cloudflare-step-by-step)
9. [Plugins and extensibility](#9-plugins-and-extensibility)
10. [Troubleshooting and next steps](#10-troubleshooting-and-next-steps)

---

## 1. What is emdash?

**emdash** is an open-source, TypeScript-based content management system that Cloudflare released as a successor to WordPress. It is published under the MIT license and currently sits in beta preview.

The core thesis is spelled out by the Cloudflare team:

> "EmDash is committed to building on what WordPress created: an open source publishing stack that anyone can install and use at little cost, while fixing the core problems that WordPress cannot solve."

The specific WordPress problems it targets:

- **Security.** 96% of WordPress security vulnerabilities come from plugins. In WordPress, a plugin gets unrestricted access to the database and filesystem. In emdash, every plugin runs in an isolated V8 sandbox and can only do what its manifest explicitly permits.
- **Marketplace lock-in.** WordPress plugins are GPL-licensed and face a 2+ week review queue with 800+ plugins waiting. emdash is MIT, and plugin authors keep their own licensing.
- **Infrastructure waste.** WordPress needs always-on servers that can't scale to zero. emdash runs on Cloudflare Workers, which start in microseconds and cost nothing when idle.
- **An AI-native future.** emdash ships with a built-in MCP (Model Context Protocol) server so agents can read and write content natively — the CMS treats AI agents as first-class users, not scrapers.

**Key facts at a glance:**

| Attribute | Value |
|---|---|
| License | MIT |
| Language | TypeScript (end to end) |
| Frontend framework | Astro 6 |
| Admin UI | React 19 |
| Rich-text format | Portable Text (structured JSON, not HTML) |
| Database | Cloudflare D1 (SQLite) — PostgreSQL, Turso/libSQL, local SQLite also supported |
| Media storage | Cloudflare R2 — S3-compatible and local filesystem also supported |
| Sessions | Cloudflare KV (or Redis / file-based) |
| Runtime | Cloudflare Workers (primary) or Node.js (fallback) |
| Auth | Passkeys first, OAuth / magic links as fallbacks |
| Status | Beta preview (as of early 2026) |

---

## 2. How emdash works (the mental model)

emdash is **not** a single application — it's an Astro integration that you drop into an Astro project. When you install it and run your Astro site, emdash:

1. Mounts an admin panel at `/_emdash/admin` (React + TipTap editor).
2. Creates a database schema, runs migrations, and exposes a content API.
3. Registers an Astro live content collection called `_emdash` that your pages query.
4. Optionally starts a plugin sandbox runner powered by Cloudflare's Dynamic Workers.

Here's the picture:

```
┌──────────────────────── Your Astro Site ─────────────────────────┐
│                                                                  │
│   src/pages/              ← your public routes                   │
│       index.astro                                                │
│       posts/[slug].astro  ← calls getEmDashCollection("post")    │
│                                                                  │
│   src/live.config.ts      ← registers the emdash loader          │
│                                                                  │
│   astro.config.mjs        ← adds the emdash integration          │
│        + @astrojs/cloudflare adapter                             │
└──────────────────────────────┬───────────────────────────────────┘
                               │  at build & runtime
                               ▼
┌─────────────────────── emdash integration ───────────────────────┐
│                                                                  │
│   /_emdash/admin          React admin UI, passkey auth           │
│   /_emdash/api/*          Content, media, auth, setup endpoints  │
│                                                                  │
│   DB  → D1  (Kysely ORM)  posts, pages, media, users, schemas    │
│   R2  → MEDIA bucket       uploads, images                       │
│   KV  → SESSIONS namespace auth sessions                         │
│   Worker Loader → plugins  isolated V8 sandboxes (paid plan)     │
└──────────────────────────────────────────────────────────────────┘
```

**Three ideas to remember:**

- **Content lives in a relational DB, not in files.** Most Astro CMSes use markdown files in `src/content/`. emdash is different — your content is rows in D1 (or SQLite/Postgres), stored as Portable Text (structured JSON). The admin UI reads and writes these rows.
- **Your Astro pages consume content through a single "live" content collection.** You don't `getCollection("posts")` — you call `getEmDashCollection("posts")`, which queries the DB through emdash's loader.
- **Plugins are sandboxed.** This is the big architectural win over WordPress. A plugin can't read arbitrary files or hit arbitrary DB rows; it can only call the capabilities its manifest declared.

---

## 3. Cloudflare in 10 minutes (for newcomers)

emdash is Cloudflare-first. If you've never used Cloudflare, this section is for you.

### 3.1 Sign up

Go to [dash.cloudflare.com](https://dash.cloudflare.com) and create an account. **No credit card is required** for the free tier, which covers everything you need to try emdash:

- **Workers**: 100,000 requests/day
- **D1**: up to 10 databases, 500 MB each
- **KV**: 100k reads, 1k writes per day
- **R2**: 10 GB storage, **zero egress fees at every tier**

The only emdash feature that requires the $5/month Workers Paid plan is the sandboxed plugin system (it relies on Dynamic Workers / Worker Loader). You can turn plugins off and stay on the free tier.

### 3.2 Cloudflare Workers

A **Worker** is a function that runs on Cloudflare's global network. Unlike AWS Lambda (which uses containers and has 100–1000ms cold starts), Workers run inside **V8 isolates** — the same lightweight sandbox Chrome uses for browser tabs. Cold start: under 5 ms.

Hello world is one file:

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response("Hello from the edge!");
  }
};
```

No Express, no framework. `Request` and `Response` are standard Web APIs.

### 3.3 The Wrangler CLI

**Wrangler** is how you build, run, and deploy Workers. It's an npm package:

```bash
npm install -g wrangler
wrangler login          # opens a browser OAuth flow
```

Commands you'll use constantly:

| Command | What it does |
|---|---|
| `wrangler dev` | Local dev server (powered by `workerd`, the real runtime) |
| `wrangler deploy` | Pushes your Worker to Cloudflare's global network |
| `wrangler d1 create <name>` | Creates a D1 database and prints its ID |
| `wrangler r2 bucket create <name>` | Creates an R2 bucket |
| `wrangler kv namespace create <name>` | Creates a KV namespace |
| `wrangler secret put <KEY>` | Uploads an encrypted secret |

### 3.4 `wrangler.jsonc` — the project config

Every Worker project has a `wrangler.jsonc` (or `wrangler.toml`). For an emdash site on Cloudflare it looks roughly like this:

```jsonc
{
  "name": "my-emdash-site",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2026-04-20",
  "compatibility_flags": ["nodejs_compat"],

  "assets": { "binding": "ASSETS", "directory": "./dist" },

  "d1_databases": [
    { "binding": "DB", "database_name": "my-emdash-db", "database_id": "<paste-id-here>" }
  ],
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "my-emdash-media" }
  ],
  "kv_namespaces": [
    { "binding": "SESSIONS", "id": "<paste-id-here>" }
  ]
}
```

### 3.5 Bindings — the single biggest concept

A **binding** is how your Worker accesses Cloudflare services. You declare the relationship in `wrangler.jsonc`, and at runtime your code receives a ready-to-use client on the `env` object:

```ts
// env.DB        → D1 database client
// env.MEDIA     → R2 bucket client
// env.SESSIONS  → KV namespace client
```

There are **no connection strings and no API keys in your code**. The platform injects the credentials. You can't accidentally leak them in a log.

### 3.6 The three storage services at a glance

| Service | What it is | When to use |
|---|---|---|
| **D1** | SQLite at the edge, with read replicas | Relational data — posts, users, comments. This is emdash's primary store. |
| **R2** | S3-compatible object storage, no egress fees | Files — images, video, uploads. emdash stores media here. |
| **KV** | Eventually-consistent key-value store | Read-heavy, flat data — sessions, feature flags, config. |

Rule of thumb: **D1 for rows, R2 for files, KV for tokens and small config.**

### 3.7 Cloudflare Pages vs Workers (and the 2025 merge)

Cloudflare used to have two products: **Workers** for logic and **Pages** for static sites. In 2025 they converged into "Workers with static assets." One Worker can now both serve your static HTML and run your SSR code. emdash uses this model: your Astro site builds to `dist/`, Wrangler uploads both the Worker script and the static assets in a single deploy.

### 3.8 Local dev and Miniflare

`wrangler dev` runs your Worker locally using **workerd** — the exact same runtime Cloudflare uses in production. Local D1 becomes a local SQLite file, local R2 becomes a folder on disk, local KV is in-memory. You can develop fully offline, and behavior closely mirrors production.

---

## 4. Astro in 10 minutes (and how emdash hooks into it)

### 4.1 The Astro idea

Astro is a **content-first** framework with two big ideas:

1. **Zero JS by default.** Every component renders to plain HTML at build time. No client-side JavaScript ships unless you explicitly ask for it.
2. **Islands.** You opt into interactivity per-component with `client:*` directives:

```astro
<MyReactWidget />              {/* static — no JS */}
<MyReactWidget client:load />  {/* hydrated immediately */}
<MyReactWidget client:visible />  {/* hydrated when scrolled into view */}
```

Astro is framework-agnostic: React, Vue, Svelte, Preact, Solid, and plain `.astro` components mix freely.

### 4.2 Project layout

```
my-site/
├── src/
│   ├── pages/          # file-system routing — index.astro → /
│   ├── layouts/        # wrapper components
│   ├── components/     # reused building blocks
│   └── live.config.ts  # content collections (emdash wires up here)
├── public/             # static assets served as-is
├── astro.config.mjs    # integrations, adapter, output mode
└── package.json
```

Everything under `src/pages/` is a route. Nothing is routed unless it's in that folder.

### 4.3 Output modes

| `output` | Result |
|---|---|
| `'static'` (default) | Pre-built HTML — no server |
| `'server'` | A Worker + static assets — full SSR |
| `'hybrid'` | Per-page opt-in |

**All emdash templates use `output: 'server'`**, because the admin panel and content API require server-side code.

### 4.4 The Cloudflare adapter

`@astrojs/cloudflare` is what makes Astro SSR run on Workers. Minimal config:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
});
```

At runtime, the adapter exposes your Cloudflare bindings through `Astro.locals.runtime`:

```astro
---
const { env } = Astro.locals.runtime;
const post = await env.DB.prepare("SELECT * FROM posts WHERE slug = ?")
  .bind(Astro.params.slug)
  .first();
---
<h1>{post.title}</h1>
```

### 4.5 Where emdash plugs in

Two files:

**`astro.config.mjs`** — you register the emdash integration alongside the Cloudflare adapter:

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import emdash from 'emdash/astro';
import { cloudflareAdapter } from '@emdash-cms/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    emdash({
      adapter: cloudflareAdapter({
        db: 'DB',            // D1 binding name
        media: 'MEDIA',      // R2 binding name
        sessions: 'SESSIONS' // KV binding name
      }),
      plugins: [],
      marketplaceUrl: 'https://marketplace.emdashcms.com',
    }),
  ],
});
```

**`src/live.config.ts`** — you declare a live content collection that your pages will query:

```ts
import { defineLiveCollection } from 'astro:content';
import { emdashLoader } from 'emdash/loader';

const _emdash = defineLiveCollection({
  loader: emdashLoader(),
});

export const collections = { _emdash };
```

Then in any page:

```astro
---
import { getEmDashCollection, getEmDashEntry } from 'emdash/content';

const posts = await getEmDashCollection('post');
---
<ul>
  {posts.map(p => <li><a href={`/posts/${p.slug}`}>{p.data.title}</a></li>)}
</ul>
```

---

## 5. Getting started: scaffold your first site

### 5.1 Prerequisites

- **Node.js 22+**
- **pnpm 10+** (enable with `corepack enable`)
- A **Cloudflare account** (free tier is fine)
- **Wrangler**: `npm install -g wrangler && wrangler login`

### 5.2 Create a project

```bash
npm create emdash@latest
```

You'll be asked:

1. **A template** — `blog`, `marketing`, `portfolio`, `starter`, or `blank`.
2. **A deployment target** — `node` (local SQLite, for self-hosting) or `cloudflare` (D1 + R2 + KV, for the Cloudflare path).

Pick `blog` + `cloudflare` for this tutorial.

### 5.3 Bootstrap

```bash
cd my-site
pnpm install
pnpm bootstrap   # runs `emdash init && emdash seed`
pnpm dev
```

- `emdash init` creates the database schema and migrations.
- `emdash seed` loads starter content from `seed/seed.json`.
- `pnpm dev` starts Astro's dev server (which uses `workerd` under the hood when on the Cloudflare variant).

### 5.4 Open the admin

Visit **http://localhost:4321/_emdash/admin**.

On first visit, a setup wizard creates an admin account (passkey). If you want to skip passkey setup during local dev, hit:

```
http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
```

Your public site is at **http://localhost:4321/** — edit a post in the admin, refresh the homepage, see it update.

---

## 6. Tour of a template

All five emdash templates (`blog`, `marketing`, `portfolio`, `starter`, `blank`) ship in two flavors: a Node.js variant and a `-cloudflare` variant. They share this structure:

```
my-blog/
├── src/
│   ├── components/       # reusable UI (PostCard, Header, Footer)
│   ├── layouts/          # BaseLayout.astro
│   ├── pages/            # public routes
│   │   ├── index.astro
│   │   ├── posts/[slug].astro
│   │   ├── category/[slug].astro
│   │   ├── tag/[slug].astro
│   │   ├── search.astro
│   │   ├── rss.xml.ts
│   │   └── 404.astro
│   ├── styles/
│   ├── utils/
│   └── live.config.ts    # emdash content collection hookup
├── seed/
│   └── seed.json         # initial content loaded by `emdash seed`
├── astro.config.mjs
├── wrangler.jsonc        # only in -cloudflare variants
├── package.json
└── tsconfig.json
```

### 6.1 The five templates in one table

| Template | Best for | Notable pages |
|---|---|---|
| **blog** | Full blog with search, RSS, categories/tags, dark mode | `posts/`, `category/`, `tag/`, `search.astro`, `rss.xml.ts` |
| **marketing** | Landing site with hero, pricing, FAQ, contact form | `index.astro`, `pricing.astro`, `contact.astro` |
| **portfolio** | Creative showcase with project grid, case studies | `work/`, `about.astro`, `contact.astro` |
| **starter** | Minimal foundation to build on | `index.astro`, `[slug].astro`, `posts/` |
| **blank** | Empty canvas — only wires emdash up | just `index.astro` |

### 6.2 Node vs Cloudflare variants

The only differences:

| Concern | Node variant | Cloudflare variant |
|---|---|---|
| Adapter | `@astrojs/node` | `@astrojs/cloudflare` |
| DB | `better-sqlite3` → `./data.db` | D1 via `DB` binding |
| Media | local `./uploads/` folder | R2 via `MEDIA` binding |
| Deploy | `node ./dist/server/entry.mjs` | `wrangler deploy` |
| Extra dep | — | `@emdash-cms/cloudflare`, `@cloudflare/workers-types` |

### 6.3 A page walk-through

Here's what a real post page in the `blog` template looks like:

```astro
---
// src/pages/posts/[slug].astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getEmDashEntry, getEmDashCollection } from 'emdash/content';

export async function getStaticPaths() {
  const posts = await getEmDashCollection('post');
  return posts.map(p => ({ params: { slug: p.slug } }));
}

const { slug } = Astro.params;
const post = await getEmDashEntry('post', slug);

if (!post) return Astro.redirect('/404');
---
<BaseLayout title={post.data.title}>
  <article>
    <h1>{post.data.title}</h1>
    <time>{post.data.publishedAt}</time>
    <div set:html={post.renderedHtml} />
  </article>
</BaseLayout>
```

Two things to notice:

- `getEmDashCollection` / `getEmDashEntry` are the primary API you'll use.
- Content is stored as Portable Text but rendered to HTML by the loader, so you can use `set:html` or (better) a typed component renderer for richer control.

---

## 7. Modeling content in emdash

In emdash, you don't hard-code content types in TypeScript schemas. You define them **through the admin UI**.

### 7.1 Creating a content type

1. Go to `/_emdash/admin` → **Schemas** → **New Schema**.
2. Name it (e.g. `product`).
3. Add fields — each field has a type (text, number, boolean, rich text, reference, image, etc.) and options (required, default, validation).
4. Save.

emdash creates the DB tables and exposes the new type through the API automatically.

### 7.2 Regenerating TypeScript types

Whenever you change a schema, run:

```bash
npx emdash types
```

This regenerates the type definitions so `getEmDashCollection('product')` is fully typed in your editor.

### 7.3 The Portable Text format

Rich-text fields store **Portable Text** — a structured JSON array, not HTML. That means:

- No broken HTML from a user paste.
- You can render the same content to different frontends (web, mobile, voice).
- You can traverse the tree and apply custom behavior (e.g. auto-linking mentions).

You usually don't interact with the raw JSON; the loader renders it for you. But when you need custom rendering, the tree is yours.

### 7.4 Querying content from your pages

Top-level helpers you'll reach for most often:

```ts
import {
  getEmDashCollection,
  getEmDashEntry,
} from 'emdash/content';

// All entries of a type
const allPosts = await getEmDashCollection('post');

// Filtered
const published = await getEmDashCollection('post', {
  filter: { status: 'published' },
  sort: { publishedAt: 'desc' },
  limit: 10,
});

// One entry
const post = await getEmDashEntry('post', 'my-slug');
```

---

## 8. Deploying to Cloudflare: step-by-step

Assuming you chose the `-cloudflare` variant of a template.

### 8.1 Create the Cloudflare resources

You need a D1 database, an R2 bucket, and a KV namespace.

```bash
# From inside your project directory
wrangler d1 create my-emdash-db
# → copy the database_id it prints

wrangler r2 bucket create my-emdash-media

wrangler kv namespace create SESSIONS
# → copy the id it prints
```

### 8.2 Wire up `wrangler.jsonc`

Open `wrangler.jsonc` and paste the IDs into the respective bindings:

```jsonc
{
  "name": "my-emdash-site",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2026-04-20",
  "compatibility_flags": ["nodejs_compat"],

  "assets": { "binding": "ASSETS", "directory": "./dist" },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-emdash-db",
      "database_id": "<paste-d1-id>"
    }
  ],
  "r2_buckets": [
    { "binding": "MEDIA", "bucket_name": "my-emdash-media" }
  ],
  "kv_namespaces": [
    { "binding": "SESSIONS", "id": "<paste-kv-id>" }
  ]

  // If you are on the free plan, remove or comment out any
  // "worker_loaders" block — it requires the Workers Paid plan.
}
```

### 8.3 Run migrations against production D1

```bash
pnpm emdash init --remote    # creates schema in your real D1 database
pnpm emdash seed --remote    # optional: loads seed content
```

### 8.4 Deploy

```bash
pnpm deploy
```

Under the hood this runs `astro build` and then `wrangler deploy`. Within seconds your site is live on `*.workers.dev` (or your custom domain if configured). Wrangler prints the URL.

### 8.5 Set up the admin account in production

Visit `https://<your-worker>.workers.dev/_emdash/admin`. The setup wizard runs once, you register a passkey, and you're the admin.

### 8.6 Optional: protect the admin with Cloudflare Access

If you want zero-trust SSO on top of emdash's built-in auth:

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications → Add application**.
2. Create a **Self-hosted application** with path `/_emdash/*`.
3. Add a policy, e.g. "Emails matching `*@yourcompany.com`".
4. Pick an identity provider (GitHub, Google, one-time PIN).

Now only authorized users even reach the admin URL.

---

## 9. Plugins and extensibility

### 9.1 The sandbox model

This is emdash's flagship architectural choice. Every plugin runs inside its own V8 isolate (a **Dynamic Worker**). A plugin declares a **capability manifest** up front:

```json
{
  "name": "my-notifier",
  "capabilities": [
    "read:content.post",
    "network:send",
    "email:send"
  ]
}
```

The runtime enforces those capabilities. A plugin that didn't declare `write:content.page` cannot write to pages — not in a sneaky way, not ever. Compare to WordPress, where any plugin can `DROP TABLE users`.

### 9.2 First-party plugins

A few ship out of the box:

- `@emdash-cms/plugin-forms` — form submissions (included with the `blog-cloudflare` template).
- `@emdash-cms/plugin-webhook-notifier` — fire webhooks on content events.
- `@emdash-cms/plugin-audit-log` — track admin actions.

### 9.3 Free-tier note

Plugins use Cloudflare's Dynamic Workers / Worker Loader, which requires the **Workers Paid plan ($5/month)**. On the free plan, comment out the `worker_loaders` block in `wrangler.jsonc` and skip plugins. Everything else still works.

### 9.4 The MCP server

emdash exposes an MCP (Model Context Protocol) server, which means Claude Code, Cursor, and any MCP-compatible agent can read and write content directly — create posts, update schemas, upload media — through authenticated tool calls. This is the "AI-native" angle: your CMS talks the same protocol your coding agents do.

---

## 10. Troubleshooting and next steps

### Common gotchas

- **"emdash init fails locally."** Make sure you're on Node 22+ and pnpm 10+. `corepack enable` handles pnpm.
- **"Admin is blank on Cloudflare."** Check that `compatibility_flags` includes `"nodejs_compat"`.
- **"D1 migrations don't apply to production."** You need `--remote` on `emdash init` and `emdash seed`, or they run against your local SQLite.
- **"Plugins won't load."** You're probably on the free plan. Remove the `worker_loaders` block.
- **"Types are out of sync after schema changes."** Run `npx emdash types`.

### Further reading

- **Cloudflare blog announcement:** https://blog.cloudflare.com/emdash-wordpress/
- **emdash on GitHub:** https://github.com/emdash-cms/emdash
- **Templates repo:** https://github.com/emdash-cms/templates
- **Marketing site & live playground:** https://emdashcms.com
- **Astro docs:** https://docs.astro.build
- **Cloudflare Workers docs:** https://developers.cloudflare.com/workers
- **`@astrojs/cloudflare` adapter:** https://docs.astro.build/en/guides/integrations-guide/cloudflare/

### A suggested learning path

1. **Day 1.** Scaffold the blog template with the Cloudflare variant. Run it locally. Create a post in the admin. Change a layout.
2. **Day 2.** Deploy to Cloudflare. Wire up your own domain. Protect `/_emdash/*` with Cloudflare Access.
3. **Day 3.** Define a new content type (e.g. `project`) in the admin. Generate types. Build a new page that queries it.
4. **Day 4.** Pick a first-party plugin (forms or webhooks), enable it on the Paid plan, and wire it into a page.
5. **Day 5.** Connect the MCP server to Claude Code and try authoring a post entirely through an agent.

---

**That's the whole surface.** emdash is a small idea executed carefully: an Astro integration + a sandbox-first plugin model + the Cloudflare primitives that make "scale-to-zero publishing" real. Once you have the five files in your head — `astro.config.mjs`, `src/live.config.ts`, `wrangler.jsonc`, `seed/seed.json`, and any `src/pages/*.astro` — you can bend it to whatever content shape your project needs.
