# Architecture

## Overview

Agency OS follows a **feature-folder** architecture with clear separation between UI, data access, and business logic.

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated routes
│   ├── (auth)/             # Login / signup
│   └── auth/callback/      # OAuth callback
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # App shell, navigation
│   ├── companies/          # Company cards
│   ├── dashboard/          # Metrics, charts
│   ├── leads/              # Lead list, timeline
│   ├── tasks/              # Kanban board
│   ├── social/             # Social dashboard
│   ├── scheduler/          # Post scheduler
│   └── ai/                 # AI insights panel
├── features/               # Feature modules
│   ├── companies/          # Queries, data access
│   └── scheduler/          # Server actions
├── lib/                    # Core utilities
│   ├── supabase/           # DB clients
│   ├── auth/               # Session management
│   ├── rbac/               # Permissions
│   ├── integrations/       # API adapters
│   ├── ai/                 # Insights engine
│   └── demo/               # Demo data store
└── types/                  # TypeScript definitions
```

## Data Flow

1. **Server Components** fetch data via feature queries
2. **Server Actions** handle mutations with Zod validation
3. **Supabase RLS** enforces row-level permissions
4. **Demo mode** falls back to in-memory data when Supabase is unconfigured

## Security

- Row Level Security on all tables
- Role-based access via `user_roles` and helper functions
- Middleware session refresh for Supabase Auth
- Encrypted integration credentials in `integrations` table
- Audit logs for admin/god_mode roles

## Integrations

Adapter pattern in `src/lib/integrations/adapters.ts`:

- `GoogleAdsAdapter` — Campaign sync
- `MetaAdsAdapter` — Campaign/ad set sync
- `RingCentralAdapter` — Call sync + webhooks
- `SocialAdapter` — Metrics + publishing

Replace placeholder implementations with real API clients when credentials are available.

## Deployment

- **Vercel** — Automatic deploys from GitHub
- **Supabase** — Managed PostgreSQL + Auth
- Environment variables via Vercel project settings
