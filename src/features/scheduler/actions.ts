"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireCompanyAccess } from "@/lib/auth/access";
import { getSql } from "@/lib/db/client";
import type { PostStatus, SocialPlatform } from "@/types";

export async function generateAiCaption(
  companyId: string,
  platform: SocialPlatform,
  topic?: string
): Promise<{ caption?: string; error?: string }> {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OpenAI API key not configured" };
  }

  const model = process.env.EXTRACTION_MODEL ?? "gpt-4.1-mini";
  const res = await fetch(
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write concise, engaging social media captions for digital marketing agencies. Return only the caption text, no quotes.",
          },
          {
            role: "user",
            content: `Write a ${platform} caption${topic ? ` about: ${topic}` : " for a marketing agency client"}.`,
          },
        ],
        max_tokens: 200,
      }),
    }
  );

  if (!res.ok) {
    return { error: "Failed to generate caption" };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const caption = data.choices?.[0]?.message?.content?.trim();
  return caption ? { caption } : { error: "No caption generated" };
}

export async function saveSocialPostAction(
  companyId: string,
  input: {
    caption: string;
    platforms: SocialPlatform[];
    status: PostStatus;
    scheduledAt?: string;
    mediaUrls?: string[];
  }
) {
  const user = await requireAuth();
  await requireCompanyAccess(user, companyId);

  const sql = getSql();
  await sql`
    INSERT INTO social_posts (company_id, created_by, caption, platforms, status, scheduled_at, media_urls, ai_generated)
    VALUES (
      ${companyId}, ${user.id}, ${input.caption},
      ${input.platforms},
      ${input.status},
      ${input.scheduledAt ?? null},
      ${input.mediaUrls ?? []},
      false
    )
  `;

  revalidatePath(`/companies`);
  return { success: true };
}
