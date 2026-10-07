// Keeps a RingCentral admin tab alive in the user's own Chrome and pushes the call log to the CRM.
// RingCentral turned off API-key access for the account, so this reads through the logged-in admin portal.
// Needs Chrome's "Allow remote debugging for this browser instance" (chrome://inspect/#remote-debugging).
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split("\n")
    .map((l) => l.trim().match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
);
const CRM = env.CALL_AUDIT_RELAY_URL || "https://celeris-bice.vercel.app";
const SECRET = env.CRON_SECRET;
const EVERY_MS = 10 * 60_000;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (;;) {
    try {
      const [port, path] = readFileSync(`${process.env.LOCALAPPDATA}/Google/Chrome/User Data/DevToolsActivePort`, "utf8").trim().split("\n");
      const browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}${path}`, { timeout: 120_000 });
      log("connected to Chrome");
      return browser;
    } catch (e) {
      log("waiting for Chrome remote debugging:", String(e.message || e).split("\n")[0]);
      await sleep(60_000);
    }
  }
}

async function portalPage(ctx) {
  const open = ctx.pages().find((p) => p.url().startsWith("https://service.ringcentral.com/application"));
  if (open) return open;
  const p = await ctx.newPage();
  await p.goto("https://service.ringcentral.com/", { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await sleep(8000);
  const resume = p.getByText("Continue as", { exact: false }).first();
  if (await resume.isVisible().catch(() => false)) {
    await resume.click();
    await sleep(10_000);
  }
  return p;
}

/** Runs inside the portal tab, using its login cookie. */
async function pull(page, sinceIso) {
  return page.evaluate(async (since) => {
    const get = async (url) => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`);
      return r.json();
    };
    const calls = [];
    let url = `/api/proxy/restapi/v1.0/account/~/call-log?type=Voice&view=Simple&perPage=1000&dateFrom=${encodeURIComponent(since)}`;
    for (let i = 0; url && i < 20; i++) {
      const d = await get(url);
      calls.push(...(d.records || []));
      url = d.navigation?.nextPage?.uri;
    }
    const extensions = [...new Set(calls.map((c) => (c.direction === "Outbound" ? c.from : c.to)?.extensionId).filter(Boolean))];
    const voicemails = [];
    for (const ext of extensions) {
      const d = await get(`/api/proxy/restapi/v1.0/account/~/extension/${ext}/message-store?messageType=VoiceMail&perPage=250&dateFrom=${encodeURIComponent(since)}`).catch(() => ({ records: [] }));
      for (const m of d.records || []) {
        const audio = (m.attachments || []).find((a) => a.type === "AudioRecording");
        const text = (m.attachments || []).find((a) => a.type === "AudioTranscription");
        let transcript = "";
        if (text?.uri && m.vmTranscriptionStatus === "Completed") {
          transcript = await fetch("/api/proxy" + new URL(text.uri).pathname, { credentials: "include" })
            .then((r) => (r.ok ? r.text() : ""))
            .catch(() => "");
        }
        voicemails.push({ id: m.id, creationTime: m.creationTime, from: m.from?.phoneNumber, duration: audio?.vmDuration || 0, transcript: transcript.trim() });
      }
    }
    return { calls, voicemails };
  }, sinceIso);
}

let browser = await connect();
let first = true;
for (;;) {
  try {
    if (!browser.isConnected()) browser = await connect();
    const page = await portalPage(browser.contexts()[0]);
    const alive = await page.evaluate(async () => (await fetch("/api/proxy/restapi/oauth/session-info", { credentials: "include" })).status).catch(() => 0);
    if (alive !== 200) {
      log("RingCentral is logged out. Sign in at https://service.ringcentral.com in Chrome.");
    } else {
      await page.mouse.move(200 + Math.random() * 400, 200 + Math.random() * 300).catch(() => {});
      const since = new Date(Date.now() - (first ? 48 : 3) * 3_600_000).toISOString();
      const data = await pull(page, since);
      const res = await fetch(`${CRM}/api/webhooks/ringcentral-relay`, {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      log("pushed", data.calls.length, "calls,", data.voicemails.length, "voicemails ->", res.status);
      if (res.ok) first = false;
    }
  } catch (e) {
    log("error:", String(e.message || e).split("\n")[0]);
  }
  await sleep(EVERY_MS);
}
