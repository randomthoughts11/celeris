import { getSql } from "@/lib/db/client";
import {
  getActiveRulesByTrigger,
  markRuleRun,
  enrollLeadInSequence,
} from "@/lib/db/automations";
import { createAiCall } from "@/lib/db/ai-calls";
import { startOutboundAiCall, elevenLabsConfigured } from "@/lib/integrations/elevenlabs";
import { sendSms, twilioConfigured } from "@/lib/integrations/twilio";
import { createNotification } from "@/lib/db/notifications";
import type { AutomationTrigger } from "@/types";

type TriggerPayload = {
  leadId?: string;
  status?: string;
  callId?: string;
  appointmentId?: string;
};

/**
 * Process automation rules for a trigger. Safe to call from server actions / cron.
 */
export async function runAutomationsForTrigger(
  companyId: string,
  trigger: AutomationTrigger,
  payload: TriggerPayload = {}
): Promise<{ ran: number }> {
  const rules = await getActiveRulesByTrigger(companyId, trigger);
  let ran = 0;
  const sql = getSql();

  for (const rule of rules) {
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const raw of actions) {
      const action = raw as { type?: string; config?: Record<string, unknown> };
      const type = action.type ?? "notify";

      if (type === "assign_owner" || type === "route") {
        const ownerId = (action.config?.ownerId as string) || null;
        const branchId = (action.config?.branchId as string) || null;
        if (payload.leadId) {
          if (ownerId) {
            await sql`
              UPDATE leads SET owner_id = ${ownerId}, updated_at = now()
              WHERE id = ${payload.leadId} AND company_id = ${companyId}
            `;
          }
          if (branchId) {
            await sql`
              UPDATE leads SET branch_id = ${branchId}, updated_at = now()
              WHERE id = ${payload.leadId} AND company_id = ${companyId}
            `;
          }
          // Round-robin fallback: first salesperson/telecaller on company
          if (!ownerId) {
            const agents = await sql`
              SELECT cm.user_id FROM company_members cm
              JOIN user_roles ur ON ur.user_id = cm.user_id
              WHERE cm.company_id = ${companyId}
                AND ur.role IN ('salesperson', 'telecaller', 'manager')
              ORDER BY cm.created_at
              LIMIT 1
            `;
            if (agents[0]) {
              await sql`
                UPDATE leads SET owner_id = ${agents[0].user_id as string}, updated_at = now()
                WHERE id = ${payload.leadId} AND company_id = ${companyId}
              `;
            }
          }
        }
      }

      if (type === "ai_call" && payload.leadId) {
        const leads = await sql`
          SELECT phone, first_name FROM leads
          WHERE id = ${payload.leadId} AND company_id = ${companyId}
          LIMIT 1
        `;
        const phone = leads[0]?.phone as string | undefined;
        if (phone) {
          let conversationId: string | null = null;
          if (elevenLabsConfigured()) {
            const result = await startOutboundAiCall({
              phoneNumber: phone,
              metadata: { companyId, leadId: payload.leadId, automation: rule.id },
            });
            if (result.ok) conversationId = result.conversationId;
          }
          await createAiCall({
            companyId,
            leadId: payload.leadId,
            phoneNumber: phone,
            conversationId,
            status: conversationId ? "ringing" : "queued",
            agentId: process.env.ELEVENLABS_AGENT_ID ?? null,
            metadata: { automation_rule_id: rule.id },
          });
        }
      }

      if (type === "sms" && payload.leadId && twilioConfigured()) {
        const leads = await sql`
          SELECT phone, first_name FROM leads WHERE id = ${payload.leadId} LIMIT 1
        `;
        const phone = leads[0]?.phone as string | undefined;
        if (phone) {
          const template =
            (action.config?.template as string) ||
            `Hi ${leads[0]?.first_name ?? "there"}, following up from our team.`;
          await sendSms(phone, template);
        }
      }

      if (type === "enroll_sequence" && payload.leadId) {
        const sequenceId = action.config?.sequenceId as string | undefined;
        if (sequenceId) {
          await enrollLeadInSequence(sequenceId, payload.leadId);
        }
      }

      if (type === "set_status" && payload.leadId) {
        const status = (action.config?.status as string) || "contacted";
        await sql`
          UPDATE leads SET status = ${status}::lead_status, updated_at = now()
          WHERE id = ${payload.leadId} AND company_id = ${companyId}
        `;
      }

      if (type === "notify") {
        const managers = await sql`
          SELECT DISTINCT p.id FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id
          JOIN company_members cm ON cm.user_id = p.id
          WHERE cm.company_id = ${companyId}
            AND ur.role IN ('god_mode', 'admin', 'manager')
            AND p.approval_status = 'approved'
        `;
        for (const m of managers) {
          await createNotification({
            userId: m.id as string,
            companyId,
            type: "system",
            title: `Automation: ${rule.name}`,
            message: `Triggered ${trigger}${payload.leadId ? ` for lead ${payload.leadId}` : ""}`,
          });
        }
      }
    }
    await markRuleRun(rule.id);
    ran += 1;
  }
  return { ran };
}

/** Process due sequence enrollments + appointment reminders (cron). */
export async function processAutomationCron(): Promise<{
  sequences: number;
  reminders: number;
}> {
  const sql = getSql();
  let sequences = 0;
  let reminders = 0;

  const due = await sql`
    SELECT se.*, s.company_id, ss.step_type, ss.config, ss.delay_hours, l.phone, l.first_name
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id
    JOIN leads l ON l.id = se.lead_id
    LEFT JOIN sequence_steps ss ON ss.sequence_id = se.sequence_id AND ss.position = se.current_step
    WHERE se.status = 'active'
      AND (se.next_run_at IS NULL OR se.next_run_at <= now())
    LIMIT 50
  `;

  for (const row of due) {
    const stepType = row.step_type as string | null;
    if (stepType === "ai_call" && row.phone) {
      await createAiCall({
        companyId: row.company_id as string,
        leadId: row.lead_id as string,
        phoneNumber: row.phone as string,
        status: "queued",
        metadata: { sequence_id: row.sequence_id },
      });
    }
    if (stepType === "sms" && row.phone && twilioConfigured()) {
      await sendSms(
        row.phone as string,
        `Hi ${row.first_name ?? ""}, quick follow-up from our team.`
      );
    }
    const nextStep = Number(row.current_step ?? 0) + 1;
    const next = await sql`
      SELECT delay_hours FROM sequence_steps
      WHERE sequence_id = ${row.sequence_id as string} AND position = ${nextStep}
      LIMIT 1
    `;
    if (!next[0]) {
      await sql`
        UPDATE sequence_enrollments
        SET status = 'completed', completed_at = now(), current_step = ${nextStep}
        WHERE id = ${row.id as string}
      `;
    } else {
      const delay = Number(next[0].delay_hours ?? 0);
      await sql`
        UPDATE sequence_enrollments
        SET current_step = ${nextStep},
            next_run_at = now() + (${delay} || ' hours')::interval
        WHERE id = ${row.id as string}
      `;
    }
    sequences += 1;
  }

  const appts = await sql`
    SELECT a.id, a.title, a.starts_at, a.booking_url, a.payment_url, l.phone, l.first_name, a.company_id
    FROM appointments a
    LEFT JOIN leads l ON l.id = a.lead_id
    WHERE a.status IN ('scheduled', 'confirmed')
      AND a.reminder_sent_at IS NULL
      AND a.starts_at <= now() + interval '24 hours'
      AND a.starts_at > now()
    LIMIT 50
  `;
  for (const a of appts) {
    if (a.phone && twilioConfigured()) {
      await sendSms(
        a.phone as string,
        `Reminder: ${a.title} at ${a.starts_at}.${a.booking_url ? ` ${a.booking_url}` : ""}`
      );
    }
    await sql`
      UPDATE appointments SET reminder_sent_at = now(), updated_at = now()
      WHERE id = ${a.id as string}
    `;
    reminders += 1;
  }

  // Missed-call automation hook
  const missed = await sql`
    SELECT id, company_id, lead_id FROM ringcentral_calls
    WHERE outcome = 'missed'
      AND created_at > now() - interval '1 hour'
      AND (metadata->>'automation_processed') IS NULL
    LIMIT 20
  `;
  for (const c of missed) {
    if (c.company_id) {
      await runAutomationsForTrigger(c.company_id as string, "missed_call", {
        callId: c.id as string,
        leadId: (c.lead_id as string) || undefined,
      });
      await sql`
        UPDATE ringcentral_calls
        SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"automation_processed": true}'::jsonb
        WHERE id = ${c.id as string}
      `;
    }
  }

  return { sequences, reminders };
}
