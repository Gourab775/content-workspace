# Content Creator Studio

Professional full-stack workspace for research-driven content development, structured outlining, streaming publishing, and search optimization with persistent preferences and versioned history.

**Live Demo:** https://gourab775.github.io/content-creator-agent

**Category:** Content & Publishing

**Stack:** Next.js 16 · TypeScript · Workflow Engine · State Workflow · Platform Services

## Overview

Content Creator Studio orchestrates a complete editorial workflow — from topic discovery to polished publication — through a multi-stage service pipeline. The workspace integrates background research, hierarchical outlining, and streaming document generation with style-aware preferences, search optimization tools, and versioned storage for reliable editorial operations at scale.

Built for teams and individual creators who need enterprise-grade reliability, extensibility, and deployment readiness on modern full-stack infrastructure.

## Features

- **Topic Research Service** — Gathers background material once per request to inform outline and draft quality.
- **Structured Outlining** — Generates hierarchical outlines with primary and secondary sections tailored to target length and tone.
- **Streaming Document Generation** — Produces complete articles in a single streaming run with word-count targets and style adherence.
- **Search Optimization & Keyword Tools** — Dedicated services for on-page optimization and keyword recommendations.
- **Persistent Preferences & Version History** — Tracks user preferences (style, length, tone, recent topics) across sessions and stores each publication as a versioned record.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS, TypeScript |
| Workflow | Workflow Engine, State Workflow |
| Services | Platform Services (model gateway, search integration) |
| Persistence | Cloud Functions (articles, preferences), message-scoped storage |
| Deployment | EdgeOne / GitHub Pages, Node.js 18+ |

## Project Structure

```
content-creator-agent/
├── services/
│   ├── create.ts           # POST /create — full publication with preferences
│   ├── create-lite.ts      # POST /create-lite — lightweight mode
│   ├── outline.ts          # POST /outline — structured outline generation
│   ├── refine.ts           # POST /refine — document polishing
│   ├── research.ts         # POST /research — topic background research
│   ├── optimize.ts         # POST /optimize — search optimization
│   ├── suggest-keywords.ts # POST /suggest-keywords
│   ├── stop.ts             # POST /stop — abort active run
│   └── _shared.ts          # Model init, env validation, SSE helpers
├── cloud-functions/
│   ├── articles/           # Versioned article persistence
│   ├── preferences/        # User preference storage
│   ├── health/             # GET /health
│   └── _logger.ts
├── app/                    # Next.js App Router frontend
├── lib/
│   └── i18n.tsx            # Internationalization (EN / ZH)
├── components/             # Reusable UI components
└── edgeone.json            # Deployment configuration
```

> `services/` corresponds to the former `agents/` directory and is used as the canonical service folder throughout this workspace.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVICE_API_KEY` | Yes | Platform gateway API key (OpenAI-compatible). |
| `SERVICE_BASE_URL` | Yes | Gateway base URL, e.g. `https://ai-gateway.edgeone.link/v1` |
| `SERVICE_MODEL` | No | Model identifier. Defaults to `@makers/deepseek-v4-flash` |
| `WSA_API_KEY` | No | Search provider key for background research |

> Note: `SERVICE_*` is an alias for `AI_GATEWAY_*` for backward compatibility.

### Development

```bash
npm run dev
# or with EdgeOne CLI
# edgeone makers dev
```

Open http://localhost:3000

Observability dashboard (when using EdgeOne CLI): http://localhost:8088/agent-metrics

### Build

```bash
npm run build
npm start
```

## Deployment

### EdgeOne Makers

Configured via `edgeone.json`:

- `buildCommand`: `npm run build`
- `outputDirectory`: `.next`
- `framework`: `nextjs`
- `services.framework`: `workflow`

Deploy via EdgeOne console or CLI. Bind `SERVICE_*` variables in the deployment environment.

### GitHub Pages / Static Hosting

The frontend is a standard Next.js application. For static export, configure `next.config.mjs` accordingly and deploy the build output to GitHub Pages or any Node-compatible host.

Live Demo deployment: https://gourab775.github.io/content-creator-agent

## Customization

- **Styling:** Tailwind configuration in `tailwind.config.ts` and global styles in `app/globals.css`. Update theme tokens and component styles to match brand guidelines.
- **Workflow Logic:** Service handlers in `services/` define request validation, research, outlining, and generation steps. Extend or replace handlers to add new endpoints.
- **Persistence:** Cloud functions under `cloud-functions/` manage versioning and preferences. Swap adapters to integrate external databases or CMS platforms.
- **Internationalization:** Edit `lib/i18n.tsx` to add locales or adjust copy.
- **Search Integration:** Configure `WSA_API_KEY` or replace the search provider in `services/_shared.ts`.

## License

MIT
