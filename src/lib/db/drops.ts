import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getSql } from "./client";

export interface DropSummary {
  id: string;
  size_bytes: number;
  summary: string | null;
  has_password: boolean;
  max_downloads: number;
  download_count: number;
  expires_at: string;
  created_at: string;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function insertDrop(input: {
  createdBy: string;
  ciphertext: Buffer;
  iv: string;
  salt: string;
  authToken: string;
  hasPassword: boolean;
  summary: string;
  maxDownloads: number;
  expiresInHours: number;
}): Promise<string> {
  const sql = getSql();
  const id = randomBytes(12).toString("base64url");
  await sql`DELETE FROM drops WHERE expires_at < now()`;
  await sql`
    INSERT INTO drops (
      id, created_by, ciphertext, iv, salt, auth_hash, has_password,
      size_bytes, summary, max_downloads, expires_at
    ) VALUES (
      ${id}, ${input.createdBy}, ${input.ciphertext.toString("base64")}, ${input.iv},
      ${input.salt}, ${hash(input.authToken)}, ${input.hasPassword},
      ${input.ciphertext.length}, ${input.summary}, ${input.maxDownloads},
      now() + make_interval(hours => ${input.expiresInHours})
    )
  `;
  return id;
}

export async function getDropMeta(id: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT salt, has_password, size_bytes, expires_at,
      max_downloads - download_count AS remaining
    FROM drops
    WHERE id = ${id} AND expires_at > now() AND download_count < max_downloads
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    salt: r.salt as string,
    hasPassword: Boolean(r.has_password),
    sizeBytes: Number(r.size_bytes),
    expiresAt: String(r.expires_at),
    remaining: Number(r.remaining),
  };
}

type ConsumeResult =
  | { ok: true; ciphertext: Buffer; iv: string; remaining: number }
  | { ok: false; reason: "gone" | "forbidden" };

/** Verifies the auth token, then atomically spends one download; burns the drop on its last one. */
export async function consumeDrop(id: string, authToken: string): Promise<ConsumeResult> {
  const sql = getSql();
  const found = await sql`
    SELECT auth_hash FROM drops
    WHERE id = ${id} AND expires_at > now() AND download_count < max_downloads
  `;
  if (!found[0]) return { ok: false, reason: "gone" };
  const expected = Buffer.from(found[0].auth_hash as string, "hex");
  const given = Buffer.from(hash(authToken), "hex");
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: "forbidden" };

  const rows = await sql`
    UPDATE drops SET download_count = download_count + 1
    WHERE id = ${id} AND expires_at > now() AND download_count < max_downloads
    RETURNING ciphertext, iv, max_downloads - download_count AS remaining
  `;
  const r = rows[0];
  if (!r) return { ok: false, reason: "gone" };
  const remaining = Number(r.remaining);
  if (remaining <= 0) await sql`DELETE FROM drops WHERE id = ${id}`;
  return {
    ok: true,
    ciphertext: Buffer.from(r.ciphertext as string, "base64"),
    iv: r.iv as string,
    remaining,
  };
}

export async function listMyDrops(userId: string): Promise<DropSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, size_bytes, summary, has_password, max_downloads, download_count,
      expires_at, created_at
    FROM drops
    WHERE created_by = ${userId} AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    id: r.id as string,
    size_bytes: Number(r.size_bytes),
    summary: (r.summary as string) ?? null,
    has_password: Boolean(r.has_password),
    max_downloads: Number(r.max_downloads),
    download_count: Number(r.download_count),
    expires_at: String(r.expires_at),
    created_at: String(r.created_at),
  }));
}

export async function deleteDrop(id: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM drops WHERE id = ${id} AND created_by = ${userId} RETURNING id
  `;
  return Boolean(rows[0]);
}
