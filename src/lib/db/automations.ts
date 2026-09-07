import { getSql } from "@/lib/db/client";
import type {
  AutomationRule,
  AutomationTrigger,
  Sequence,
  SequenceStep,
  WebhookEndpoint,
} from "@/types";

function mapRule(r: Record<string, unknown>): AutomationRule {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    name: r.name as string,
    trigger_type: r.trigger_type as AutomationTrigger,
    is_active: Boolean(r.is_active),
    conditions: (r.conditions as Record<string, unknown>) ?? {},
    actions: (r.actions as unknown[]) ?? [],
    created_by: (r.created_by as string) ?? null,
    last_run_at: r.last_run_at ? String(r.last_run_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listAutomationRules(
  companyId: string
): Promise<AutomationRule[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM automation_rules
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => mapRule(r as Record<string, unknown>));
}

export async function createAutomationRule(input: {
  companyId: string;
  name: string;
  triggerType: AutomationTrigger;
  conditions?: Record<string, unknown>;
  actions?: unknown[];
  branchId?: string | null;
  createdBy?: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO automation_rules (
      company_id, branch_id, name, trigger_type, conditions, actions, created_by
    ) VALUES (
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.name},
      ${input.triggerType},
      ${JSON.stringify(input.conditions ?? {})}::jsonb,
      ${JSON.stringify(input.actions ?? [])}::jsonb,
      ${input.createdBy ?? null}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function toggleAutomationRule(
  id: string,
  companyId: string,
  isActive: boolean
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE automation_rules
    SET is_active = ${isActive}, updated_at = now()
    WHERE id = ${id} AND company_id = ${companyId}
  `;
}

export async function getActiveRulesByTrigger(
  companyId: string,
  trigger: AutomationTrigger
): Promise<AutomationRule[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM automation_rules
    WHERE company_id = ${companyId}
      AND trigger_type = ${trigger}
      AND is_active = true
  `;
  return rows.map((r) => mapRule(r as Record<string, unknown>));
}

export async function markRuleRun(id: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE automation_rules SET last_run_at = now(), updated_at = now()
    WHERE id = ${id}
  `;
}

export async function listSequences(companyId: string): Promise<Sequence[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM sequences WHERE company_id = ${companyId} ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    is_active: Boolean(r.is_active),
    created_by: (r.created_by as string) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}

export async function createSequence(input: {
  companyId: string;
  name: string;
  description?: string | null;
  createdBy?: string | null;
  steps?: Array<{ stepType: string; delayHours: number; config?: Record<string, unknown> }>;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO sequences (company_id, name, description, created_by)
    VALUES (
      ${input.companyId},
      ${input.name},
      ${input.description ?? null},
      ${input.createdBy ?? null}
    )
    RETURNING id
  `;
  const seqId = rows[0].id as string;
  for (const [i, step] of (input.steps ?? []).entries()) {
    await sql`
      INSERT INTO sequence_steps (sequence_id, position, step_type, delay_hours, config)
      VALUES (
        ${seqId},
        ${i},
        ${step.stepType},
        ${step.delayHours},
        ${JSON.stringify(step.config ?? {})}::jsonb
      )
    `;
  }
  return seqId;
}

export async function listSequenceSteps(sequenceId: string): Promise<SequenceStep[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM sequence_steps
    WHERE sequence_id = ${sequenceId}
    ORDER BY position ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    sequence_id: r.sequence_id as string,
    position: Number(r.position),
    step_type: r.step_type as string,
    delay_hours: Number(r.delay_hours ?? 0),
    config: (r.config as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
  }));
}

export async function enrollLeadInSequence(
  sequenceId: string,
  leadId: string,
  delayHours = 0
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO sequence_enrollments (sequence_id, lead_id, next_run_at)
    VALUES (
      ${sequenceId},
      ${leadId},
      now() + (${delayHours} || ' hours')::interval
    )
  `;
}

export async function listWebhookEndpoints(
  companyId?: string | null
): Promise<WebhookEndpoint[]> {
  const sql = getSql();
  const rows = companyId
    ? await sql`
        SELECT * FROM webhook_endpoints
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
      `
    : await sql`SELECT * FROM webhook_endpoints ORDER BY created_at DESC`;
  return rows.map((r) => ({
    id: r.id as string,
    company_id: (r.company_id as string) ?? null,
    name: r.name as string,
    direction: r.direction as string,
    url: (r.url as string) ?? null,
    secret: (r.secret as string) ?? null,
    events: (r.events as string[]) ?? [],
    is_active: Boolean(r.is_active),
    last_triggered_at: r.last_triggered_at ? String(r.last_triggered_at) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}

export async function createWebhookEndpoint(input: {
  companyId?: string | null;
  name: string;
  direction?: string;
  url?: string | null;
  secret?: string | null;
  events?: string[];
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO webhook_endpoints (company_id, name, direction, url, secret, events)
    VALUES (
      ${input.companyId ?? null},
      ${input.name},
      ${input.direction ?? "inbound"},
      ${input.url ?? null},
      ${input.secret ?? null},
      ${input.events ?? []}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}
