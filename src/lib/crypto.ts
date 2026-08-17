import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!secret) throw new Error("INTEGRATION_ENCRYPTION_KEY required");
  return createHash("sha256").update(secret).digest();
}

/** Signed OAuth `state` to prevent CSRF / forged companyId. */
export function signOAuthState(payload: Record<string, unknown>): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() })
  ).toString("base64url");
  const sig = createHmac("sha256", getKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState<T extends Record<string, unknown>>(
  state: string,
  maxAgeMs = 15 * 60 * 1000
): T {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) throw new Error("Invalid OAuth state");
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", getKey()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid OAuth state signature");
  }
  const data = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8")
  ) as T & { ts?: number };
  if (typeof data.ts !== "number" || Date.now() - data.ts > maxAgeMs) {
    throw new Error("OAuth state expired — try connecting again");
  }
  return data;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}
