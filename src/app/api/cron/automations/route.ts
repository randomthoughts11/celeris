import { NextRequest, NextResponse } from "next/server";
import { processAutomationCron } from "@/lib/automations/runner";
import { authorizeCron } from "@/lib/cron";

export async function POST(req: NextRequest) {
  const denied = authorizeCron(req);
  if (denied) return denied;
  const result = await processAutomationCron();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
