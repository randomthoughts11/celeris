/**
 * Twilio SMS for booking / payment notifications.
 */

export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export function twilioStatusMessage(): string {
  if (!process.env.TWILIO_ACCOUNT_SID) return "Add TWILIO_ACCOUNT_SID in .env";
  if (!process.env.TWILIO_AUTH_TOKEN) return "Add TWILIO_AUTH_TOKEN in .env";
  if (!process.env.TWILIO_FROM_NUMBER) return "Add TWILIO_FROM_NUMBER in .env";
  return "Connected";
}

export async function sendSms(
  to: string,
  body: string
): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  if (!twilioConfigured()) {
    return { ok: false, error: twilioStatusMessage() };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 160)}` };
    }
    const data = (await res.json()) as { sid?: string };
    return { ok: true, sid: data.sid ?? "sent" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS failed" };
  }
}
