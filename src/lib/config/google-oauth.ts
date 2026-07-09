/** Resolve Google OAuth credentials — prefers dedicated Ads app, falls back to Drive app. */
export function getGoogleOAuthEnv() {
  const clientId =
    process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return { clientId, clientSecret, developerToken, appUrl };
}

export function isGoogleAdsApiConfigured(): boolean {
  const { clientId, clientSecret, developerToken, appUrl } = getGoogleOAuthEnv();
  return Boolean(clientId && clientSecret && developerToken && appUrl);
}

export function getGoogleAdsConfigStatus(): {
  ready: boolean;
  missing: string[];
} {
  const { clientId, clientSecret, developerToken, appUrl } = getGoogleOAuthEnv();
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_ADS_CLIENT_ID or GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_ADS_CLIENT_SECRET or GOOGLE_CLIENT_SECRET");
  if (!developerToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!appUrl) missing.push("NEXT_PUBLIC_APP_URL");
  return { ready: missing.length === 0, missing };
}
