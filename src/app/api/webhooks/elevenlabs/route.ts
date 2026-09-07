import { NextRequest, NextResponse } from "next/server";
import {
  verifyElevenLabsWebhook,
} from "@/lib/integrations/elevenlabs";
import {
  createAiCall,
  updateAiCallByConversation,
} from "@/lib/db/ai-calls";
import { analyzeCallTranscript } from "@/lib/integrations/messaging-ai";
import { getSql } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature =
    req.headers.get("x-elevenlabs-signature") ||
    req.headers.get("elevenlabs-signature");

  if (!verifyElevenLabsWebhook(signature, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const conversationId = String(
    data.conversation_id ?? data.conversationId ?? payload.conversation_id ?? ""
  );
  const statusRaw = String(data.status ?? payload.type ?? "completed").toLowerCase();
  const transcript = String(
    data.transcript ??
      (data.analysis as Record<string, unknown> | undefined)?.transcript ??
      data.message ??
      ""
  );
  const recordingUrl = (data.recording_url ?? data.recordingUrl ?? null) as
    | string
    | null;
  const duration = Number(data.duration_seconds ?? data.call_duration_secs ?? 0) || 0;
  const phone = (data.phone ?? data.to_number ?? data.caller_id ?? null) as
    | string
    | null;
  const companyId = String(
    (data.metadata as Record<string, unknown>)?.companyId ??
      data.company_id ??
      ""
  );
  const leadId = ((data.metadata as Record<string, unknown>)?.leadId ??
    data.lead_id ??
    null) as string | null;

  const statusMap: Record<string, "queued" | "ringing" | "in_progress" | "completed" | "failed" | "transferred" | "no_answer"> = {
    initiated: "ringing",
    ringing: "ringing",
    "in-progress": "in_progress",
    in_progress: "in_progress",
    done: "completed",
    completed: "completed",
    failed: "failed",
    "no-answer": "no_answer",
    no_answer: "no_answer",
    transferred: "transferred",
  };
  const status = statusMap[statusRaw] ?? "completed";

  let analysis = {
    summary: "",
    score: 50,
    sentiment: "neutral",
    objections: [] as string[],
  };
  if (transcript && status === "completed") {
    analysis = await analyzeCallTranscript(transcript);
  }

  if (conversationId) {
    const sql = getSql();
    const existing = await sql`
      SELECT id FROM ai_calls WHERE conversation_id = ${conversationId} LIMIT 1
    `;
    if (!existing[0] && companyId) {
      await createAiCall({
        companyId,
        leadId,
        phoneNumber: phone,
        conversationId,
        status,
        agentId: process.env.ELEVENLABS_AGENT_ID ?? null,
      });
    }
    await updateAiCallByConversation(conversationId, {
      status,
      transcript: transcript || undefined,
      summary: analysis.summary || undefined,
      score: analysis.score,
      sentiment: analysis.sentiment,
      recording_url: recordingUrl ?? undefined,
      duration_seconds: duration || undefined,
      objections: analysis.objections,
      analysis: { source: "elevenlabs_webhook" },
    });
  }

  return NextResponse.json({ ok: true });
}
