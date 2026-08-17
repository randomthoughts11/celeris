"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canManageBrandSetup } from "@/lib/auth/access";
import {
  getOrCreateCompanyWebhookToken,
  type WebhookProvider,
} from "@/lib/integrations/webhook-tokens";

export async function getCompanyWebhookTokensAction(companyId: string) {
  const user = await requireAuth();
  if (!canManageBrandSetup(user)) return { error: "Forbidden" as const };
  const providers: WebhookProvider[] = [
    "ringcentral_webhook",
    "privyr_webhook",
  ];
  const tokens: Record<WebhookProvider, string> = {
    ringcentral_webhook: "",
    privyr_webhook: "",
  };
  for (const provider of providers) {
    tokens[provider] = await getOrCreateCompanyWebhookToken(companyId, provider);
  }
  revalidatePath("/settings");
  return { tokens };
}
