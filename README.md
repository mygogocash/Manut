<div align="center">

# Manut

**AI-powered knowledge base. Agents, avatars, and Vertex AI on top of AFFiNE.**

[Live demo](https://manut.gogocash.co) · [Issues](https://github.com/mygogocash/Manut/issues) · [Upstream AFFiNE](https://github.com/toeverything/AFFiNE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.94+-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## What is Manut

Manut is GoGoCash's fork of [AFFiNE](https://github.com/toeverything/AFFiNE) 0.26.3 — a privacy-first, open-source workspace where docs, whiteboards, and tables hyper-merge into one canvas. On top of upstream AFFiNE, Manut adds:

- **Agents (Beta)** — Notion-style agents in the sidebar, Perplexity-style agent detail page. Per-agent description, instructions, files, skills, links, and sub-agents that report up.
- **Picrew-style avatars** — 8-tab 2D character builder (Hair · Accessory · Eyes · Brow · Mouth · Facial Hair · Clothes · Skin) for AI agents, persisted as JSONB.
- **Vertex AI integration** — Anthropic Claude + Google Gemini through one service account. The URL builder now includes the `/projects/{project}/locations/{location}` prefix (fixes `RESOURCE_PROJECT_INVALID`).
- **Self-host AI unlock** — model picker no longer locks Pro models on self-hosted instances. No subscription gate on `setModel`.
- **Notion-style chat composer** — suggested prompts render in a grid _below_ the chat input, not stacked above.
- **Slash menu fix** — `affine:note` no longer crashes the slash menu with a duplicate-id error (`addFactory({ override: true })`).
- **Native binary rebuild** — `server-native.x64.node` rebuilt with full LLM dispatch (`llm_dispatch_stream`) for AI streaming.

## Live demo

[https://manut.gogocash.co](https://manut.gogocash.co)

## Tech stack

| Layer        | Tech                                                            |
| ------------ | --------------------------------------------------------------- |
| **Frontend** | React 19 · BlockSuite · Lit · vanilla-extract · rspack          |
| **Backend**  | NestJS · GraphQL · Prisma · PostgreSQL · Redis                  |
| **AI**       | Vertex AI (Anthropic Claude + Google Gemini) · Manticore search |
| **Native**   | Rust 1.94 + napi-rs (`server-native.{x64,arm64}.node`)          |
| **Infra**    | Docker buildx (linux/amd64) · GCE · Caddy · Cloudflare          |

## Self-host with Docker

```yaml
# compose.yml — minimal
services:
  affine_server:
    image: asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.8.0
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgres://affine:affine@postgres:5432/affine
      REDIS_SERVER_HOST: redis
      AFFINE_CONFIG_PATH: /root/.affine/config
    volumes:
      - ./config:/root/.affine/config
    ports:
      - '3010:3010'

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: affine
      POSTGRES_PASSWORD: affine
      POSTGRES_DB: affine
    volumes:
      - ./pg-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
```

For the full reference compose (with Caddy reverse proxy + Vertex config), see [`.docker/gogocash/`](.docker/gogocash/).

### Vertex AI configuration

Drop a service-account JSON at `./config/affine-config/google-auth.json` and set in `config.json`:

```json
{
  "copilot": {
    "providers": {
      "geminiVertex": { "project": "your-gcp-project", "location": "us-central1" },
      "anthropicVertex": { "project": "your-gcp-project", "location": "us-east5" }
    }
  }
}
```

## Build from source

```bash
# Prereqs: Node 22, Yarn 4.13, Rust 1.94+, Docker, pkg-config, openssl
git clone https://github.com/mygogocash/Manut.git
cd Manut

corepack enable
yarn install
yarn affine init
yarn build

# Build the linux/amd64 image
docker buildx build --platform linux/amd64 \
  --no-cache \
  -f .docker/gogocash/Dockerfile.fullstack \
  -t manut:local .
```

The Dockerfile expects pre-built artifacts:

- `packages/backend/server/dist/main.js`
- `packages/backend/server/dist/server-native.{x64,arm64,armv7}.node`
- `packages/frontend/apps/web/dist/`
- `packages/frontend/admin/dist/`
- `packages/frontend/apps/mobile/dist/`

Run `yarn build` (or the relevant per-package build) to produce these before `docker buildx build`.

## What's NOT changed from upstream

Manut tracks upstream AFFiNE closely. Untouched areas include:

- BlockSuite editor + whiteboard core
- Workspace sync (Y.js / WebRTC)
- All upstream block types (text, code, image, attachment, embed, database, etc.)
- Auth flow + OAuth providers
- Mobile app

## Repo layout

```
.
├── packages/
│   ├── backend/
│   │   ├── server/        ← NestJS + Prisma + GraphQL
│   │   └── native/        ← Rust napi-rs (server-native.*.node)
│   └── frontend/
│       ├── apps/
│       │   ├── web/       ← Main desktop SPA
│       │   ├── mobile/    ← Mobile bundle
│       │   └── electron/  ← Desktop app
│       ├── admin/         ← Admin panel
│       └── core/          ← Shared modules (agents/, ai-button/, blocksuite/...)
├── blocksuite/            ← BlockSuite editor (vendored, modified)
├── tools/                 ← Build / CI / dev scripts
└── .docker/gogocash/      ← Manut Docker recipes
```

## Roadmap

- [ ] ARM64 native binary (currently x64-only — `ring` crate cross-compile blocker)
- [ ] Migrate the Picrew avatar picker to use server-side rendering for SEO
- [ ] Agent → Skills marketplace (per-skill schema + sandbox)
- [ ] Sub-agent execution graph (DAG + per-step audit trail)
- [ ] Hosted multi-tenant deployment

## Credits

Manut stands on the shoulders of [AFFiNE](https://github.com/toeverything/AFFiNE) by [toeverything](https://github.com/toeverything). All upstream features and contributors are credited there. We rebase on upstream regularly and keep the diff minimal.

Avatar rendering uses [`avataaars@2.0.0`](https://github.com/fangpenlin/avataaars) (MIT).

## License

MIT — same as upstream AFFiNE. See [LICENSE](LICENSE).
