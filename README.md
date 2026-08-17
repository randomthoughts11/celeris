# Agency OS (Celeris CRM)

AI-native CRM and operating system for digital marketing agencies. Built with Next.js, Clerk, Neon PostgreSQL, and a dark-first UI.

## Features

- **Company Hub** — Create clients, link Google/Meta ad accounts, health metrics
- **Executive Dashboard** — Operations, CRM metrics, goals
- **Google Ads & Meta Ads** — Campaign sync, Looker embeds, rule-based alerts
- **Social Media** — Cross-platform metrics from Meta-connected pages
- **Publish** — Shortcuts to native platform publishers (in-app scheduling is not included)
- **Lead Inbox** — Privyr-style workflow with call/WhatsApp quick actions
- **Privyr sync** — Per-company webhook tokens + CSV import
- **Board** — Kanban with create and status updates
- **Team Chat** — Company rooms and DMs with coworkers
- **Admin** — User approval, roles, company assignment
- **RBAC** — God Mode, Admin, Manager, Designer, Telecaller

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Auth | Clerk |
| Database | Neon PostgreSQL |
| Integrations | Google Ads, Meta Marketing API, Google Drive |
| Hosting | Vercel |

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, Clerk keys, integration credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires Clerk + Neon configured.

## Database migrations

```bash
node scripts/migrate.mjs
```

Migrations live in `neon/migrations/` (001–005).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (Vitest) |

## Documentation

- [Neon setup](docs/NEON.md)
- [Google Drive](docs/GOOGLE_DRIVE.md)
- [Developer Guide](docs/DEVELOPER.md)

Set `DEMO_MODE=true` only for local seed browsing without Clerk. Missing secrets do not open the app.

## License

Private — All rights reserved.
