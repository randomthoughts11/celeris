import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedApiUser } from "@/lib/auth/api";
import { insertDrop, listMyDrops } from "@/lib/db/drops";
import { MAX_DROP_BYTES } from "@/lib/drops/crypto";

const metaSchema = z.object({
  iv: z.string().min(8).max(64),
  salt: z.string().min(8).max(64),
  authToken: z.string().min(20).max(128),
  hasPassword: z.boolean(),
  summary: z.string().max(80),
  maxDownloads: z.number().int().min(1).max(100),
  expiresInHours: z.number().int().min(1).max(24 * 7),
});

export async function GET() {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  return NextResponse.json({ drops: await listMyDrops(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;

  let meta;
  try {
    meta = metaSchema.parse(JSON.parse(request.headers.get("x-drop-meta") ?? ""));
  } catch {
    return NextResponse.json({ error: "Invalid drop metadata" }, { status: 400 });
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) {
    return NextResponse.json({ error: "Empty drop" }, { status: 400 });
  }
  if (body.length > MAX_DROP_BYTES) {
    return NextResponse.json({ error: "Drop is larger than 4 MB" }, { status: 413 });
  }

  const id = await insertDrop({ createdBy: auth.user.id, ciphertext: body, ...meta });
  return NextResponse.json({ id });
}
