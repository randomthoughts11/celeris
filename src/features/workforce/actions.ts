"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/db/audit";
import {
  clockIn,
  clockOut,
  fetchActiveShifts,
  fetchRecentShifts,
  fetchUserShifts,
  getActiveShift,
} from "@/lib/db/work-shifts";
import { hasAnyRole } from "@/lib/rbac/permissions";

export interface GpsPayload {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

function parseGps(input?: GpsPayload | null): GpsPayload | undefined {
  if (!input) return undefined;
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return undefined;
  }
  return input;
}

export async function getMyShiftAction() {
  const user = await requireAuth();
  return getActiveShift(user.id);
}

export async function clockInAction(gps?: GpsPayload | null) {
  const user = await requireAuth();
  const coords = parseGps(gps);
  if (!coords) {
    return { error: "Location required to clock in. Enable GPS in your browser." };
  }

  try {
    const shift = await clockIn(user.id, coords);
    await logAudit({
      userId: user.id,
      action: "shift.clock_in",
      resourceType: "work_shift",
      resourceId: shift.id,
      newValues: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      },
    });
    revalidatePath("/");
    revalidatePath("/team");
    return { success: true, shift };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Clock in failed" };
  }
}

export async function clockOutAction(gps?: GpsPayload | null) {
  const user = await requireAuth();
  const coords = parseGps(gps);
  if (!coords) {
    return { error: "Location required to clock out. Enable GPS in your browser." };
  }

  try {
    const shift = await clockOut(user.id, coords);
    await logAudit({
      userId: user.id,
      action: "shift.clock_out",
      resourceType: "work_shift",
      resourceId: shift.id,
      newValues: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters,
      },
    });
    revalidatePath("/");
    revalidatePath("/team");
    return { success: true, shift };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Clock out failed" };
  }
}

export async function getTeamAttendanceAction() {
  const user = await requireAuth();
  const canView = hasAnyRole(user.roles, ["god_mode", "admin", "manager"]);
  if (!canView) throw new Error("Forbidden");

  const [active, recent] = await Promise.all([
    fetchActiveShifts(),
    fetchRecentShifts(30),
  ]);
  return { active, recent };
}

export async function getMyShiftHistoryAction() {
  const user = await requireAuth();
  return fetchUserShifts(user.id, 10);
}
