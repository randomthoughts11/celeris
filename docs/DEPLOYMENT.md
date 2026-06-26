# Deployment Guide

## Vercel

1. Push repository to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variables from `.env.example`
4. Deploy — builds run automatically on every push

## Environment Variables

Required for production:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Optional integrations:

```
GOOGLE_ADS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET
META_APP_ID
META_APP_SECRET
RINGCENTRAL_CLIENT_ID
RINGCENTRAL_CLIENT_SECRET
OPENAI_API_KEY
```

## Supabase

1. Create production project
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_row_level_security.sql`
4. Optionally run `supabase/seed.sql`
5. Enable email auth in Authentication settings
6. Add Vercel URL to redirect URLs

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

- Type check
- Lint
- Build
- Unit tests

## Demo Mode

Without Supabase credentials, the app runs with in-memory demo data. Suitable for previews but not production.
