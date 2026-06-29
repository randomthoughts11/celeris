# Google Drive + Neon Storage

Agency OS uses **Neon** for metadata and **Google Drive** for files.

## Architecture

```
Upload → /api/drive/upload → Google Drive API → client folder
                          → Neon drive_files table (metadata)
```

Each company gets:

```
Google Drive/
└── Agency OS/
    └── {Company Name}/
        ├── Posts/      ← scheduler media
        ├── Assets/     ← creatives, general files
        └── Reports/    ← exports, PDFs
```

## Setup

### 1. Google Cloud Console

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Drive API**
3. Create **OAuth 2.0 Client ID** (Web application)
4. Authorized redirect URI:
   ```
   https://your-app.vercel.app/api/integrations/google-drive/callback
   ```
   For local dev:
   ```
   http://localhost:3000/api/integrations/google-drive/callback
   ```

### 2. Vercel environment variables

| Variable | Value |
|----------|--------|
| `GOOGLE_CLIENT_ID` | From Google Cloud |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud |
| `DATABASE_URL` | From Neon (auto) |
| `AUTH_SECRET` | Random secret |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

### 3. Neon migration

Run in Neon SQL Editor:

```sql
-- contents of neon/migrations/002_google_drive.sql
```

### 4. Connect per company

1. **Settings** → Connect Google Drive for each brand, OR
2. Company → **Drive** tab → Connect

First OAuth grants folder creation. Tokens are encrypted in the `integrations` table.

## Usage

| Location | Action |
|----------|--------|
| `/companies/{slug}/drive` | Browse files, upload, disconnect |
| `/settings` | Connect Drive per company |
| Scheduler → New Post | Upload media to Posts folder |

## Security

- OAuth scope: `drive.file` (app-created files only)
- Tokens encrypted with `AUTH_SECRET` or `INTEGRATION_ENCRYPTION_KEY`
- Uploads require authenticated session
- Max file size: 25 MB per upload

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Google Drive not configured" | Add GOOGLE_CLIENT_ID/SECRET + redeploy |
| "No refresh token" | Disconnect app in Google Account → reconnect |
| Redirect URI mismatch | Match exact URL in Google Cloud console |
| Upload fails | Ensure Drive connected for that company |
