"use server";

import bcrypt from "bcryptjs";
import { countUsers, createUser } from "@/lib/db/users";
import { isDatabaseConfigured } from "@/lib/config";
import type { UserRole } from "@/types";

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  const userCount = await countUsers();
  const role: UserRole = userCount === 0 ? "god_mode" : "manager";
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    await createUser({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role,
    });
    return { success: true };
  } catch {
    return { success: false, error: "An account with this email already exists" };
  }
}
