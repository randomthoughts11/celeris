# Neon + Vercel Setup

## 1. Vercel environment variables

If you connected Neon via Vercel, `DATABASE_URL` is set automatically.

Add Clerk keys from the [Clerk Dashboard](https://dashboard.clerk.com/) (application `app_3FoOmmRJiEUWMFrwuVuMOAu2YNY`):

| Variable | How to get it |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/signup` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://celeris-bice.vercel.app` |

Do **not** set `NEXT_PUBLIC_DEMO_MODE` in production.

## 2. Run database migrations

In the [Neon SQL Editor](https://console.neon.tech):

1. Run `neon/migrations/001_initial_schema.sql`
2. Run `neon/migrations/002_google_drive.sql`
3. Run `neon/migrations/003_clerk.sql`
4. Run `neon/seed.sql` (optional sample brands + metrics)

## 3. Create your admin account

1. Open your deployed app → **Sign up** at `/signup`
2. The **first registered user** automatically gets **God Mode**
3. Sign in and use the app with real Neon data

## 4. Redeploy

After adding Clerk keys, trigger a redeploy on Vercel.

## Local development

```bash
cp .env.example .env.local
# Paste DATABASE_URL from Neon dashboard
# Paste Clerk keys from Clerk dashboard
npm run dev
```

For local demo without the database and Clerk:

```bash
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

## Stack

| Layer | Technology |
|-------|------------|
| Auth | Clerk (`@clerk/nextjs`) |
| Database | Neon PostgreSQL |
| ORM / queries | `@neondatabase/serverless` |
| RBAC | App-layer roles in `user_roles` |
