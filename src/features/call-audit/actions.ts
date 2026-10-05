"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { canViewCallAudit } from "@/lib/call-audit/access";
import { runCallAudit } from "@/lib/call-audit/run";

export async function runCallAuditAction() {
  const user = await getSessionUser();
  if (!canViewCallAudit(user)) return { error: "Not found" };
  try {
    const { runId } = await runCallAudit();
    revalidatePath("/call-audit");
    return { ok: true as const, runId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Audit failed" };
  }
}
