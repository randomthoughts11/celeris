import { getSql } from "./client";

export interface WorkShift {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_accuracy_m: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_out_accuracy_m: number | null;
  created_at: string;
}

export interface WorkShiftWithUser extends WorkShift {
  user_name: string;
  user_email: string;
}

function mapShift(row: Record<string, unknown>): WorkShift {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    clock_in_at: String(row.clock_in_at),
    clock_out_at: row.clock_out_at ? String(row.clock_out_at) : null,
    clock_in_latitude: row.clock_in_latitude != null ? Number(row.clock_in_latitude) : null,
    clock_in_longitude: row.clock_in_longitude != null ? Number(row.clock_in_longitude) : null,
    clock_in_accuracy_m:
      row.clock_in_accuracy_m != null ? Number(row.clock_in_accuracy_m) : null,
    clock_out_latitude:
      row.clock_out_latitude != null ? Number(row.clock_out_latitude) : null,
    clock_out_longitude:
      row.clock_out_longitude != null ? Number(row.clock_out_longitude) : null,
    clock_out_accuracy_m:
      row.clock_out_accuracy_m != null ? Number(row.clock_out_accuracy_m) : null,
    created_at: String(row.created_at),
  };
}

export async function getActiveShift(userId: string): Promise<WorkShift | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM work_shifts
    WHERE user_id = ${userId} AND clock_out_at IS NULL
    ORDER BY clock_in_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapShift(rows[0]) : null;
}

export async function clockIn(
  userId: string,
  gps?: { latitude: number; longitude: number; accuracyMeters?: number }
): Promise<WorkShift> {
  const sql = getSql();
  const open = await getActiveShift(userId);
  if (open) throw new Error("Already clocked in");

  const rows = await sql`
    INSERT INTO work_shifts (
      user_id,
      clock_in_latitude,
      clock_in_longitude,
      clock_in_accuracy_m
    ) VALUES (
      ${userId},
      ${gps?.latitude ?? null},
      ${gps?.longitude ?? null},
      ${gps?.accuracyMeters ?? null}
    )
    RETURNING *
  `;
  return mapShift(rows[0]);
}

export async function clockOut(
  userId: string,
  gps?: { latitude: number; longitude: number; accuracyMeters?: number }
): Promise<WorkShift> {
  const sql = getSql();
  const open = await getActiveShift(userId);
  if (!open) throw new Error("Not clocked in");

  const rows = await sql`
    UPDATE work_shifts SET
      clock_out_at = now(),
      clock_out_latitude = ${gps?.latitude ?? null},
      clock_out_longitude = ${gps?.longitude ?? null},
      clock_out_accuracy_m = ${gps?.accuracyMeters ?? null}
    WHERE id = ${open.id} AND user_id = ${userId}
    RETURNING *
  `;
  return mapShift(rows[0]);
}

export async function fetchRecentShifts(limit = 40): Promise<WorkShiftWithUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT ws.*, p.full_name AS user_name, p.email AS user_email
    FROM work_shifts ws
    JOIN profiles p ON p.id = ws.user_id
    ORDER BY ws.clock_in_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    ...mapShift(r),
    user_name: r.user_name as string,
    user_email: r.user_email as string,
  }));
}

export async function fetchActiveShifts(): Promise<WorkShiftWithUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT ws.*, p.full_name AS user_name, p.email AS user_email
    FROM work_shifts ws
    JOIN profiles p ON p.id = ws.user_id
    WHERE ws.clock_out_at IS NULL
    ORDER BY ws.clock_in_at ASC
  `;
  return rows.map((r) => ({
    ...mapShift(r),
    user_name: r.user_name as string,
    user_email: r.user_email as string,
  }));
}

export async function fetchUserShifts(
  userId: string,
  limit = 20
): Promise<WorkShift[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM work_shifts
    WHERE user_id = ${userId}
    ORDER BY clock_in_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapShift);
}
