import { getSql } from "@/lib/db/client";
import { phoneKey, type AuditCall, type AuditVoicemail } from "@/lib/call-audit/engine";

const server = () => (process.env.RINGCENTRAL_SERVER || "https://platform.ringcentral.com").replace(/\/$/, "");

export function ringCentralConfigured(): boolean {
  return Boolean(process.env.RINGCENTRAL_CLIENT_ID && process.env.RINGCENTRAL_CLIENT_SECRET && process.env.RINGCENTRAL_JWT);
}

async function token(): Promise<string> {
  const basic = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${server()}/restapi/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: process.env.RINGCENTRAL_JWT! }),
  });
  if (!res.ok) throw new Error(`RingCentral refused the key (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function pages<T>(access: string, path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = `${server()}${path}?${new URLSearchParams(params)}`;
  for (let i = 0; url && i < 40; i++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, Number(res.headers.get("Retry-After") || 5) * 1000));
      i--;
      continue;
    }
    if (!res.ok) throw new Error(`RingCentral ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { records?: T[]; navigation?: { nextPage?: { uri?: string } } };
    out.push(...(body.records ?? []));
    url = body.navigation?.nextPage?.uri;
  }
  return out;
}

interface RcParty { phoneNumber?: string; name?: string }
interface RcCall {
  id: string;
  startTime: string;
  duration?: number;
  direction?: string;
  result?: string;
  from?: RcParty;
  to?: RcParty;
  extension?: { id?: number | string };
}
interface RcMessage {
  id: string | number;
  creationTime: string;
  from?: RcParty;
  vmTranscriptionStatus?: string;
  attachments?: Array<{ type?: string; uri?: string; vmDuration?: number; contentType?: string }>;
}

const outcome = (result = "") =>
  /voicemail/i.test(result) ? "voicemail"
  : /accepted|connected/i.test(result) ? "answered"
  : /missed|no answer/i.test(result) ? "missed"
  : /busy/i.test(result) ? "busy"
  : /reject|hang|stopped|wrong|fail|declined|abandon/i.test(result) ? "failed"
  : "unknown";

async function transcribe(blob: Blob): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions").replace(/\/chat\/completions\/?$/, "");
  const form = new FormData();
  form.append("file", blob, "voicemail.mp3");
  form.append("model", "whisper-1");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  return res.ok ? (((await res.json()) as { text?: string }).text ?? "").trim() : "";
}

/** Pull the account call log and voicemails, store them, and return them for judging. */
export async function fetchRingCentral(companyId: string, from: Date, to: Date) {
  const access = await token();
  const window = { dateFrom: from.toISOString(), dateTo: to.toISOString() };
  let records: RcCall[];
  try {
    records = await pages<RcCall>(access, "/restapi/v1.0/account/~/call-log", { ...window, type: "Voice", view: "Simple", perPage: "1000" });
  } catch {
    // Non-admin keys can only read their own extension.
    records = await pages<RcCall>(access, "/restapi/v1.0/account/~/extension/~/call-log", { ...window, type: "Voice", view: "Simple", perPage: "1000" });
  }

  const calls: AuditCall[] = [];
  const sql = getSql();
  for (const r of records) {
    const direction = /^out/i.test(r.direction ?? "") ? "outbound" : "inbound";
    const other = direction === "outbound" ? r.to?.phoneNumber : r.from?.phoneNumber;
    const call: AuditCall = { phoneKey: phoneKey(other), direction, start: new Date(r.startTime), duration: r.duration ?? 0, result: r.result ?? "" };
    calls.push(call);
    await sql`
      INSERT INTO ringcentral_calls (company_id, external_id, direction, outcome, caller, receiver, duration_seconds, started_at, metadata)
      VALUES (${companyId}, ${r.id}, ${direction}, ${outcome(r.result)}, ${r.from?.phoneNumber ?? null}, ${r.to?.phoneNumber ?? null},
        ${call.duration}, ${r.startTime},
        ${JSON.stringify({ source: "ringcentral_api", result: r.result, extension: r.extension?.id ?? null, phone_key: call.phoneKey })})
      ON CONFLICT (company_id, external_id) DO UPDATE SET
        outcome = EXCLUDED.outcome, duration_seconds = EXCLUDED.duration_seconds, metadata = ringcentral_calls.metadata || EXCLUDED.metadata
    `;
  }

  const voicemails: AuditVoicemail[] = [];
  const extensions = (process.env.RINGCENTRAL_EXTENSION_IDS || "~").split(",").map((s) => s.trim()).filter(Boolean);
  for (const ext of extensions) {
    const messages = await pages<RcMessage>(access, `/restapi/v1.0/account/~/extension/${encodeURIComponent(ext)}/message-store`, {
      ...window, messageType: "VoiceMail", perPage: "250",
    });
    for (const m of messages) {
      const externalId = `vm-${m.id}`;
      const [stored] = await sql`SELECT notes, duration_seconds FROM ringcentral_calls WHERE company_id = ${companyId} AND external_id = ${externalId}`;
      const audio = m.attachments?.find((a) => a.type === "AudioRecording");
      let transcript = (stored?.notes as string) ?? "";
      if (!transcript) {
        const text = m.attachments?.find((a) => a.type === "AudioTranscription" && a.uri);
        if (text?.uri && m.vmTranscriptionStatus === "Completed") {
          const res = await fetch(text.uri, { headers: { Authorization: `Bearer ${access}` } });
          if (res.ok) transcript = (await res.text()).trim();
        }
        if (!transcript && audio?.uri) {
          const res = await fetch(audio.uri, { headers: { Authorization: `Bearer ${access}` } });
          if (res.ok) transcript = await transcribe(await res.blob());
        }
      }
      const vm: AuditVoicemail = { phoneKey: phoneKey(m.from?.phoneNumber), at: new Date(m.creationTime), duration: audio?.vmDuration ?? 0, transcript };
      voicemails.push(vm);
      await sql`
        INSERT INTO ringcentral_calls (company_id, external_id, direction, outcome, caller, duration_seconds, notes, started_at, metadata)
        VALUES (${companyId}, ${externalId}, 'inbound', 'voicemail', ${m.from?.phoneNumber ?? null}, ${vm.duration}, ${transcript || null},
          ${m.creationTime}, ${JSON.stringify({ source: "ringcentral_api", kind: "voicemail", phone_key: vm.phoneKey })})
        ON CONFLICT (company_id, external_id) DO UPDATE SET notes = COALESCE(EXCLUDED.notes, ringcentral_calls.notes)
      `;
    }
  }
  return { calls, voicemails };
}
