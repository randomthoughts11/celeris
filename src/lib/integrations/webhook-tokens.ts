import { randomBytes, timingSafeEqual } from "crypto";
import { decrypt, encrypt } from "@/lib/crypto";
import { getIntegration, upsertIntegration } from "@/lib/db/integrations";

export type WebhookProvider = "ringcentral_webhook" | "privyr_webhook";

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function getCompanyWebhookToken(
  companyId: string,
  provider: WebhookProvider
): Promise<string | null> {
  const row = await getIntegration(companyId, provider);
  if (!row?.credentials_encrypted) return null;
  try {
    return decrypt(row.credentials_encrypted);
  } catch {
    return null;
  }
}

export async function getOrCreateCompanyWebhookToken(
  companyId: string,
  provider: WebhookProvider
): Promise<string> {
  const existing = await getCompanyWebhookToken(companyId, provider);
  if (existing) return existing;

  const token = randomBytes(32).toString("base64url");
  await upsertIntegration({
    companyId,
    provider,
    isConnected: true,
    credentialsEncrypted: encrypt(token),
    config: { kind: "inbound_webhook" },
  });
  return token;
}

export async function verifyCompanyWebhookToken(
  companyId: string,
  provider: WebhookProvider,
  provided: string | null
): Promise<boolean> {
  if (!provided) return false;
  const expected = await getCompanyWebhookToken(companyId, provider);
  if (!expected) return false;
  return tokensEqual(provided, expected);
}
