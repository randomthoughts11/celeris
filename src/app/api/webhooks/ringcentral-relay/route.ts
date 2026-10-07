import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { callAuditCompany } from "@/lib/call-audit/run";
import { recordRelayPush, storeCalls, storeVoicemail, type RcCall, type RelayVoicemail } from "@/lib/call-audit/ringcentral";

export const maxDuration = 120;

/** The office-PC helper (scripts/rc-relay.mjs) posts the RingCentral call log here. */
export async function POST(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const company = await callAuditCompany();
  if (!company) return NextResponse.json({ error: "Call audit brand not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { calls?: RcCall[]; voicemails?: RelayVoicemail[] } | null;
  if (!Array.isArray(body?.calls)) return NextResponse.json({ error: "calls[] required" }, { status: 400 });
  const calls = body.calls.filter((c) => c && typeof c.id === "string" && typeof c.startTime === "string");
  await storeCalls(company.id, calls, "ringcentral_relay");
  for (const vm of body.voicemails ?? []) await storeVoicemail(company.id, vm, "ringcentral_relay");
  await recordRelayPush();
  return NextResponse.json({ ok: true, calls: calls.length, voicemails: body.voicemails?.length ?? 0 });
}
