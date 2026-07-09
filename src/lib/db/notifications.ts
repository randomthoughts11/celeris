import { getSql } from "./client";
import type { Notification, NotificationType } from "@/types";

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows as unknown as Notification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM notifications
    WHERE user_id = ${userId} AND is_read = false
  `;
  return (rows[0]?.count as number) ?? 0;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE notifications SET is_read = true
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function markAllRead(userId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE notifications SET is_read = true WHERE user_id = ${userId}`;
}

export async function createNotification(input: {
  userId: string;
  companyId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO notifications (user_id, company_id, type, title, message, link)
    VALUES (
      ${input.userId},
      ${input.companyId ?? null},
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.link ?? null}
    )
  `;
}
