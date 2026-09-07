/**
 * Outbound email via Resend. Fails clearly when keys missing.
 */

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function resendStatusMessage(): string {
  if (!process.env.RESEND_API_KEY) return "Add RESEND_API_KEY";
  if (!process.env.RESEND_FROM_EMAIL) return "Add RESEND_FROM_EMAIL";
  return "Connected";
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!resendConfigured()) {
    return { ok: false, error: resendStatusMessage() };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [input.to],
        subject: input.subject || "(no subject)",
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Resend error: ${res.status} ${text.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? `resend-${Date.now()}` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Resend request failed",
    };
  }
}
