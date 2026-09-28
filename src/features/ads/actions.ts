"use server";

import { revalidateCompany } from "@/lib/cache/revalidate";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { markMetaObjectPaused, metaObjectBelongsTo, runMetaBrain } from "@/lib/ads/brain";
import { pauseMetaObject } from "@/lib/integrations/meta-agency";

export async function runAdsBrainAction(companyId: string, question?: string) {
  const user = await requireAuth();
  if (!hasPermission(user.roles, "VIEW_FINANCIALS")) return { error: "Forbidden" };
  await requireCompanyAccess(user, companyId);
  try {
    const result = await runMetaBrain(companyId, question);
    revalidateCompany();
    return { ok: true as const, answer: result.answer };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ads brain failed" };
  }
}

export async function pauseMetaObjectAction(companyId: string, externalId: string) {
  const user = await requireAuth();
  if (!hasPermission(user.roles, "MANAGE_CAMPAIGNS")) return { error: "You can't change live ads" };
  await requireCompanyAccess(user, companyId);
  if (!/^\d+$/.test(externalId) || !(await metaObjectBelongsTo(companyId, externalId))) {
    return { error: "That ad doesn't belong to this brand" };
  }
  try {
    await pauseMetaObject(externalId);
    await markMetaObjectPaused(companyId, externalId);
    revalidateCompany();
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Pause failed" };
  }
}
