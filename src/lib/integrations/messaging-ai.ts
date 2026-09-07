import { searchKnowledge } from "@/lib/db/knowledge";

/**
 * AI messaging assistant — uses OpenAI-compatible endpoint when configured.
 */
export function messagingAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateAiReply(input: {
  companyId?: string | null;
  conversationContext: string;
  latestMessage: string;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  if (!messagingAiConfigured()) {
    return { ok: false, error: "Add OPENAI_API_KEY to enable AI messaging assistant" };
  }

  let kbContext = "";
  try {
    const docs = await searchKnowledge(input.latestMessage, input.companyId, 5);
    kbContext = docs.map((d) => `## ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n");
  } catch {
    // KB optional
  }

  const url =
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.EXTRACTION_MODEL || "gpt-4.1-mini";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a sales messaging assistant for Vande AI CRM. Be concise, helpful, and on-brand.
Use the knowledge base when relevant. Do not invent pricing.
${kbContext ? `\nKnowledge base:\n${kbContext}` : ""}`,
          },
          {
            role: "user",
            content: `Conversation so far:\n${input.conversationContext}\n\nLatest message:\n${input.latestMessage}\n\nDraft a reply:`,
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `AI error ${res.status}: ${text.slice(0, 160)}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return { ok: false, error: "Empty AI response" };
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI request failed" };
  }
}

export async function analyzeCallTranscript(transcript: string): Promise<{
  summary: string;
  score: number;
  sentiment: string;
  objections: string[];
}> {
  if (!messagingAiConfigured() || !transcript.trim()) {
    return {
      summary: transcript.slice(0, 280) || "No transcript",
      score: 50,
      sentiment: "neutral",
      objections: [],
    };
  }
  const url =
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.EXTRACTION_MODEL || "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              'Analyze this sales call. Return JSON: {"summary":"...","score":0-100,"sentiment":"positive|neutral|negative","objections":["..."]}',
          },
          { role: "user", content: transcript.slice(0, 8000) },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      return {
        summary: transcript.slice(0, 280),
        score: 50,
        sentiment: "neutral",
        objections: [],
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as {
      summary?: string;
      score?: number;
      sentiment?: string;
      objections?: string[];
    };
    return {
      summary: parsed.summary ?? transcript.slice(0, 280),
      score: Number(parsed.score ?? 50),
      sentiment: parsed.sentiment ?? "neutral",
      objections: parsed.objections ?? [],
    };
  } catch {
    return {
      summary: transcript.slice(0, 280),
      score: 50,
      sentiment: "neutral",
      objections: [],
    };
  }
}
