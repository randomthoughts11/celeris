"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess, requirePermission } from "@/lib/auth/access";
import { createBranch, listBranches, updateBranch } from "@/lib/db/branches";
import {
  convertLeadToCustomer,
  createCustomer,
  listCustomers,
} from "@/lib/db/customers";
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
} from "@/lib/db/appointments";
import {
  createAiCall,
  listAiCalls,
  transferAiCall,
} from "@/lib/db/ai-calls";
import {
  addMessage,
  getConversation,
  getOrCreateConversation,
  listConversations,
  listMessages,
} from "@/lib/db/messaging";
import { sendMetaPageMessage } from "@/lib/integrations/meta-agency";
import { sendResendEmail, resendConfigured } from "@/lib/integrations/resend";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
import {
  createKnowledgeDoc,
  listKnowledgeDocs,
  searchKnowledge,
} from "@/lib/db/knowledge";
import {
  DEFAULT_WIDGETS,
  getUserDashboard,
  upsertDashboard,
} from "@/lib/db/dashboards";
import {
  createAutomationRule,
  createSequence,
  createWebhookEndpoint,
  listAutomationRules,
  listSequences,
  listWebhookEndpoints,
  toggleAutomationRule,
} from "@/lib/db/automations";
import {
  createAttribution,
  getAttributionSummary,
  listAttribution,
} from "@/lib/db/attribution";
import {
  createCustomField,
  listCustomFields,
} from "@/lib/db/custom-fields";
import { startOutboundAiCall, elevenLabsConfigured } from "@/lib/integrations/elevenlabs";
import {
  buildBookingLink,
  buildPaymentLink,
  fetchWixAvailability,
  wixConfigured,
} from "@/lib/integrations/wix";
import { sendSms, twilioConfigured } from "@/lib/integrations/twilio";
import { generateAiReply } from "@/lib/integrations/messaging-ai";
import { getSql } from "@/lib/db/client";
import { runAutomationsForTrigger } from "@/lib/automations/runner";
import type {
  AppointmentStatus,
  AutomationTrigger,
  ConversationChannel,
  DashboardWidget,
  KnowledgeDocType,
  LeadStatus,
} from "@/types";

function revalidateCompanyPaths(slug?: string) {
  revalidatePath("/");
  if (slug) revalidatePath(`/companies/${slug}`, "layout");
}

// ── Branches ───────────────────────────────────────────────────────────────
export async function createBranchAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_BRANCHES");
  await requireCompanyAccess(user, companyId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required" };
  const id = await createBranch({
    companyId,
    name,
    code: String(formData.get("code") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function toggleBranchAction(
  companyId: string,
  branchId: string,
  isActive: boolean
) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_BRANCHES");
  await requireCompanyAccess(user, companyId);
  await updateBranch(branchId, companyId, { is_active: isActive });
  revalidateCompanyPaths();
  return { success: true };
}

export async function getBranchesAction(companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  return listBranches(companyId);
}

// ── Customers ──────────────────────────────────────────────────────────────
export async function createCustomerAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_CUSTOMERS");
  await requireCompanyAccess(user, companyId);
  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name required" };
  const id = await createCustomer({
    companyId,
    firstName,
    lastName: String(formData.get("lastName") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    companyName: String(formData.get("companyName") ?? "") || null,
    branchId: String(formData.get("branchId") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    ownerId: user.id,
    lifetimeValue: Number(formData.get("lifetimeValue") ?? 0) || 0,
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function convertLeadAction(companyId: string, leadId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_CUSTOMERS");
  await requireCompanyAccess(user, companyId);
  const id = await convertLeadToCustomer(leadId, companyId, user.id);
  const sql = getSql();
  await sql`
    INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
    VALUES (${leadId}, ${user.id}, 'status_change', 'Converted to customer', ${`Customer ${id}`})
  `;
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function getCustomersAction(companyId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_CUSTOMERS");
  await requireCompanyAccess(user, companyId);
  return listCustomers(companyId);
}

// ── Appointments ───────────────────────────────────────────────────────────
export async function createAppointmentAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_APPOINTMENTS");
  await requireCompanyAccess(user, companyId);
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  if (!title || !startsAt) return { error: "Title and start time required" };

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const bookingUrl = wixConfigured()
    ? buildBookingLink()
    : String(formData.get("bookingUrl") ?? "") || null;
  const paymentUrl =
    amount > 0 && wixConfigured()
      ? buildPaymentLink(amount)
      : String(formData.get("paymentUrl") ?? "") || null;

  const id = await createAppointment({
    companyId,
    title,
    startsAt,
    endsAt: String(formData.get("endsAt") ?? "") || null,
    leadId: String(formData.get("leadId") ?? "") || null,
    customerId: String(formData.get("customerId") ?? "") || null,
    branchId: String(formData.get("branchId") ?? "") || null,
    ownerId: user.id,
    location: String(formData.get("location") ?? "") || null,
    amount,
    bookingUrl,
    paymentUrl,
    description: String(formData.get("description") ?? "") || null,
    source: "manual",
  });

  const phone = String(formData.get("notifyPhone") ?? "").trim();
  if (phone && twilioConfigured()) {
    const msg = `Appointment "${title}" booked for ${startsAt}.${bookingUrl ? ` Book: ${bookingUrl}` : ""}${paymentUrl ? ` Pay: ${paymentUrl}` : ""}`;
    await sendSms(phone, msg);
  }

  revalidateCompanyPaths();
  return { success: true, id, bookingUrl, paymentUrl };
}

export async function updateAppointmentStatusAction(
  companyId: string,
  appointmentId: string,
  status: AppointmentStatus
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_APPOINTMENTS");
  await requireCompanyAccess(user, companyId);
  await updateAppointmentStatus(appointmentId, companyId, status);
  revalidateCompanyPaths();
  return { success: true };
}

export async function getWixAvailabilityAction() {
  await requireAuth();
  return fetchWixAvailability();
}

export async function getAppointmentsAction(companyId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_APPOINTMENTS");
  await requireCompanyAccess(user, companyId);
  return listAppointments(companyId);
}

// ── AI Calls ───────────────────────────────────────────────────────────────
export async function startAiCallAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_AI_CALLS");
  await requireCompanyAccess(user, companyId);
  const phone = String(formData.get("phone") ?? "").trim();
  const leadId = String(formData.get("leadId") ?? "") || null;
  if (!phone) return { error: "Phone required" };

  if (!elevenLabsConfigured()) {
    const id = await createAiCall({
      companyId,
      leadId,
      phoneNumber: phone,
      status: "queued",
      metadata: { pending_reason: "ELEVENLABS_API_KEY not configured" },
    });
    return {
      success: true,
      id,
      warning: "Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to place live calls",
    };
  }

  const result = await startOutboundAiCall({
    phoneNumber: phone,
    metadata: { companyId, leadId, userId: user.id },
  });
  if (!result.ok) return { error: result.error };

  const id = await createAiCall({
    companyId,
    leadId,
    phoneNumber: phone,
    conversationId: result.conversationId,
    agentId: process.env.ELEVENLABS_AGENT_ID ?? null,
    status: "ringing",
  });

  if (leadId) {
    const sql = getSql();
    await sql`
      INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
      VALUES (${leadId}, ${user.id}, 'call', 'AI outbound call started', ${phone})
    `;
  }

  revalidateCompanyPaths();
  return { success: true, id, conversationId: result.conversationId };
}

export async function transferAiCallAction(
  companyId: string,
  callId: string,
  toUserId?: string
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_AI_CALLS");
  await requireCompanyAccess(user, companyId);
  await transferAiCall(callId, companyId, toUserId ?? user.id);
  revalidateCompanyPaths();
  return { success: true };
}

export async function getAiCallsAction(companyId: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_AI_CALLS");
  await requireCompanyAccess(user, companyId);
  return listAiCalls(companyId);
}

// ── Messaging ──────────────────────────────────────────────────────────────
export async function sendMessageAction(
  companyId: string,
  conversationId: string,
  body: string
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_MESSAGING");
  await requireCompanyAccess(user, companyId);
  if (!body.trim()) return { error: "Message required" };

  const conversation = await getConversation(conversationId);
  if (!conversation || conversation.company_id !== companyId) {
    return { error: "Conversation not found" };
  }

  const text = body.trim();
  // Always persist outbound record first (draft / pending delivery)
  const id = await addMessage({
    conversationId,
    body: text,
    senderId: user.id,
    direction: "outbound",
    senderType: "agent",
  });

  const channel = conversation.channel;
  let deliveryError: string | undefined;

  if (channel === "facebook" || channel === "instagram") {
    if (!(await isAgencyConnected("meta"))) {
      deliveryError =
        "Message saved. Connect Meta in Settings to deliver Messenger/IG replies.";
    } else {
      const thread = conversation.external_thread_id ?? "";
      const [pageId, recipientId] = thread.split(":");
      if (!pageId || !recipientId) {
        deliveryError =
          "Message saved. Missing page:recipient thread id — cannot deliver via Meta.";
      } else {
        const sent = await sendMetaPageMessage({
          pageId,
          recipientId,
          text,
        });
        if (!sent.ok) deliveryError = `Message saved. ${sent.error}`;
      }
    }
  } else if (channel === "email") {
    if (!resendConfigured()) {
      deliveryError =
        "Message saved. Add RESEND_API_KEY and RESEND_FROM_EMAIL to send email.";
    } else {
      const to =
        conversation.participant_handle ||
        conversation.participant_name ||
        "";
      if (!to.includes("@")) {
        deliveryError =
          "Message saved. No recipient email on this conversation.";
      } else {
        const sent = await sendResendEmail({
          to,
          subject: conversation.subject || "Reply",
          text,
        });
        if (!sent.ok) deliveryError = `Message saved. ${sent.error}`;
      }
    }
  }

  revalidateCompanyPaths();
  if (deliveryError) {
    return { success: true, id, warning: deliveryError };
  }
  return { success: true, id };
}

export async function aiSuggestReplyAction(
  companyId: string,
  conversationId: string
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_MESSAGING");
  await requireCompanyAccess(user, companyId);
  const messages = await listMessages(conversationId);
  const context = messages
    .slice(-12)
    .map((m) => `${m.direction}: ${m.body}`)
    .join("\n");
  const latest = messages[messages.length - 1]?.body ?? "";
  return generateAiReply({
    companyId,
    conversationContext: context,
    latestMessage: latest,
  });
}

export async function createConversationAction(
  companyId: string,
  channel: ConversationChannel,
  participantName: string
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_MESSAGING");
  await requireCompanyAccess(user, companyId);
  const id = await getOrCreateConversation({
    companyId,
    channel,
    participantName,
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function getConversationsAction(companyId?: string) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_MESSAGING");
  if (companyId) await requireCompanyAccess(user, companyId);
  return listConversations(companyId);
}

export async function getMessagesAction(conversationId: string) {
  await requireAuth();
  return listMessages(conversationId);
}

// ── Knowledge ──────────────────────────────────────────────────────────────
export async function createKnowledgeDocAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_KNOWLEDGE");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) return { error: "Title and content required" };
  const companyId = String(formData.get("companyId") ?? "") || null;
  if (companyId) await requireCompanyAccess(user, companyId);
  const id = await createKnowledgeDoc({
    title,
    content,
    docType: (String(formData.get("docType") ?? "general") as KnowledgeDocType),
    companyId,
    isGlobal: !companyId || formData.get("isGlobal") === "true",
    createdBy: user.id,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  revalidatePath("/knowledge");
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function searchKnowledgeAction(query: string, companyId?: string) {
  await requireAuth();
  return searchKnowledge(query, companyId);
}

export async function listKnowledgeAction(companyId?: string) {
  await requireAuth();
  return listKnowledgeDocs({ companyId: companyId ?? null, includeGlobal: true });
}

// ── Dashboards ─────────────────────────────────────────────────────────────
export async function saveDashboardAction(
  widgets: DashboardWidget[],
  companyId?: string | null,
  name?: string
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_DASHBOARDS");
  if (companyId) await requireCompanyAccess(user, companyId);
  const id = await upsertDashboard({
    userId: user.id,
    companyId,
    name,
    widgets,
  });
  revalidatePath("/dashboards");
  return { success: true, id };
}

export async function getDashboardAction(companyId?: string | null) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_DASHBOARDS");
  const layout = await getUserDashboard(user.id, companyId);
  return layout ?? {
    id: "default",
    user_id: user.id,
    company_id: companyId ?? null,
    branch_id: null,
    scope: "user",
    name: "My Dashboard",
    widgets: DEFAULT_WIDGETS,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ── Automations ────────────────────────────────────────────────────────────
export async function createAutomationRuleAction(
  companyId: string,
  formData: FormData
) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("triggerType") ?? "lead_created") as AutomationTrigger;
  if (!name) return { error: "Name required" };
  const actionType = String(formData.get("actionType") ?? "notify");
  const id = await createAutomationRule({
    companyId,
    name,
    triggerType,
    createdBy: user.id,
    actions: [{ type: actionType, config: {} }],
    conditions: {},
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function toggleAutomationAction(
  companyId: string,
  ruleId: string,
  isActive: boolean
) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  await toggleAutomationRule(ruleId, companyId, isActive);
  return { success: true };
}

export async function createSequenceAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required" };
  const id = await createSequence({
    companyId,
    name,
    description: String(formData.get("description") ?? "") || null,
    createdBy: user.id,
    steps: [
      { stepType: "wait", delayHours: 24, config: {} },
      { stepType: "ai_call", delayHours: 0, config: {} },
      { stepType: "sms", delayHours: 48, config: { template: "follow_up" } },
    ],
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function createWebhookEndpointAction(
  companyId: string,
  formData: FormData
) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name required" };
  const id = await createWebhookEndpoint({
    companyId,
    name,
    direction: String(formData.get("direction") ?? "inbound"),
    url: String(formData.get("url") ?? "") || null,
    secret: String(formData.get("secret") ?? "") || null,
    events: String(formData.get("events") ?? "lead_created")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
  });
  revalidateCompanyPaths();
  return { success: true, id };
}

export async function getAutomationsBundleAction(companyId: string) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  const [rules, sequences, webhooks] = await Promise.all([
    listAutomationRules(companyId),
    listSequences(companyId),
    listWebhookEndpoints(companyId),
  ]);
  return { rules, sequences, webhooks };
}

// ── Attribution / custom fields / follow-ups ───────────────────────────────
export async function createAttributionAction(
  companyId: string,
  data: {
    leadId?: string;
    customerId?: string;
    source?: string;
    platform?: string;
    campaignExternalId?: string;
    revenueAttributed?: number;
  }
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const id = await createAttribution({ companyId, ...data });
  return { success: true, id };
}

export async function getAttributionAction(companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  const [links, summary] = await Promise.all([
    listAttribution(companyId),
    getAttributionSummary(companyId),
  ]);
  return { links, summary };
}

export async function createCustomFieldAction(companyId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_BRAND_SETUP");
  await requireCompanyAccess(user, companyId);
  const label = String(formData.get("label") ?? "").trim();
  const fieldKey = String(formData.get("fieldKey") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const objectType = String(formData.get("objectType") ?? "lead");
  if (!label || !fieldKey) return { error: "Label and key required" };
  const id = await createCustomField({
    companyId,
    objectType,
    fieldKey,
    label,
    fieldType: String(formData.get("fieldType") ?? "text"),
  });
  return { success: true, id };
}

export async function listCustomFieldsAction(companyId: string) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);
  return listCustomFields(companyId);
}

export async function createLeadFollowUpAction(
  companyId: string,
  leadId: string,
  formData: FormData
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_LEADS");
  await requireCompanyAccess(user, companyId);
  const title = String(formData.get("title") ?? "").trim() || "Follow-up";
  const followUpAt = String(formData.get("followUpAt") ?? "") || null;
  const sql = getSql();
  const rows = await sql`
    INSERT INTO tasks (
      company_id, lead_id, assignee_id, created_by, title, description,
      task_type, status, priority, due_date, follow_up_at
    ) VALUES (
      ${companyId},
      ${leadId},
      ${user.id},
      ${user.id},
      ${title},
      ${String(formData.get("notes") ?? "") || null},
      'meeting',
      'todo',
      'medium',
      ${followUpAt},
      ${followUpAt}
    )
    RETURNING id
  `;
  await sql`
    INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
    VALUES (${leadId}, ${user.id}, 'follow_up', ${title}, ${followUpAt ?? ""})
  `;
  revalidateCompanyPaths();
  return { success: true, id: rows[0].id as string };
}

export async function assignLeadBranchAction(
  companyId: string,
  leadId: string,
  branchId: string | null
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_LEADS");
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`
    UPDATE leads SET branch_id = ${branchId}, updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;
  revalidateCompanyPaths();
  return { success: true };
}

export async function routeLeadAction(companyId: string, leadId: string) {
  const user = await requireAuth();
  requirePermission(user, "MANAGE_AUTOMATIONS");
  await requireCompanyAccess(user, companyId);
  await runAutomationsForTrigger(companyId, "lead_created", { leadId });
  return { success: true };
}

export async function updateLeadStatusWithAutomationAction(
  leadId: string,
  companyId: string,
  status: LeadStatus
) {
  const user = await requireAuth();
  requirePermission(user, "ACCESS_LEADS");
  await requireCompanyAccess(user, companyId);
  const sql = getSql();
  await sql`
    UPDATE leads SET status = ${status}, updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;
  await sql`
    INSERT INTO lead_activities (lead_id, user_id, activity_type, title, description)
    VALUES (${leadId}, ${user.id}, 'status_change', ${`Status → ${status}`}, null)
  `;
  if (status === "won") {
    await convertLeadToCustomer(leadId, companyId, user.id);
  }
  await runAutomationsForTrigger(companyId, "lead_status_changed", {
    leadId,
    status,
  });
  revalidateCompanyPaths();
  return { success: true };
}
