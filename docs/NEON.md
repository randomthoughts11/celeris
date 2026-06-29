# Neon + Vercel Setup

## 1. Vercel environment variables

If you connected Neon via Vercel, `DATABASE_URL` is set automatically.

You still need to add manually:

| Variable | How to get it |
|----------|----------------|
| `AUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://celeris.vercel.app` |

Do **not** set `NEXT_PUBLIC_DEMO_MODE` in production.

## 2. Run database migrations

In the [Neon SQL Editor](https://console.neon.tech):

1. Run `neon/migrations/001_initial_schema.sql`
2. Run `neon/seed.sql` (optional sample brands + metrics)

## 3. Create your admin account

1. Open your deployed app → **Sign up**
2. The **first registered user** automatically gets **God Mode**
3. Sign in and use the app with real Neon data

## 4. Redeploy

After adding `AUTH_SECRET`, trigger a redeploy on Vercel.

## Local development

```bash
cp .env.example .env.local
# Paste DATABASE_URL from Neon dashboard
# Set AUTH_SECRET
npm run dev
```

For local demo without Neon:

```bash
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

## What changed from Supabase

| Supabase | Neon stack |
|----------|------------|
| Supabase Auth | NextAuth (credentials) |
| Supabase client | `@neondatabase/serverless` |
| Row Level Security | App-layer RBAC in code |
| `auth.users` | `profiles` table with `password_hash` |
