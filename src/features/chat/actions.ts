"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import {
  getOrCreateCompanyRoom,
  getOrCreateDmRoom,
  isRoomMember,
  listRoomMessages,
  listUserRooms,
  markRoomRead,
  sendMessage,
} from "@/lib/db/chat";
import { canAccessCompany } from "@/lib/auth/access";

export async function getChatRoomsAction() {
  const user = await requireAuth();
  return listUserRooms(user.id);
}

export async function getChatMessagesAction(roomId: string) {
  const user = await requireAuth();
  const member = await isRoomMember(roomId, user.id);
  if (!member) throw new Error("Forbidden");
  await markRoomRead(roomId, user.id);
  return listRoomMessages(roomId);
}

export async function sendChatMessageAction(roomId: string, content: string) {
  const user = await requireAuth();
  const member = await isRoomMember(roomId, user.id);
  if (!member) throw new Error("Forbidden");
  const trimmed = content.trim();
  if (!trimmed) return { error: "Message cannot be empty" };
  const msg = await sendMessage(roomId, user.id, trimmed);
  revalidatePath("/chat");
  return { success: true, message: msg };
}

export async function openCompanyChatAction(companyId: string) {
  const user = await requireAuth();
  const allowed = await canAccessCompany(user, companyId);
  if (!allowed) throw new Error("Forbidden");
  const room = await getOrCreateCompanyRoom(companyId, user.id);
  revalidatePath("/chat");
  return { roomId: room.id };
}

export async function openDmChatAction(otherUserId: string) {
  const user = await requireAuth();
  const room = await getOrCreateDmRoom(user.id, otherUserId);
  revalidatePath("/chat");
  return { roomId: room.id };
}
