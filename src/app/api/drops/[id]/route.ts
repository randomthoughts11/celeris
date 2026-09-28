import { NextResponse } from "next/server";
import { requireApprovedApiUser } from "@/lib/auth/api";
import { consumeDrop, deleteDrop, getDropMeta } from "@/lib/db/drops";

type Ctx = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const meta = await getDropMeta(id);
  if (!meta) {
    return NextResponse.json({ error: "This drop has expired or was already opened." }, { status: 404, headers: noStore });
  }
  return NextResponse.json(meta, { headers: noStore });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { authToken } = (await request.json().catch(() => ({}))) as { authToken?: string };
  if (typeof authToken !== "string" || authToken.length > 128) {
    return NextResponse.json({ error: "Missing key" }, { status: 400, headers: noStore });
  }

  const result = await consumeDrop(id, authToken);
  if (!result.ok) {
    return result.reason === "forbidden"
      ? NextResponse.json({ error: "Wrong password or broken link." }, { status: 403, headers: noStore })
      : NextResponse.json({ error: "This drop has expired or was already opened." }, { status: 404, headers: noStore });
  }

  return new NextResponse(new Uint8Array(result.ciphertext), {
    headers: {
      ...noStore,
      "Content-Type": "application/octet-stream",
      "X-Drop-Iv": result.iv,
      "X-Drop-Remaining": String(result.remaining),
    },
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireApprovedApiUser();
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await deleteDrop(id, auth.user.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
