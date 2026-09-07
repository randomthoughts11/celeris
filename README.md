# Vande AI CRM

AI-native multi-brand CRM built on the Agency OS stack (Next.js, Clerk, Neon PostgreSQL, dark-first UI).

## Features

### Core CRM
- **Brands (companies)** with multi-branch locations
- **Lead inbox & sales pipeline** with stages, follow-ups, activity timeline
- **Customers** (converted won leads + manual entry) with attribution
- **Manual call logging** + RingCentral webhooks
- **Board / Deck** kanban, tasks, Drive, team chat, vault

### AI Calling (ElevenLabs)
- Outbound AI calls, inbound webhook tracking, transcripts, scoring, transfer to human
- AI vs human performance dashboard (`/ai-performance`)

### Booking & conversion (Wix + Twilio)
- Appointments, booking/payment links, SMS notifications, website conversion events

### Marketing
- Google Ads & Meta Ads sync (campaign + Meta ad set/ad depth)
- Attribution links (campaign → lead/customer → revenue)
- Branch-level marketing performance

### Messaging
- Unified inbox (`/inbox` + brand Messages): website chat, email, Meta DMs
- AI reply suggestions (OpenAI-compatible)

### Knowledge & automations
- Knowledge base / playbooks / objection library
- Automation rules, follow-up sequences, appointment reminders, missed-call hooks
- Webhook endpoint management + cron `/api/cron/automations`

### Dashboards & admin
- Personalized widget layout builder (brand + global)
- Roles: God Mode, Admin, Manager, Designer, Salesperson, Telecaller
- Custom fields, audit log surface, integration status in Settings

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Auth | Clerk |
| Database | Neon PostgreSQL |
| Integrations | Google Ads, Meta, Drive, ElevenLabs, Wix, Twilio, Resend/OpenAI |
| Hosting | Vercel |

## Quick Start

```bash
npm install
# Fill DATABASE_URL + Clerk keys in .env (see commented groups for new integrations)
npm run dev
```

Apply DB migrations:

```bash
node scripts/migrate.mjs          # 001-005
node scripts/apply-006.mjs …      # through
node scripts/apply-012.mjs        # Vande AI CRM schema
```

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

## License

Private - All rights reserved.
