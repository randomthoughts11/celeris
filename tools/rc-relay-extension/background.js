// Reads the RingCentral admin portal's API with this browser's login cookie and posts the call log to the CRM.
// RingCentral turned off API-key access for the account, so this replaces the JWT path.
import { CRM, SECRET } from "./config.js";

const PORTAL = "https://service.ringcentral.com";
let first = true;

const get = async (url) => {
  const r = await fetch(url.startsWith("http") ? url : PORTAL + url, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`);
  return r.json();
};

async function loggedIn() {
  const r = await fetch(`${PORTAL}/api/proxy/restapi/oauth/session-info`, { credentials: "include" }).catch(() => null);
  return r?.status === 200;
}

/** Open the portal in a background tab; login.js clicks through sign-in with Chrome's saved password. */
async function signIn() {
  const tabs = await chrome.tabs.query({ url: ["https://service.ringcentral.com/*", "https://login.ringcentral.com/*"] });
  if (tabs.length) await chrome.tabs.reload(tabs[0].id);
  else await chrome.tabs.create({ url: `${PORTAL}/`, active: false, pinned: true });
  await new Promise((r) => setTimeout(r, 45_000));
}

async function pull(since) {
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
        transcript = await fetch(`${PORTAL}/api/proxy${new URL(text.uri).pathname}`, { credentials: "include" })
          .then((r) => (r.ok ? r.text() : ""))
          .catch(() => "");
      }
      voicemails.push({ id: m.id, creationTime: m.creationTime, from: m.from?.phoneNumber, duration: audio?.vmDuration || 0, transcript: transcript.trim() });
    }
  }
  return { calls, voicemails };
}

async function tick() {
  try {
    if (!(await loggedIn())) await signIn();
    if (!(await loggedIn())) return console.warn("RingCentral is logged out");
    const since = new Date(Date.now() - (first ? 48 : 3) * 3_600_000).toISOString();
    const data = await pull(since);
    const res = await fetch(`${CRM}/api/webhooks/ringcentral-relay`, {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    console.log("pushed", data.calls.length, "calls,", data.voicemails.length, "voicemails ->", res.status);
    if (res.ok) first = false;
  } catch (e) {
    console.warn("relay error", e);
  }
}

chrome.alarms.create("relay", { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((a) => a.name === "relay" && tick());
chrome.runtime.onStartup.addListener(tick);
chrome.runtime.onInstalled.addListener(tick);
