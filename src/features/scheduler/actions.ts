"use server";

import type { SocialPlatform } from "@/types";

const CAPTION_TEMPLATES: Record<SocialPlatform, string[]> = {
  instagram: [
    "Transform your brand with data-driven marketing. 🚀 Ready to scale? Link in bio.",
    "Behind every great campaign is great strategy. Here's what we're building this week ✨",
    "Results speak louder than promises. Swipe to see what's possible. 📈",
  ],
  facebook: [
    "Discover how smart marketing drives real business growth. Learn more today.",
    "Your audience is waiting. Let's create content that converts.",
  ],
  linkedin: [
    "Marketing isn't about shouting louder — it's about connecting smarter. Here's our take on what's working in 2026.",
    "Data-driven decisions. Creative execution. Measurable results. That's how we help brands grow.",
  ],
  x: [
    "Hot take: The best campaigns aren't the loudest — they're the most targeted. 🎯",
    "ROAS > vanity metrics. Every time.",
  ],
  youtube: [
    "New video: How we helped a client 3x their ROAS in 90 days. Watch now!",
    "The marketing playbook is changing. Here's what agencies need to know in 2026.",
  ],
};

export async function generateAiCaption(
  _companyId: string,
  platform: SocialPlatform
): Promise<{ caption?: string; error?: string }> {
  const templates = CAPTION_TEMPLATES[platform];
  const caption = templates[Math.floor(Math.random() * templates.length)];
  return { caption };
}
