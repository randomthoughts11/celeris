# Database Schema

PostgreSQL database hosted on Supabase. Migrations in `supabase/migrations/`.

## Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `user_roles` | RBAC role assignments |
| `companies` | Client brands |
| `company_members` | User-company access |
| `company_metrics` | Cached KPIs (updated by sync jobs) |

## CRM Tables

| Table | Purpose |
|-------|---------|
| `leads` | Lead records with scoring |
| `lead_activities` | Timeline events |
| `tasks` | Task management |
| `task_comments` | Task discussions |
| `notifications` | Real-time alerts |

## Marketing Tables

| Table | Purpose |
|-------|---------|
| `google_ads_campaigns` | Google Ads data |
| `meta_ads_campaigns` | Meta Ads data |
| `social_accounts` | Connected platforms |
| `social_metrics` | Platform metrics snapshots |
| `social_posts` | Scheduler content |
| `ringcentral_calls` | Call records |
| `performance_snapshots` | Daily trend data |
| `ai_insights` | Generated recommendations |

## System Tables

| Table | Purpose |
|-------|---------|
| `integrations` | Encrypted API credentials |
| `audit_logs` | Security audit trail |

## RLS Policies

All tables have Row Level Security enabled. Key helpers:

- `is_god_mode(uid)` — Full access
- `can_access_company(uid, cid)` — Company membership check
- `can_view_financials(uid)` — Blocks designer/telecaller from financial data

## Indexes

Optimized indexes on foreign keys, status fields, and date columns for leads, tasks, notifications, and campaigns.

## Migrations

```bash
# Apply via Supabase CLI
supabase db push

# Or run SQL files manually in Supabase SQL Editor
```
