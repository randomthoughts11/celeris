/**
 * ElevenLabs Conversational AI / phone client.
 * Fails gracefully when ELEVENLABS_API_KEY is missing.
 */

import { verifyWebhookSecret } from "@/lib/integrations/lead-sync";

const BASE = "https://api.elevenlabs.io/v1";

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID);
}

export function elevenLabsStatusMessage(): string {
  if (!process.env.ELEVENLABS_API_KEY) return "Add ELEVENLABS_API_KEY in Settings / .env";
  if (!process.env.ELEVENLABS_AGENT_ID) return "Add ELEVENLABS_AGENT_ID in Settings / .env";
  return "Connected";
}

export async function startOutboundAiCall(input: {
  phoneNumber: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = input.agentId || process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return { ok: false, error: elevenLabsStatusMessage() };
  }

  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  try {
    const res = await fetch(`${BASE}/convai/twilio/outbound-call`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: input.phoneNumber,
        metadata: input.metadata ?? {},
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      // Fallback: register conversation without telephony if phone API unavailable
      if (res.status === 404 || res.status === 400) {
        const conv = await fetch(`${BASE}/convai/conversation`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agentId,
            metadata: { ...input.metadata, phone: input.phoneNumber },
          }),
        });
        if (conv.ok) {
          const data = (await conv.json()) as { conversation_id?: string; conversationId?: string };
          const id = data.conversation_id || data.conversationId || `pending-${Date.now()}`;
          return { ok: true, conversationId: id };
        }
      }
      return { ok: false, error: `ElevenLabs error: ${res.status} ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      conversation_id?: string;
      conversationId?: string;
      callSid?: string;
    };
    return {
      ok: true,
      conversationId:
        data.conversation_id || data.conversationId || data.callSid || `el-${Date.now()}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ElevenLabs request failed" };
  }
}

export function verifyElevenLabsWebhook(
  signature: string | null,
  _body: string
): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return false;
  return verifyWebhookSecret(signature, secret);
}
