import { getSql, toNumber } from "@/lib/db/client";
import type { Appointment, AppointmentStatus } from "@/types";

function mapAppt(r: Record<string, unknown>): Appointment {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    branch_id: (r.branch_id as string) ?? null,
    lead_id: (r.lead_id as string) ?? null,
    customer_id: (r.customer_id as string) ?? null,
    owner_id: (r.owner_id as string) ?? null,
    title: r.title as string,
    description: (r.description as string) ?? null,
    status: r.status as AppointmentStatus,
    starts_at: String(r.starts_at),
    ends_at: r.ends_at ? String(r.ends_at) : null,
    location: (r.location as string) ?? null,
    booking_url: (r.booking_url as string) ?? null,
    payment_url: (r.payment_url as string) ?? null,
    amount: toNumber(r.amount),
    currency: (r.currency as string) ?? "INR",
    external_id: (r.external_id as string) ?? null,
    source: (r.source as string) ?? null,
    reminder_sent_at: r.reminder_sent_at ? String(r.reminder_sent_at) : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function listAppointments(companyId: string): Promise<Appointment[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM appointments
    WHERE company_id = ${companyId}
    ORDER BY starts_at DESC
    LIMIT 200
  `;
  return rows.map((r) => mapAppt(r as Record<string, unknown>));
}

export async function createAppointment(input: {
  companyId: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  leadId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  ownerId?: string | null;
  location?: string | null;
  amount?: number;
  bookingUrl?: string | null;
  paymentUrl?: string | null;
  source?: string;
  description?: string | null;
}): Promise<string> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO appointments (
      company_id, branch_id, lead_id, customer_id, owner_id,
      title, description, starts_at, ends_at, location,
      booking_url, payment_url, amount, source
    ) VALUES (
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.leadId ?? null},
      ${input.customerId ?? null},
      ${input.ownerId ?? null},
      ${input.title},
      ${input.description ?? null},
      ${input.startsAt},
      ${input.endsAt ?? null},
      ${input.location ?? null},
      ${input.bookingUrl ?? null},
      ${input.paymentUrl ?? null},
      ${input.amount ?? 0},
      ${input.source ?? "manual"}
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function updateAppointmentStatus(
  id: string,
  companyId: string,
  status: AppointmentStatus
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE appointments SET status = ${status}, updated_at = now()
    WHERE id = ${id} AND company_id = ${companyId}
  `;
}

export async function listUpcomingForReminders(withinHours = 24) {
  const sql = getSql();
  return sql`
    SELECT a.*, l.phone AS lead_phone, l.first_name AS lead_name
    FROM appointments a
    LEFT JOIN leads l ON l.id = a.lead_id
    WHERE a.status IN ('scheduled', 'confirmed')
      AND a.reminder_sent_at IS NULL
      AND a.starts_at <= now() + (${withinHours} || ' hours')::interval
      AND a.starts_at > now()
    LIMIT 100
  `;
}

export async function markReminderSent(id: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE appointments SET reminder_sent_at = now(), updated_at = now()
    WHERE id = ${id}
  `;
}
