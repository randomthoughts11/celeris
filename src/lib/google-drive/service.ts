import { google } from "googleapis";
import { decrypt, encrypt, signOAuthState } from "@/lib/crypto";
import { getIntegration, upsertIntegration } from "@/lib/db/integrations";

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface DriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface DriveFolderConfig {
  rootFolderId: string;
  postsFolderId: string;
  assetsFolderId: string;
  reportsFolderId: string;
  connectedEmail?: string;
}

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-drive/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(companyId: string, userId: string): string {
  const oauth2 = getGoogleOAuthClient();
  const state = signOAuthState({
    provider: "google_drive",
    companyId,
    userId,
  });

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES,
    state,
  });
}

export async function exchangeCodeAndStore(
  code: string,
  companyId: string
): Promise<DriveFolderConfig> {
  const oauth2 = getGoogleOAuthClient();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Revoke app access and retry.");
  }

  oauth2.setCredentials(tokens);
  const oauth2api = google.oauth2({ version: "v2", auth: oauth2 });
  const { data: userInfo } = await oauth2api.userinfo.get();

  const folderConfig = await ensureCompanyFolders(oauth2, companyId);

  const payload: DriveTokens = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
  };

  await upsertIntegration({
    companyId,
    provider: "google_drive",
    isConnected: true,
    credentialsEncrypted: encrypt(JSON.stringify(payload)),
    config: {
      ...folderConfig,
      connectedEmail: userInfo.email,
    },
  });

  return { ...folderConfig, connectedEmail: userInfo.email ?? undefined };
}

async function ensureCompanyFolders(
  oauth2: InstanceType<typeof google.auth.OAuth2>,
  companyId: string
): Promise<DriveFolderConfig> {
  const drive = google.drive({ version: "v3", auth: oauth2 });

  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  const companies = await sql`
    SELECT name FROM companies WHERE id = ${companyId} LIMIT 1
  `;
  const companyName = (companies[0]?.name as string) ?? "Client";

  const rootFolderId = await findOrCreateFolder(drive, "Agency OS", "root");
  const companyFolderId = await findOrCreateFolder(
    drive,
    companyName,
    rootFolderId
  );

  const postsFolderId = await findOrCreateFolder(drive, "Posts", companyFolderId);
  const assetsFolderId = await findOrCreateFolder(
    drive,
    "Assets",
    companyFolderId
  );
  const reportsFolderId = await findOrCreateFolder(
    drive,
    "Reports",
    companyFolderId
  );

  return { rootFolderId: companyFolderId, postsFolderId, assetsFolderId, reportsFolderId };
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  const q =
    parentId === "root"
      ? `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
      : `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const existing = await drive.files.list({
    q,
    fields: "files(id)",
    spaces: "drive",
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const parents = parentId === "root" ? undefined : [parentId];
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents,
    },
    fields: "id",
  });

  return created.data.id!;
}

export async function getDriveClient(companyId: string) {
  const integration = await getIntegration(companyId, "google_drive");
  if (!integration?.is_connected) {
    throw new Error("Google Drive not connected for this company");
  }

  const config = integration.config as unknown as DriveFolderConfig & {
    agencyManaged?: boolean;
  };

  if (config.agencyManaged) {
    const { getGoogleAccessToken } = await import("@/lib/integrations/google-agency");
    const accessToken = await getGoogleAccessToken();
    const oauth2 = getGoogleOAuthClient();
    oauth2.setCredentials({ access_token: accessToken });
    return {
      drive: google.drive({ version: "v3", auth: oauth2 }),
      config,
    };
  }

  if (!integration.credentials_encrypted) {
    throw new Error("Google Drive not connected for this company");
  }

  const tokens = JSON.parse(
    decrypt(integration.credentials_encrypted)
  ) as DriveTokens;

  const oauth2 = getGoogleOAuthClient();
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  oauth2.on("tokens", async (newTokens) => {
    if (newTokens.refresh_token || newTokens.access_token) {
      const updated: DriveTokens = {
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
      };
      await upsertIntegration({
        companyId,
        provider: "google_drive",
        isConnected: true,
        credentialsEncrypted: encrypt(JSON.stringify(updated)),
      });
    }
  });

  return {
    drive: google.drive({ version: "v3", auth: oauth2 }),
    config: integration.config as unknown as DriveFolderConfig,
  };
}

export async function uploadToDrive(input: {
  companyId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  folderType: "posts" | "assets" | "reports";
}): Promise<{
  driveFileId: string;
  webViewLink: string;
  thumbnailLink?: string;
}> {
  const { drive, config } = await getDriveClient(input.companyId);

  const folderMap = {
    posts: config.postsFolderId,
    assets: config.assetsFolderId,
    reports: config.reportsFolderId,
  };

  const parentId = folderMap[input.folderType];
  if (!parentId) throw new Error("Drive folder not configured");

  const { Readable } = await import("stream");
  const stream = Readable.from(input.buffer);

  const response = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [parentId],
    },
    media: {
      mimeType: input.mimeType,
      body: stream,
    },
    fields: "id, webViewLink, thumbnailLink, size",
  });

  return {
    driveFileId: response.data.id!,
    webViewLink: response.data.webViewLink!,
    thumbnailLink: response.data.thumbnailLink ?? undefined,
  };
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL
  );
}
