import { getSql } from "./client";
import type { ChatMessage, ChatRoom } from "@/types";

export async function getOrCreateCompanyRoom(
  companyId: string,
  userId: string
): Promise<ChatRoom> {
  const sql = getSql();
  const existing = await sql`
    SELECT * FROM chat_rooms
    WHERE company_id = ${companyId} AND is_dm = false
    LIMIT 1
  `;
  if (existing[0]) {
    await ensureRoomMember(existing[0].id as string, userId);
    return mapRoom(existing[0]);
  }

  const companies = await sql`SELECT name FROM companies WHERE id = ${companyId}`;
  const name = `${(companies[0]?.name as string) ?? "Team"} Chat`;

  const rows = await sql`
    INSERT INTO chat_rooms (company_id, name, is_dm, created_by)
    VALUES (${companyId}, ${name}, false, ${userId})
    RETURNING *
  `;
  await ensureRoomMember(rows[0].id as string, userId);
  return mapRoom(rows[0]);
}

export async function getOrCreateDmRoom(
  userId: string,
  otherUserId: string
): Promise<ChatRoom> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.* FROM chat_rooms r
    JOIN chat_room_members m1 ON m1.room_id = r.id AND m1.user_id = ${userId}
    JOIN chat_room_members m2 ON m2.room_id = r.id AND m2.user_id = ${otherUserId}
    WHERE r.is_dm = true
    LIMIT 1
  `;
  if (rows[0]) return mapRoom(rows[0]);

  const other = await sql`SELECT full_name FROM profiles WHERE id = ${otherUserId}`;
  const name = `DM: ${(other[0]?.full_name as string) ?? "User"}`;

  const created = await sql`
    INSERT INTO chat_rooms (name, is_dm, created_by)
    VALUES (${name}, true, ${userId})
    RETURNING *
  `;
  const roomId = created[0].id as string;
  await ensureRoomMember(roomId, userId);
  await ensureRoomMember(roomId, otherUserId);
  return mapRoom(created[0]);
}

async function ensureRoomMember(roomId: string, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO chat_room_members (room_id, user_id)
    VALUES (${roomId}, ${userId})
    ON CONFLICT DO NOTHING
  `;
}

function mapRoom(row: Record<string, unknown>): ChatRoom {
  return {
    id: row.id as string,
    company_id: (row.company_id as string) ?? null,
    name: row.name as string,
    is_dm: row.is_dm as boolean,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at),
  };
}

export async function listUserRooms(userId: string): Promise<ChatRoom[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT r.*,
      (SELECT content FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
      (
        SELECT COUNT(*)::int FROM chat_messages cm
        WHERE cm.room_id = r.id
        AND cm.created_at > COALESCE(m.last_read_at, '1970-01-01'::timestamptz)
        AND cm.sender_id != ${userId}
      ) AS unread_count
    FROM chat_rooms r
    JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = ${userId}
    ORDER BY last_message_at DESC NULLS LAST, r.created_at DESC
  `;
  return rows.map((r) => ({
    ...mapRoom(r),
    last_message: (r.last_message as string) ?? null,
    last_message_at: r.last_message_at ? String(r.last_message_at) : null,
    unread_count: Number(r.unread_count ?? 0),
  }));
}

export async function listRoomMessages(
  roomId: string,
  limit = 100
): Promise<ChatMessage[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT cm.*, p.full_name AS sender_name, p.avatar_url AS sender_avatar
    FROM chat_messages cm
    JOIN profiles p ON p.id = cm.sender_id
    WHERE cm.room_id = ${roomId}
    ORDER BY cm.created_at ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id as string,
    room_id: r.room_id as string,
    sender_id: r.sender_id as string,
    sender_name: r.sender_name as string,
    sender_avatar: (r.sender_avatar as string) ?? null,
    content: r.content as string,
    created_at: String(r.created_at),
  }));
}

export async function sendMessage(
  roomId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO chat_messages (room_id, sender_id, content)
    VALUES (${roomId}, ${senderId}, ${content})
    RETURNING *
  `;
  const profile = await sql`SELECT full_name, avatar_url FROM profiles WHERE id = ${senderId}`;
  return {
    id: rows[0].id as string,
    room_id: roomId,
    sender_id: senderId,
    sender_name: profile[0]?.full_name as string,
    sender_avatar: (profile[0]?.avatar_url as string) ?? null,
    content,
    created_at: String(rows[0].created_at),
  };
}

export async function markRoomRead(roomId: string, userId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE chat_room_members
    SET last_read_at = now()
    WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
}

export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM chat_room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  return rows.length > 0;
}
