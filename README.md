# Agency OS

AI-native CRM and operating system for digital marketing agencies. Built with Next.js, Supabase, and a premium dark-first design.

## Features

- **Company Hub** — Clean homepage with brand cards showing health, spend, leads, and campaign status
- **Executive Dashboard** — Revenue, ROAS, CPL, CPA, goals, and performance trends
- **Google Ads & Meta Ads** — Campaign monitoring, budgets, and AI recommendations
- **Social Media** — Cross-platform metrics for Facebook, Instagram, LinkedIn, X, YouTube
- **Social Scheduler** — Draft, AI captions, schedule, approve, multi-platform publishing
- **Lead Management** — Privyr-inspired workflow with timeline, scoring, and SLA tracking
- **Task Management** — Kanban board with types, priorities, and deadlines
- **RingCentral** — Call analytics, recordings, and agent performance
- **AI Insights** — Actionable recommendations with explanations on every dashboard
- **RBAC** — God Mode, Manager, Designer, Telecaller, Admin roles with RLS

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Backend | Next.js Server Actions, Supabase |
| Database | PostgreSQL (Supabase) with Row Level Security |
| Auth | Supabase Auth |
| Hosting | Vercel |

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add Supabase credentials (optional for demo mode)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase configured, the app runs in **demo mode** with sample data.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations from `supabase/migrations/`
3. Run `supabase/seed.sql` for sample data
4. Add credentials to `.env.local`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Developer Guide](docs/DEVELOPER.md)

## License

Private — All rights reserved.
