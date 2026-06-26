# Developer Guide

## Prerequisites

- Node.js 20+
- npm
- Supabase account (optional for demo mode)

## Local Development

```bash
git clone <repo>
cd agency-crm
npm install
cp .env.example .env.local
npm run dev
```

## Project Conventions

### File Naming

- Components: `kebab-case.tsx`
- Server actions: `actions.ts` in feature folders
- Queries: `queries.ts` or `company-data.ts`

### Adding a Feature

1. Add types to `src/types/index.ts`
2. Add migration if new tables needed
3. Create queries in `src/features/<name>/`
4. Build UI in `src/components/<name>/`
5. Add route in `src/app/(app)/`

### Adding shadcn Components

```bash
npx shadcn@latest add <component>
```

### RBAC

Check permissions with helpers from `src/lib/rbac/permissions.ts`:

```typescript
import { hasPermission, canViewFinancials } from "@/lib/rbac/permissions";

if (!canViewFinancials(user.roles)) {
  // hide financial data
}
```

### Server Actions

Place in `src/features/<module>/actions.ts` with `"use server"` directive. Validate inputs with Zod.

## Testing

```bash
npm run test          # Unit tests
npm run test:e2e      # Playwright E2E
npm run typecheck     # TypeScript
npm run lint          # ESLint
```

## Code Quality

- Strict TypeScript
- ESLint via `eslint-config-next`
- Feature-folder organization
- Server Components by default, Client Components only when needed
